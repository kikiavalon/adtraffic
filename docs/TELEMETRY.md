# Telemetry

AdTraffic is open source and collects **no usage data by default**. Telemetry is
**opt-in**: nothing is sent unless you explicitly enable it.

## Enable or disable

```bash
npm run telemetry
```

This interactive command lets you turn anonymous telemetry on or off and,
optionally, share your email and agency name. Re-run it anytime to change your
choice. Your settings live in `~/.adtraffic/telemetry.json` (outside this repo).

## What is sent (only if you opt in)

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

Install counts are meaningful for local `npm run dev` / `npm run start`. Under
`docker compose` the container home directory is ephemeral and replicas restart,
so each would generate its own install id and re-send `app_started` — inflating
counts. Read the dashboard with that in mind.

## The code

All of it lives in `backend/src/telemetry/`: `config-store.ts` (local settings),
`cli.ts` (this command), `emitter.ts` (the send), and `notice.ts` (the one-time
first-run message).
