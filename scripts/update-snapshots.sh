#!/bin/bash
# Regenerate Playwright visual test baselines using the same Docker image as CI.
# This ensures baselines match the CI environment (Linux + specific fonts).
#
# Usage: ./scripts/update-snapshots.sh
#
# Alternatively, use the "Update Snapshots" workflow on GitHub Actions
# (Actions → Update Snapshots → Run workflow).

set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.58.2-noble"

echo "Pulling Playwright Docker image..."
docker pull "$IMAGE"

echo "Building app and updating snapshots inside container..."
docker run --rm \
  -v "$PWD":/work \
  -w /work \
  -e ASTRO_BASE=/ \
  -e CI_USE_PREVIEW=true \
  "$IMAGE" \
  bash -c "npm ci && npm run build && npx playwright test --update-snapshots"

echo "Done! Baselines updated. Review changes with 'git diff' and commit."
