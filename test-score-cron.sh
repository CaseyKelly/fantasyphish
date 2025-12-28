#!/bin/bash

# Test the score cron endpoint locally or in production
# Usage: ./test-score-cron.sh [production-url]

set -e

# Check if URL provided, otherwise use localhost
if [ -z "$1" ]; then
  URL="http://localhost:3000/api/score"
  echo "Testing locally: $URL"
  echo "Make sure dev server is running: npm run dev"
else
  URL="$1/api/score"
  echo "Testing production: $URL"
fi

# Get CRON_SECRET from .env.local
if [ -f .env.local ]; then
  CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2 | tr -d '"')
  export CRON_SECRET
fi

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not found in .env.local"
  echo "Please set it: echo 'CRON_SECRET=your-secret' >> .env.local"
  exit 1
fi

echo ""
echo "Triggering score cron..."
echo ""

curl -X POST "$URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -s | jq .

echo ""
echo "✓ Check the logs above for [Score] output"
echo ""
