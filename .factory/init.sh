#!/bin/bash
# Init script for admin UI redesign mission
# Runs at the start of each worker session

set -e

cd /Users/verzach3/Projects/tranzit

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  bun install
fi

# Verify services manifest exists
if [ ! -f ".factory/services.yaml" ]; then
  echo "Warning: .factory/services.yaml not found"
fi

echo "Environment ready for admin UI redesign mission"
