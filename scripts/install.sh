#!/usr/bin/env bash
# install.sh — First-time setup on VPS (Ubuntu/Debian)
# Run as root or with sudo
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEWSPAPER_USER="${NEWSPAPER_USER:-www-data}"
WEB_ROOT="${WEB_ROOT:-/var/www/israelcodes.ovh/newspaper}"
CRON_USER="${CRON_USER:-root}"
GITHUB_PAGES_ORIGIN="${GITHUB_PAGES_ORIGIN:-https://USERNAME.github.io}"  # ← change this

echo "=== Installing system dependencies ==="
apt-get update -qq
apt-get install -y poppler-utils python3 python3-pip python3-venv

echo "=== Creating virtualenv ==="
python3 -m venv /opt/newspaper-venv
/opt/newspaper-venv/bin/pip install --quiet --upgrade pip
/opt/newspaper-venv/bin/pip install --quiet -r "$SCRIPT_DIR/requirements.txt"

echo "=== Setting up storage directory ==="
mkdir -p "$WEB_ROOT"
chown -R "$NEWSPAPER_USER":"$NEWSPAPER_USER" "$(dirname "$WEB_ROOT")"

echo "=== Setting up .env ==="
if [ ! -f /etc/newspaper.env ]; then
    cp "$SCRIPT_DIR/config.example.env" /etc/newspaper.env
    chmod 600 /etc/newspaper.env
    echo ""
    echo "  ⚠  Edit /etc/newspaper.env with your credentials before continuing."
    echo "     Run: nano /etc/newspaper.env"
    echo ""
fi

echo "=== Creating nginx snippet ==="
# Drop this include into your site's server block:
#   include /etc/nginx/snippets/newspaper-cors.conf;
cat > /etc/nginx/snippets/newspaper-cors.conf << NGINX
# Newspaper static files — long-lived cache, CORS for GitHub Pages
location /newspaper/ {
    alias $WEB_ROOT/;

    # Allow GitHub Pages origin
    add_header Access-Control-Allow-Origin "$GITHUB_PAGES_ORIGIN" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Vary "Origin" always;

    # Images never change once written
    location ~* \.(jpg|jpeg)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Access-Control-Allow-Origin "$GITHUB_PAGES_ORIGIN" always;
        add_header Vary "Origin" always;
    }

    # Manifest refreshes every 5 minutes
    location = /newspaper/manifest.json {
        add_header Cache-Control "public, max-age=300";
        add_header Access-Control-Allow-Origin "$GITHUB_PAGES_ORIGIN" always;
        add_header Vary "Origin" always;
    }
}
NGINX

echo ""
echo "  → Snippet written to /etc/nginx/snippets/newspaper-cors.conf"
echo "  → Add   include /etc/nginx/snippets/newspaper-cors.conf;   to your site server block"
echo ""

echo "=== Installing cron job (hourly) ==="
CRON_LINE="0 * * * * . /etc/newspaper.env && /opt/newspaper-venv/bin/python $SCRIPT_DIR/fetch_newspaper.py >> /var/log/newspaper_fetch.log 2>&1"

# Add only if not already present
( crontab -u "$CRON_USER" -l 2>/dev/null | grep -qF "fetch_newspaper.py" ) || \
  ( crontab -u "$CRON_USER" -l 2>/dev/null; echo "$CRON_LINE" ) | crontab -u "$CRON_USER" -

echo "  → Cron job added for user $CRON_USER"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /etc/newspaper.env with your Gmail credentials"
echo "  2. Add the nginx snippet to your site config and run: nginx -t && nginx -s reload"
echo "  3. Test manually: . /etc/newspaper.env && /opt/newspaper-venv/bin/python $SCRIPT_DIR/fetch_newspaper.py"
echo "  4. Update site/js/config.js in the GitHub repo with your server URL"
echo ""
