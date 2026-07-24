#!/usr/bin/env bash
# Create a clean bundle for GitHub push
# Excludes: node_modules, .next, .git, .env, dev.log, server.log, db/
set -e

cd /home/z/my-project

# Ensure download directory exists
mkdir -p download

BUNDLE="download/xauusd-bot-bundle.tar.gz"

# Remove old bundle
rm -f "$BUNDLE"

# Create bundle — exclude heavy/regenerated/local files
tar czf "$BUNDLE" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='db' \
  --exclude='download' \
  --exclude='upload' \
  --exclude='dev.out.log' \
  --exclude='*.log' \
  --exclude='skills' \
  --exclude='mini-services' \
  --exclude='examples' \
  --exclude='tests' \
  --exclude='worklog.md' \
  --transform 's,^\.,xauusd-bot,' \
  -C /home/z/my-project .

echo ""
echo "✓ Bundle created: /home/z/my-project/$BUNDLE"
ls -lh "$BUNDLE"
echo ""
echo "Contents preview:"
tar tzf "$BUNDLE" | head -30
echo "..."
echo "Total files in bundle:"
tar tzf "$BUNDLE" | wc -l
