/** Base URL where the backend's demo fixture routes are reachable from a
 * headless browser. Shared by mock tag rewiring and QA click-test job building. */
export function demoFixtureBase(): string {
  return process.env.QA_DEMO_BASE ?? `http://localhost:${process.env.PORT ?? '3001'}`;
}
