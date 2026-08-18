# Live-Mode Caveats

All 70 CM360 tools are live-implemented (`STUBBED_TOOLS` is empty), so every tool
is offered to Kiki when a user has a live CM360 OAuth connection. **None of these
live implementations has been exercised against Google's real CM360 API**, and
they will not be — the project has no real CM360 account. Demo mode is the
verified experience; live mode is offered but unproven.

The items below are decisions in the live path that cannot be confirmed without a
live CM360 account. They are recorded here so a future engineer with real
credentials knows exactly what to check first.

## B3 — `createPlacementGroup` omits `advertiserId`

`cm360_create_placement_group` (`executeToolReal` in
`backend/src/cm360/tool-executor.ts`, and `CM360Client.createPlacementGroup`)
does **not** send `advertiserId` in the insert body, even though the CM360 API
documents it as required on `placementGroups.insert`. We presume the API derives
it server-side from `campaignId`, mirroring `createPlacement`, which also omits
`advertiserId` and has the same campaign→advertiser relationship. This is
**unverifiable without a live account** — if the real API rejects the insert for
a missing `advertiserId`, resolve the campaign's advertiser first (an extra read)
and include it in the body.

## B2 — placement grouping is multi-call, with output-only membership

Group membership in CM360 lives on each **placement** (`placement.placementGroupId`),
not on the group. `childPlacementIds` on a placement group is **output-only** — it
cannot be set by writing to the group. So `cm360_create_placement_group` and
`cm360_update_placement_group` perform grouping as multiple calls:

1. insert/patch the group itself (group-level fields only), then
2. patch each affected placement's `placementGroupId` to add it, and set it to
   `null` to remove it.

Any placement that fails to (un)group is reported, never silently dropped:

- create returns `{ group, grouped, failedToGroup }`
- update (when membership is reconciled) returns `{ group, added, removed, failed }`;
  update without a `placementIds` change returns `{ group }`

The demo path mirrors these shapes exactly (`failedToGroup`/`failed` are always
empty in demo because in-memory grouping never fails). Against the real API, the
per-placement patch loop is where partial failures would actually surface, and
the returned `group` is re-read after the patches so its membership is truthful
rather than a stale pre-reconciliation snapshot.
