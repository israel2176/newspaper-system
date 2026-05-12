#!/usr/bin/env python3
"""
Newspaper Automation Script
Gmail IMAP → PDF download → JPG conversion → manifest update
Runs hourly via cron on VPS.
"""

import os
import sys
import json
import imaplib
import email
import email.header
import email.utils
import re
import logging
import shutil
import smtplib
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from email import policy
from email.header import decode_header
from email.mime.text import MIMEText

try:
    from PIL import Image
    from pdf2image import convert_from_path
except ImportError as exc:
    print(f"Missing dependency: {exc}\nRun: pip install Pillow pdf2image")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

IL_TZ = timezone(timedelta(hours=3))


def _env(key, default="", required=False):
    val = os.getenv(key, default)
    if required and not val:
        logging.error("Required env var %s is not set", key)
        sys.exit(1)
    return val


IMAP_HOST         = _env("IMAP_HOST",         "imap.gmail.com")
IMAP_PORT         = int(_env("IMAP_PORT",      "993"))
EMAIL_USER        = _env("EMAIL_USER",         required=True)
EMAIL_PASS        = _env("EMAIL_PASS",         required=True)
SENDER_FILTER     = _env("SENDER_FILTER")       # e.g. "editor@paper.co.il"
SUBJECT_FILTER    = _env("SUBJECT_FILTER")      # e.g. "מקומון שבועי"
NEWSPAPER_NAME    = _env("NEWSPAPER_NAME",     "המקומון")
NEWSPAPER_TAGLINE = _env("NEWSPAPER_TAGLINE",  "")
STORAGE_BASE      = Path(_env("STORAGE_PATH",  "/var/www/israelcodes.ovh/newspaper"))
MANIFEST_FILE     = Path(_env("MANIFEST_PATH", str(STORAGE_BASE / "manifest.json")))
NOTIFY_EMAIL      = _env("NOTIFY_EMAIL")
PROCESSED_FOLDER  = _env("PROCESSED_FOLDER",  "newspaper-processed")
FLATTEN_DPI       = int(_env("FLATTEN_DPI",    "200"))
JPG_QUALITY       = int(_env("JPG_QUALITY",    "88"))
THUMB_WIDTH       = int(_env("THUMB_WIDTH",    "300"))
MAX_ISSUES        = int(_env("MAX_ISSUES",     "11"))    # 1 featured + 10 previous

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("/var/log/newspaper_fetch.log"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("newspaper")

# ── String helpers ────────────────────────────────────────────────────────────


def decode_str(value):
    parts = decode_header(value or "")
    out = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(chunk)
    return "".join(out)


def parse_issue_number(text):
    """Extract a 3-5 digit issue number from filename or subject."""
    for pat in [
        r"(?:גיליון|issue|no\.?)\s*[-#]?\s*(\d{3,5})",
        r"[_\-\s](\d{4,5})[_\-\s\.]",
        r"(\d{4,5})",
        r"(\d{3})",
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return None


def parse_email_date(msg):
    date_str = msg.get("Date", "")
    try:
        return email.utils.parsedate_to_datetime(date_str).date()
    except Exception:
        return datetime.now(IL_TZ).date()


# ── Notifications ─────────────────────────────────────────────────────────────


def notify_error(subject, body):
    if not NOTIFY_EMAIL:
        return
    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = f"[Newspaper Error] {subject}"
        msg["From"] = EMAIL_USER
        msg["To"] = NOTIFY_EMAIL
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(EMAIL_USER, EMAIL_PASS)
            smtp.send_message(msg)
        log.info("Error notification sent to %s", NOTIFY_EMAIL)
    except Exception as exc:
        log.warning("Failed to send notification: %s", exc)


# ── IMAP ──────────────────────────────────────────────────────────────────────


def connect_imap():
    log.info("Connecting to %s:%s", IMAP_HOST, IMAP_PORT)
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    conn.login(EMAIL_USER, EMAIL_PASS)
    log.info("IMAP authenticated")
    return conn


def build_search_criteria():
    parts = ["UNSEEN"]
    if SENDER_FILTER:
        parts += ["FROM", f'"{SENDER_FILTER}"']
    if SUBJECT_FILTER:
        parts += ["SUBJECT", f'"{SUBJECT_FILTER}"']
    return " ".join(parts)


def ensure_imap_folder(conn, folder):
    status, data = conn.list()
    if data and any(folder.encode() in (f or b"") for f in data):
        return
    conn.create(folder)
    log.info("Created IMAP folder: %s", folder)


def fetch_candidate_emails(conn):
    """Return [(uid, msg), ...] for unseen emails with PDF attachments."""
    conn.select("INBOX")
    criteria = build_search_criteria()
    log.info("IMAP search: %s", criteria)
    status, data = conn.uid("search", None, criteria)
    if status != "OK" or not data[0]:
        log.info("No new emails found")
        return []

    uids = data[0].split()
    log.info("Found %d candidate email(s)", len(uids))
    results = []

    for uid in uids:
        status, msg_data = conn.uid("fetch", uid, "(RFC822)")
        if status != "OK":
            continue
        msg = email.message_from_bytes(msg_data[0][1], policy=policy.default)
        if _has_pdf(msg):
            results.append((uid, msg))
        else:
            log.info("Email UID %s: no PDF, skipping", uid.decode())

    return results


def _has_pdf(msg):
    for part in msg.walk():
        ct = part.get_content_type()
        fn = part.get_filename() or ""
        if ct == "application/pdf" or fn.lower().endswith(".pdf"):
            return True
    return False


def extract_pdf_attachment(msg):
    """Return (filename, bytes) of first PDF attachment."""
    for part in msg.walk():
        fn = decode_str(part.get_filename() or "")
        ct = part.get_content_type()
        if ct == "application/pdf" or fn.lower().endswith(".pdf"):
            return (fn or "newspaper.pdf"), part.get_payload(decode=True)
    return None, None


def mark_email_processed(conn, uid):
    ensure_imap_folder(conn, PROCESSED_FOLDER)
    conn.uid("copy", uid, PROCESSED_FOLDER)
    conn.uid("store", uid, "+FLAGS", "\\Deleted")
    conn.expunge()
    log.info("Email UID %s moved to %s", uid.decode(), PROCESSED_FOLDER)


# ── PDF helpers ───────────────────────────────────────────────────────────────


def save_pdf_and_thumb(pdf_bytes, issue_dir):
    """
    Save the original PDF (vector quality for PDF.js) and generate a thumbnail
    by rasterizing only the first page. Returns page count.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)

    try:
        # Count pages and render first page for thumbnail
        log.info("Rendering first page for thumbnail at %d DPI …", FLATTEN_DPI)
        pages = convert_from_path(
            str(tmp_path),
            dpi=FLATTEN_DPI,
            fmt="jpeg",
            first_page=1,
            last_page=1,
            thread_count=1,
        )
        if not pages:
            raise ValueError("PDF produced no pages")

        # Get total page count via pdfinfo (fast)
        try:
            from pdf2image import pdfinfo_from_path
            total = int(pdfinfo_from_path(str(tmp_path)).get("Pages", len(pages)))
        except Exception:
            total = len(pages)

        log.info("PDF has %d pages", total)

    finally:
        # Save original PDF (vector quality) — PDF.js renders it at any zoom
        pdf_dest = issue_dir / "issue.pdf"
        pdf_dest.write_bytes(pdf_bytes)
        log.info("Original PDF saved: %s", pdf_dest)
        tmp_path.unlink(missing_ok=True)

    # Thumbnail from first page render
    thumb = issue_dir / "thumb.jpg"
    img   = pages[0].copy()
    new_h = int(img.height * THUMB_WIDTH / img.width)
    img.resize((THUMB_WIDTH, new_h), Image.LANCZOS).save(
        str(thumb), "JPEG", quality=82, optimize=True
    )
    log.info("Thumbnail: %s", thumb)

    return total


def file_size_mb(path):
    return round(Path(path).stat().st_size / (1024 * 1024), 1)


def trim_old_issues(manifest):
    """Delete oldest issues beyond MAX_ISSUES, save manifest if anything pruned."""
    pruned = 0
    while len(manifest["issues"]) > MAX_ISSUES:
        old     = manifest["issues"].pop()   # oldest is last (newest-first list)
        year    = old["date"][:4]
        old_dir = STORAGE_BASE / year / f"issue-{old['number']}"
        if old_dir.exists():
            shutil.rmtree(str(old_dir), ignore_errors=True)
            log.info("Pruned old issue %s (%s)", old["id"], old_dir)
        pruned += 1
    if pruned:
        save_manifest(manifest)
        log.info("Pruned %d old issue(s), %d remaining", pruned, len(manifest["issues"]))


# ── Manifest ──────────────────────────────────────────────────────────────────


def load_manifest():
    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            log.warning("Could not parse manifest, starting fresh")
    return {
        "updated": "",
        "newspaper_name": NEWSPAPER_NAME,
        "tagline": NEWSPAPER_TAGLINE,
        "issues": [],
    }


def save_manifest(manifest):
    manifest["updated"] = datetime.now(IL_TZ).isoformat()
    manifest["newspaper_name"] = NEWSPAPER_NAME
    manifest["tagline"] = NEWSPAPER_TAGLINE
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    tmp.replace(MANIFEST_FILE)
    log.info("Manifest saved: %s (%d issues)", MANIFEST_FILE, len(manifest["issues"]))


def issue_exists(manifest, issue_id):
    return any(i["id"] == issue_id for i in manifest["issues"])


# ── Core pipeline ─────────────────────────────────────────────────────────────


def process_email(uid, msg, manifest):
    subject = decode_str(msg.get("Subject", ""))
    log.info("Processing: %r", subject)

    filename, pdf_bytes = extract_pdf_attachment(msg)
    if not pdf_bytes:
        log.warning("Could not extract PDF payload")
        return False

    log.info("PDF: %r  size=%s bytes", filename, f"{len(pdf_bytes):,}")

    issue_num = parse_issue_number(filename) or parse_issue_number(subject)
    issue_date = parse_email_date(msg)
    year = issue_date.year

    if issue_num is None:
        # Fallback: YYWW composite number
        week = issue_date.isocalendar()[1]
        issue_num = int(f"{year % 100}{week:02d}")
        log.warning("No issue number found — using generated: %d", issue_num)

    issue_id = f"{year}-{issue_num}"
    if issue_exists(manifest, issue_id):
        log.info("Issue %s already in manifest — skipping", issue_id)
        return True

    issue_dir = STORAGE_BASE / str(year) / f"issue-{issue_num}"
    issue_dir.mkdir(parents=True, exist_ok=True)

    try:
        num_pages = save_pdf_and_thumb(pdf_bytes, issue_dir)
        size_mb   = file_size_mb(issue_dir / "issue.pdf")

        entry = {
            "id":       issue_id,
            "number":   issue_num,
            "date":     issue_date.isoformat(),
            "title":    f"גיליון {issue_num}",
            "pages":    num_pages,
            "path":     f"newspaper/{year}/issue-{issue_num}/",
            "thumb":    f"newspaper/{year}/issue-{issue_num}/thumb.jpg",
            "pdf":      f"newspaper/{year}/issue-{issue_num}/issue.pdf",
            "size_mb":  size_mb,
        }
        manifest["issues"].insert(0, entry)  # newest first
        save_manifest(manifest)
        trim_old_issues(manifest)
        log.info("Done: issue=%s pages=%d size=%sMB", issue_id, num_pages, size_mb)
        return True

    except Exception:
        shutil.rmtree(issue_dir, ignore_errors=True)
        raise


# ── Entry point ───────────────────────────────────────────────────────────────


def main():
    log.info("=== Newspaper fetch started ===")
    errors = []
    conn = None

    try:
        conn = connect_imap()
        candidates = fetch_candidate_emails(conn)
        if not candidates:
            log.info("Nothing to process")
            return

        manifest = load_manifest()
        for uid, msg in candidates:
            try:
                process_email(uid, msg, manifest)
                mark_email_processed(conn, uid)
            except Exception as exc:
                err = f"UID {uid.decode()}: {exc}"
                log.error(err, exc_info=True)
                errors.append(err)

    except Exception as exc:
        log.error("Fatal: %s", exc, exc_info=True)
        errors.append(str(exc))
    finally:
        if conn:
            try:
                conn.logout()
            except Exception:
                pass

    if errors:
        notify_error("Processing failed", "Errors:\n" + "\n".join(errors))
        sys.exit(1)

    log.info("=== Done ===")


if __name__ == "__main__":
    main()
