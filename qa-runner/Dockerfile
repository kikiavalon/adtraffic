# Playwright's official image ships matching browsers + OS deps preinstalled.
# The tag MUST stay in lockstep with qa-runner/package.json's playwright pin.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY qa-runner/ ./qa-runner/

# npm tolerates the other declared workspaces being absent (webapp image precedent)
RUN npm ci
RUN npm run build --workspace=shared && npm run build --workspace=qa-runner

FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/qa-runner/package.json ./qa-runner/
COPY --from=builder /app/qa-runner/dist/ ./qa-runner/dist/

RUN npm ci --omit=dev --workspace=shared --workspace=qa-runner

ENV NODE_ENV=production
# The image runs as the non-root pwuser; in-container Chromium runs without its
# own sandbox (QA_RUNNER_NO_SANDBOX in compose) — the container itself is the
# isolation boundary: read_only fs, no credentials, 1G cap, network-limited.
USER pwuser
CMD ["node", "qa-runner/dist/worker.js"]
