#!/usr/bin/env bash
#
# AdTraffic — one-line demo installer (macOS / Linux).
#
#   curl -fsSL https://raw.githubusercontent.com/kikiavalon/adtraffic/main/install.sh | bash
#
# Fetches the public repo as a tarball (no `git` — that would trigger the macOS
# Xcode Command Line Tools popup), makes sure Node.js is present, then hands off
# to scripts/demo.mjs which installs deps, builds, launches DEMO_MODE, and opens
# the browser. All behind friendly messages.
set -euo pipefail

REPO="kikiavalon/adtraffic"
BRANCH="main"
DEST="$HOME/AdTraffic-Demo"
TARBALL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
MIN_NODE_MAJOR=20

say() { printf '  %s\n' "$1"; }

printf '\n  ────────────────────────────────\n'
printf '     AdTraffic — Demo Installer\n'
printf '  ────────────────────────────────\n\n'

# 1) Ensure Node.js >= MIN_NODE_MAJOR ---------------------------------------
node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "${major:-0}" -ge "$MIN_NODE_MAJOR" ]
}

if ! node_ok; then
  if command -v brew >/dev/null 2>&1; then
    say "Installing Node.js (this can take a few minutes)..."
    if ! brew install node >/dev/null 2>&1; then
      say "Homebrew could not install Node.js automatically."
      say "Please install the LTS version from https://nodejs.org and run this again."
      exit 1
    fi
    # Make the freshly installed node reachable in this shell.
    export PATH="$(brew --prefix)/bin:$PATH"
  else
    say "AdTraffic needs Node.js (version ${MIN_NODE_MAJOR} or newer)."
    say "Please install the LTS version from:  https://nodejs.org/en/download"
    say "Then run this command again."
    command -v open >/dev/null 2>&1 && open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
    exit 1
  fi
fi

# 2) Download the code (tarball, no git) ------------------------------------
if [ -f "$DEST/package.json" ]; then
  say "Using your existing copy at $DEST"
  say "(delete that folder if you want a fresh download)"
else
  say "Downloading AdTraffic..."
  mkdir -p "$DEST"
  # --strip-components=1 drops the top-level "adtraffic-<branch>/" folder.
  if ! curl -fsSL "$TARBALL" | tar -xz -C "$DEST" --strip-components=1; then
    say "Download failed. Please check your internet connection and try again."
    exit 1
  fi
fi

# 3) Hand off to the cross-platform runner ----------------------------------
cd "$DEST"
exec node scripts/demo.mjs
