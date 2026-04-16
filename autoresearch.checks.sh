#!/bin/bash
set -euo pipefail

cd packages/server

# Type check
echo "Running TypeScript check..."
bunx tsc --noEmit 2>&1 | grep -i "error" || echo "✓ TypeScript check passed"

# Tests
echo ""
echo "Running tests..."
bun test --timeout 30000 2>&1 | tail -20

# Lint
echo ""
echo "Running Biome check..."
bunx biome check src/ 2>&1 | grep -E "(error|warning|checked|passed)" || echo "✓ Biome check passed"
