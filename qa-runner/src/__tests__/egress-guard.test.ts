import { describe, it, expect } from 'vitest';
import { isBlockedIp, assertEgressAllowed } from '../egress-guard.js';

describe('isBlockedIp', () => {
  it('blocks loopback, link/site-local, private, CGNAT, reserved, and internal IPv6 ranges', () => {
    for (const ip of [
      // IPv4
      '127.0.0.1',
      '127.5.5.5',
      '0.0.0.0',
      '169.254.169.254',
      '169.254.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '192.0.0.1',
      '100.64.0.1',
      '198.18.0.1',
      '240.0.0.1',
      '255.255.255.255',
      // IPv6 in the normalized hex forms the URL parser actually produces
      '::1',
      '::',
      'fe80::1',
      'fec0::1',
      'fc00::1',
      'fd12:3456::1',
      '::ffff:a9fe:a9fe', // == ::ffff:169.254.169.254 (metadata) — the reported bypass
      '::ffff:7f00:1', // == ::ffff:127.0.0.1
      '::ffff:a00:1', // == ::ffff:10.0.0.1
      '::7f00:1', // == ::127.0.0.1 (IPv4-compatible)
      '64:ff9b::7f00:1', // NAT64 embedding 127.0.0.1
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('allows public addresses, including public IPv4-mapped and 172.16/12 boundaries', () => {
    for (const ip of [
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
      '172.15.0.1',
      '172.32.0.1',
      '198.20.0.1',
      '2606:4700::1111',
      '::ffff:808:808', // == ::ffff:8.8.8.8 (public)
    ]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it('fails closed on non-IP input', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
  });
});

describe('assertEgressAllowed', () => {
  it('blocks internal hosts through the URL parser (IPv4, bracketed IPv6, and mapped forms)', async () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:6379/',
      'http://[::1]/',
      'http://10.0.0.5/',
      'http://192.168.1.10/admin',
      'http://[::ffff:169.254.169.254]/latest/meta-data/', // normalizes to ::ffff:a9fe:a9fe
      'http://[::ffff:127.0.0.1]:6379/',
      'http://[::ffff:10.0.0.1]/',
      'http://2130706433/', // decimal 127.0.0.1
    ]) {
      await expect(assertEgressAllowed(url), url).rejects.toThrow(/Blocked click-test egress/);
    }
  });

  it('blocks non-http(s) schemes', async () => {
    await expect(assertEgressAllowed('file:///etc/passwd')).rejects.toThrow(/unsupported scheme/);
    await expect(assertEgressAllowed('ftp://10.0.0.1/')).rejects.toThrow(/unsupported scheme/);
  });

  it('allows an internal host only when explicitly allowlisted (local fixtures)', async () => {
    await expect(assertEgressAllowed('http://127.0.0.1:8080/click', ['127.0.0.1'])).resolves.toBeUndefined();
    await expect(assertEgressAllowed('http://localhost:8080/click', ['localhost'])).resolves.toBeUndefined();
  });

  it('allows public hosts', async () => {
    await expect(assertEgressAllowed('https://8.8.8.8/')).resolves.toBeUndefined();
    await expect(assertEgressAllowed('https://[::ffff:8.8.8.8]/')).resolves.toBeUndefined();
  });
});
