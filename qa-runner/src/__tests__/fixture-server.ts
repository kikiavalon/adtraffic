/**
 * Local HTTP fixture server for runner e2e tests — Playwright never leaves
 * localhost. Chain: /click → 302 /hop → 302 /landing (+ meta/js/loop/blank/404
 * variants for each failure mode).
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const LANDING_QUERY = 'utm_source=cm360&utm_medium=display&utm_campaign=fixture';

export interface FixtureServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const html = (body: string): void => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body>${body}</body></html>`);
    };
    const redirect = (to: string): void => {
      res.writeHead(302, { location: to });
      res.end();
    };
    switch (url.pathname) {
      case '/click': return redirect('/hop');
      case '/hop': return redirect(`/landing?${LANDING_QUERY}`);
      case '/meta': return html(`<meta http-equiv="refresh" content="0;url=/landing?${LANDING_QUERY}">`);
      case '/js': return html(`<script>location.href='/landing?${LANDING_QUERY}'</script>`);
      case '/loop': return redirect('/loop');
      case '/blank': { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html><body></body></html>'); }
      case '/missing': { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<h1>404</h1>'); }
      case '/landing': return html(`<h1>Fixture landing</h1><p>query: ${url.search}</p>`);
      default: { res.writeHead(500); return res.end(); }
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => { server.close(() => resolve()); }),
  };
}
