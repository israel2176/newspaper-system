#!/bin/bash
set -e
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

git pull origin master

# Symlink script into newspaper-scripts (keeps .env in place)
ln -sf "$REPO_DIR/scripts/fetch_newspaper.py" /home/ubuntu/newspaper-scripts/fetch_newspaper.py

echo "Deploy complete."
