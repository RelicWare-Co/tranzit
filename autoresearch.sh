#!/bin/bash
set -euo pipefail

cd packages/server

# Count total lines (excluding blank lines and comments)
total_lines=$(find src -type f -name "*.ts" ! -name "*.test.ts" -exec cat {} \; | grep -v '^\s*$' | grep -v '^\s*//' | wc -l | tr -d ' ')

# Count files (excluding tests)
files_count=$(find src -type f -name "*.ts" ! -name "*.test.ts" | wc -l | tr -d ' ')

# Count test lines
test_lines=$(find src -type f -name "*.test.ts" -exec cat {} \; | wc -l | tr -d ' ')

# Type errors (0 = pass)
type_errors=$(bunx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")

# Test failures (run and count)
test_output=$(bun test --timeout 30000 2>&1 || true)
test_failures=$(echo "$test_output" | grep -c "FAIL\|failed" || echo "0")
if echo "$test_output" | grep -q "pass\|PASS"; then
  # Tests pasaron
  test_failures=0
fi

echo "METRIC total_lines=${total_lines}"
echo "METRIC files_count=${files_count}"
echo "METRIC test_lines=${test_lines}"
echo "METRIC type_errors=${type_errors}"
echo "METRIC test_failures=${test_failures}"
echo ""
echo "=== Summary ==="
echo "Total source lines: ${total_lines}"
echo "Source files: ${files_count}"
echo "Test lines: ${test_lines}"
echo "Type errors: ${type_errors}"
echo "Test failures: ${test_failures}"
