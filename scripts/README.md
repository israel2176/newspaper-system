# newspaper-system / scripts

Python automation that runs on the VPS, fetches PDFs from Gmail, and publishes them to the web.

## Prerequisites

- Ubuntu/Debian VPS with nginx already serving `israelcodes.ovh`
- Python 3.10+
- Gmail account with [App Password](https://myaccount.google.com/apppasswords) enabled

## Quick setup

```bash
sudo GITHUB_PAGES_ORIGIN="https://YOUR-USERNAME.github.io" bash install.sh
```

Then fill in `/etc/newspaper.env` and reload nginx.

## Manual run (test)

```bash
source /etc/newspaper.env
/opt/newspaper-venv/bin/python fetch_newspaper.py
```

## Cron schedule

The installer adds: `0 * * * *` (every hour, every day).  
The newspaper is weekly so this is more than sufficient.

## Logs

```
tail -f /var/log/newspaper_fetch.log
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMAIL_USER` | ✅ | — | Gmail address |
| `EMAIL_PASS` | ✅ | — | Gmail App Password |
| `SENDER_FILTER` | — | (all) | Filter emails by From address |
| `SUBJECT_FILTER` | — | (all) | Filter emails by Subject |
| `NEWSPAPER_NAME` | — | המקומון | Display name |
| `NEWSPAPER_TAGLINE` | — | — | Short subtitle |
| `STORAGE_PATH` | — | `/var/www/israelcodes.ovh/newspaper` | Image output directory |
| `JPG_DPI` | — | `150` | Render DPI (150 ≈ 1240×1754px for A4) |
| `JPG_QUALITY` | — | `85` | JPEG quality 1–95 |
| `THUMB_WIDTH` | — | `300` | Archive thumbnail width in px |
| `NOTIFY_EMAIL` | — | — | Send errors here |

## Issue numbering

The script extracts the issue number from the PDF filename or email subject using these patterns (in order):

1. `גיליון 1218`, `issue-1218`, `No. 1218`
2. A standalone 4-5 digit number
3. Fallback: `YYWW` (e.g. week 19 of 2026 → `2619`)
