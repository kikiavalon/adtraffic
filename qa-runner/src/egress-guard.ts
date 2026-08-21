import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * Egress guard for the click-tester. The runner navigates user-controlled
 * click-through URLs and follows their redirects, so without this check a
 * crafted target (or a public URL that 302s inward) turns the runner into an
 * SSRF read primitive against cloud-metadata and internal services. Every hop
 * is checked; hosts the caller explicitly trusts (local demo/test fixtures via
 * `allowInsecureHosts`) are exempt.
 *
 * Residual: this resolves the host and blocks private addresses, but the
 * subsequent fetch resolves independently, so a DNS-rebinding domain (public at
 * check time, private at fetch time) is not fully defeated. Pinning to the
 * vetted IP is not viable here because fetching an https URL by IP breaks TLS
 * SNI/certificate validation. This residual is accepted: click-testing is
 * admin-gated and off by default (the qa.click_test.enabled flag), so reaching
 * this path at all requires an operator to enable the feature.
 */

/** True if the IP literal is loopback, link/site-local (incl. the
 * 169.254.169.254 cloud-metadata address), RFC-1918 private, CGNAT,
 * unique-local IPv6, an embedded-IPv4 form of any of those, or a reserved
 * range. Unparseable input fails closed (blocked). */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 240) return true; // 240.0.0.0/4 reserved incl. 255.255.255.255 broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const bytes = expandIpv6(ip);
  if (!bytes) return true; // unparseable — fail closed
  if (bytes.slice(0, 15).every((x) => x === 0) && bytes[15] === 1) return true; // ::1 loopback
  if (bytes.every((x) => x === 0)) return true; // :: unspecified
  if (bytes[0] === 0xfe && bytes[1]! >= 0x80) return true; // fe80::/10 link + fec0::/10 site-local
  if ((bytes[0]! & 0xfe) === 0xfc) return true; // fc00::/7 unique-local

  // Forms that carry an IPv4 destination in the low 32 bits — check it as IPv4.
  const embedded = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
  const firstTenZero = bytes.slice(0, 10).every((x) => x === 0);
  if (firstTenZero && bytes[10] === 0xff && bytes[11] === 0xff) return isBlockedIpv4(embedded); // ::ffff:0:0/96 mapped
  if (bytes.slice(0, 12).every((x) => x === 0)) return isBlockedIpv4(embedded); // ::/96 compatible (deprecated)
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b) {
    return isBlockedIpv4(embedded); // 64:ff9b::/96 NAT64
  }
  return false;
}

/** Expand an IPv6 literal (already validated by `net.isIP`) to its 16 bytes,
 * normalizing `::` and any trailing dotted-quad. Returns null if malformed. */
function expandIpv6(addr: string): number[] | null {
  let text = addr.toLowerCase();

  const dotted = /:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (dotted?.[1]) {
    const v4 = dotted[1].split('.').map(Number);
    if (v4.some((n) => n > 255)) return null;
    const hi = (((v4[0]! << 8) | v4[1]!) >>> 0).toString(16);
    const lo = (((v4[2]! << 8) | v4[3]!) >>> 0).toString(16);
    text = `${text.slice(0, dotted.index + 1)}${hi}:${lo}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;

  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    const value = parseInt(group || '0', 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) return null;
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  return bytes;
}

/**
 * Throws unless `rawUrl` is an http(s) URL whose host resolves entirely to
 * public addresses. Hosts in `allowHosts` are exempt (local fixtures).
 */
export async function assertEgressAllowed(
  rawUrl: string,
  allowHosts: readonly string[] = [],
): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Blocked click-test egress: unparseable URL ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked click-test egress: unsupported scheme ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (allowHosts.includes(host)) return;

  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address);

  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new Error(`Blocked click-test egress to private address: ${host} -> ${address}`);
    }
  }
}
