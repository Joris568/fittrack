#!/bin/bash
# Ensures our locally-installed Node.js is on PATH before running npm, since this
# machine has no system-wide Node install and the process spawning this script
# doesn't source the user's shell profile.
export PATH="$HOME/.local/node22/bin:$PATH"
cd "$(dirname "$0")/../.." || exit 1
exec npm run dev
