#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but not installed"
  exit 1
fi

if [ ! -d node_modules ]; then
  bun install
fi

if [ ! -d server/node_modules ]; then
  cd server
  bun install
  cd ..
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

echo "init complete"
