#!/bin/bash
# Quick script to view the latest Playwright trace from GitHub Actions

set -e

echo "📦 Fetching latest Playwright test results..."

# Get the latest completed workflow run ID
RUN_ID=$(gh run list --workflow=e2e-tests.yml --limit 10 --json databaseId,status,conclusion --jq '.[] | select(.status == "completed") | .databaseId' | head -1)

if [ -z "$RUN_ID" ]; then
  echo "❌ No workflow runs found"
  exit 1
fi

echo "🔍 Found run ID: $RUN_ID"

# Clean up any existing results
rm -rf /tmp/playwright-results

# Download the artifact
echo "⬇️  Downloading artifacts..."
gh run download "$RUN_ID" --name playwright-results --dir /tmp/playwright-results

# Check if there are any trace files
TRACE_FILES=$(find /tmp/playwright-results/test-results -name "trace.zip" 2>/dev/null || true)

if [ -z "$TRACE_FILES" ]; then
  echo "✅ No traces found (tests may have passed!)"
  echo "📊 Opening HTML report instead..."
  if [ -f /tmp/playwright-results/playwright-report/index.html ]; then
    # Cross-platform file opening
    if command -v open &> /dev/null; then
      open /tmp/playwright-results/playwright-report/index.html
    elif command -v xdg-open &> /dev/null; then
      xdg-open /tmp/playwright-results/playwright-report/index.html
    elif command -v start &> /dev/null; then
      start /tmp/playwright-results/playwright-report/index.html
    else
      echo "📄 Report saved at: /tmp/playwright-results/playwright-report/index.html"
    fi
  else
    echo "❌ No HTML report found either"
  fi
  exit 0
fi

# Show available traces
echo ""
echo "📹 Available traces:"
echo "$TRACE_FILES" | nl

# Count traces
TRACE_COUNT=$(echo "$TRACE_FILES" | wc -l | tr -d ' ')

if [ "$TRACE_COUNT" -eq 1 ]; then
  # Only one trace, open it directly
  echo ""
  echo "🚀 Opening trace viewer..."
  npx playwright show-trace $TRACE_FILES
else
  # Multiple traces, let user choose
  echo ""
  read -p "Enter trace number to view (or press Enter for first): " CHOICE
  CHOICE=${CHOICE:-1}
  SELECTED_TRACE=$(echo "$TRACE_FILES" | sed -n "${CHOICE}p")
  echo "🚀 Opening trace viewer..."
  npx playwright show-trace "$SELECTED_TRACE"
fi
