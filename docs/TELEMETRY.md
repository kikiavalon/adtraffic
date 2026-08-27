# Telemetry

AdTraffic is open source and sends **anonymous usage telemetry, on by default**,
so we can see how many teams are running it. It is anonymous unless you choose to
add your email and agency. You can turn it off at any time.

## Turn it off, or add your details

```bash
npm run telemetry
```

This interactive command lets you turn telemetry on or off and, optionally, share
your email and agency name so we can reach out. The first time you start the
backend in a terminal it runs this prompt for you; re-run it anytime to change
your choice. Your settings live in `~/.adtraffic/telemetry.json` (outside this
repo). To turn it off for a whole deployment at once, set `POSTHOG_KEY=` (empty)
in the backend environment.

## What is sent

On each backend start, one `app_started` event is sent to PostHog with:

- app version, Node.js version, operating system
- a random install id (a UUID generated on your machine)
- your email and agency name — **only if you typed them in**

## What is NEVER sent

Chat prompts, CM360 account data, API keys, credentials, request/response
bodies, or precise location. Only the fields listed above are ever transmitted.

## Where it goes

PostHog Cloud. The events are anonymous unless you volunteered an email/agency.
Data already sent is not automatically deleted on opt-out; to request removal,
contact the maintainer.

## A note on Docker

Because telemetry is on by default, be mindful of how install counts read under
`docker compose`: the container home directory is ephemeral and replicas restart,
so each would generate its own install id and re-send `app_started` — inflating
counts. Local `npm run dev` / `npm run start` install counts are the meaningful
ones. Read the dashboard with that in mind.

## The code

All of it lives in `backend/src/telemetry/`: `config.ts` (the committed,
write-only PostHog key), `config-store.ts` (local settings + the shared
consent-config builder), `cli.ts` (the interactive prompt), `emitter.ts` (the
send), and `notice.ts` (the first-run flow — an interactive prompt when a human
is at the terminal, otherwise a one-time default-ON notice).
