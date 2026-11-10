#!/usr/bin/env python3
"""
Newspaper pipeline — turns a newspaper PDF into web pages for the site.

Sources:
  inbox   Publish every PDF in the repository's inbox/ folder, then delete it.
          PDFs get there from the Cloudflare email worker (cloudflare/email-worker)
          or from a manual upload through the GitHub web UI.
  file    Publish a single local PDF:  file path/to.pdf [--number N] [--date YYYY-MM-DD]

Output (inside the static site, deployed by Vercel):
  public/newspaper/manifest.json
  public/newspaper/<year>/issue-<n>/thumb.jpg
  public/newspaper/<year>/issue-<n>/pages/page-001.jpg …

Configuration is read from environment variables (see config.example.env).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import shutil
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from PIL import Image
from pdf2image import convert_from_path, pdfinfo_from_path

ROOT = Path(__file__).resolve().parent.parent
IL_TZ = timezone(timedelta(hours=2))

# ── Config ────────────────────────────────────────────────────────────────────


def env(key: str, default: str = "") -> str:
    return (os.getenv(key) or default).strip()


SITE_DIR         = Path(env("SITE_DIR", str(ROOT / "public")))
STORAGE_DIR      = SITE_DIR / "newspaper"
MANIFEST_FILE    = STORAGE_DIR / "manifest.json"
INBOX_DIR        = Path(env("INBOX_DIR", str(ROOT / "inbox")))
NEWSPAPER_NAME   = env("NEWSPAPER_NAME", "עמנואל שלי")
NEWSPAPER_TAGLINE = env("NEWSPAPER_TAGLINE", "")
PAGE_HEIGHT      = int(env("PAGE_HEIGHT", "1800"))   # px height of each saved page
JPG_QUALITY      = int(env("JPG_QUALITY", "80"))
THUMB_WIDTH      = int(env("THUMB_WIDTH", "400"))
PAGE_THUMB_WIDTH = int(env("PAGE_THUMB_WIDTH", "200"))   # small per-page thumbnails (page picker)
MAX_ISSUES       = int(env("MAX_ISSUES", "11"))      # 0 = keep everything
SPREAD_RATIO     = float(env("SPREAD_RATIO", "1.0"))  # width/height above this = double page

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("newspaper")


# ── Helpers ───────────────────────────────────────────────────────────────────


def parse_issue_number(text: str) -> int | None:
    """Find an issue number in a filename/subject, ignoring years and dates."""
    if not text:
        return None
    text = re.sub(r"\.pdf$", "", text, flags=re.I)
    for m in re.finditer(r"(?:גיליון|גליון|issue|no\.?|#)\s*[-#:]?\s*(\d{1,5})", text, re.I):
        n = int(m.group(1))
        if not (1990 <= n <= 2100 or 5700 <= n <= 5900):
            return n
    # Drop dates such as 07.12.25 / 2025-12-07 / 7/12/2025 before looking for plain numbers
    text = re.sub(r"\d{1,4}[./\-_]\d{1,2}[./\-_]\d{1,4}", " ", text)
    for num in re.findall(r"(?<!\d)(\d{2,5})(?!\d)", text):
        n = int(num)
        if 1990 <= n <= 2100 or 5700 <= n <= 5900:   # Gregorian / Hebrew years
            continue
        return n
    return None


# ── Manifest ──────────────────────────────────────────────────────────────────


def load_manifest() -> dict:
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    return {"issues": []}


def save_manifest(manifest: dict) -> None:
    manifest["updated"] = datetime.now(IL_TZ).isoformat(timespec="seconds")
    manifest["newspaper_name"] = NEWSPAPER_NAME
    if NEWSPAPER_TAGLINE:
        manifest["tagline"] = NEWSPAPER_TAGLINE
    manifest["issues"].sort(key=lambda i: (i["date"], i["number"]), reverse=True)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(MANIFEST_FILE)
    log.info("Manifest saved (%d issues)", len(manifest["issues"]))


def prune(manifest: dict) -> None:
    if MAX_ISSUES <= 0:
        return
    while len(manifest["issues"]) > MAX_ISSUES:
        old = manifest["issues"].pop()
        shutil.rmtree(SITE_DIR / old["path"], ignore_errors=True)
        log.info("Pruned old issue %s", old["id"])


def next_issue_number(manifest: dict) -> int:
    nums = [i["number"] for i in manifest["issues"]]
    return (max(nums) + 1) if nums else 1


# ── PDF → pages ───────────────────────────────────────────────────────────────


def render_pages(pdf_path: Path) -> list[Image.Image]:
    """Render every PDF page; split double-page spreads into two pages (RTL order)."""
    info = pdfinfo_from_path(str(pdf_path))
    count = int(info["Pages"])
    log.info("PDF has %d page(s)", count)
    pages: list[Image.Image] = []
    for n in range(1, count + 1):
        img = convert_from_path(
            str(pdf_path), first_page=n, last_page=n, size=(None, PAGE_HEIGHT), thread_count=1
        )[0].convert("RGB")
        w, h = img.size
        if w / h > SPREAD_RATIO:
            mid = w // 2
            # Hebrew: the right half comes first in reading order
            pages.append(img.crop((mid, 0, w, h)))
            pages.append(img.crop((0, 0, mid, h)))
            log.info("  page %d: spread → split in two", n)
        else:
            pages.append(img)
    return pages


def save_page_thumb(page: Image.Image, dest: Path) -> None:
    h = round(page.height * PAGE_THUMB_WIDTH / page.width)
    page.resize((PAGE_THUMB_WIDTH, h), Image.LANCZOS).save(dest, "JPEG", quality=72, optimize=True)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cover_hash(img: Image.Image) -> str:
    """64-bit average hash of the cover — survives re-exporting/re-compressing the PDF."""
    small = img.convert("L").resize((8, 8), Image.LANCZOS)
    px = list(small.getdata())
    avg = sum(px) / len(px)
    return f"{sum(1 << i for i, v in enumerate(px) if v >= avg):016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def find_duplicate(manifest: dict, sha: str, pages: list[Image.Image] | None = None) -> dict | None:
    """An already published issue with the same file, or the same page count + cover."""
    for issue in manifest["issues"]:
        if issue.get("sha256") == sha:
            return issue
    if pages is None:
        return None
    ch = cover_hash(pages[0])
    for issue in manifest["issues"]:
        if issue.get("pages") != len(pages):
            continue
        known = issue.get("cover_hash")
        if not known:
            cover_file = SITE_DIR / issue["path"] / "pages" / "page-001.jpg"
            if not cover_file.exists():
                continue
            known = issue["cover_hash"] = cover_hash(Image.open(cover_file))
        if hamming(ch, known) <= 4:
            return issue
    return None


def publish_pdf(pdf_path: Path, manifest: dict, *, number: int | None, issue_date: date,
                title: str | None = None, replace: bool = False) -> dict | None:
    # 1. Exact same file already published?
    sha = file_sha256(pdf_path)
    dup = find_duplicate(manifest, sha)
    if dup:
        log.info("Same file as issue %s — skipping", dup["number"])
        return None

    # 2. Same issue in a different file (same page count + same cover)?
    pages = render_pages(pdf_path)
    if not pages:
        raise ValueError("PDF produced no pages")
    dup = find_duplicate(manifest, sha, pages)
    if dup:
        log.info("Same content as issue %s (%d pages, same cover) — skipping", dup["number"], len(pages))
        return None

    number = number or next_issue_number(manifest)
    issue_id = f"{issue_date.year}-{number}"
    existing = [i for i in manifest["issues"] if i["number"] == number]
    if existing and not replace:
        log.info("Issue %s already published — skipping", number)
        return None
    for old in existing:   # same number, different content → treat as a correction
        log.info("Replacing issue %s with the new file", number)
        shutil.rmtree(SITE_DIR / old["path"], ignore_errors=True)
        manifest["issues"].remove(old)

    rel = f"newspaper/{issue_date.year}/issue-{number}/"
    issue_dir = SITE_DIR / rel
    if issue_dir.exists():
        shutil.rmtree(issue_dir)
    pages_dir = issue_dir / "pages"
    pages_dir.mkdir(parents=True)

    try:
        thumbs_dir = pages_dir / "thumbs"
        thumbs_dir.mkdir()
        for i, page in enumerate(pages, 1):
            page.save(pages_dir / f"page-{i:03d}.jpg", "JPEG",
                      quality=JPG_QUALITY, optimize=True, progressive=True)
            save_page_thumb(page, thumbs_dir / f"page-{i:03d}.jpg")
        cover = pages[0]
        thumb_h = round(cover.height * THUMB_WIDTH / cover.width)
        cover.resize((THUMB_WIDTH, thumb_h), Image.LANCZOS).save(
            issue_dir / "thumb.jpg", "JPEG", quality=85, optimize=True, progressive=True)
        # A larger cover for the home page "featured" image
        cw = min(900, cover.width)
        cover.resize((cw, round(cover.height * cw / cover.width)), Image.LANCZOS).save(
            issue_dir / "cover.jpg", "JPEG", quality=85, optimize=True, progressive=True)
    except Exception:
        shutil.rmtree(issue_dir, ignore_errors=True)
        raise

    size_mb = round(sum(f.stat().st_size for f in issue_dir.rglob("*.jpg")) / 1048576, 1)
    entry = {
        "id": issue_id,
        "number": number,
        "date": issue_date.isoformat(),
        "title": title or f"גיליון {number}",
        "pages": len(pages),
        "page_width": pages[1 if len(pages) > 1 else 0].width,
        "page_height": pages[0].height,
        "path": rel,
        "thumb": rel + "thumb.jpg",
        "cover": rel + "cover.jpg",
        "page_thumbs": True,
        "sha256": sha,
        "cover_hash": cover_hash(pages[0]),
        "size_mb": size_mb,
    }
    manifest["issues"].append(entry)
    save_manifest(manifest)
    prune(manifest)
    save_manifest(manifest)
    log.info("Published issue %s: %d pages, %.1f MB", number, len(pages), size_mb)
    return entry


# ── Sources ───────────────────────────────────────────────────────────────────


def run_inbox(manifest: dict) -> int:
    published = 0
    for pdf in sorted(INBOX_DIR.glob("*.pdf")) + sorted(INBOX_DIR.glob("*.PDF")):
        num = parse_issue_number(pdf.name)
        m = re.search(r"(20\d\d)-(\d\d)-(\d\d)", pdf.name)
        d = date(*map(int, m.groups())) if m else datetime.now(IL_TZ).date()
        log.info("Inbox file %s", pdf.name)
        if publish_pdf(pdf, manifest, number=num, issue_date=d, replace=True):
            published += 1
        pdf.unlink()
    return published


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inbox")
    f = sub.add_parser("file")
    f.add_argument("pdf", type=Path)
    f.add_argument("--number", type=int)
    f.add_argument("--date", type=date.fromisoformat)
    f.add_argument("--title")
    args = ap.parse_args()

    manifest = load_manifest()
    if args.cmd == "file":
        publish_pdf(args.pdf, manifest,
                    number=args.number or parse_issue_number(args.pdf.name),
                    issue_date=args.date or datetime.now(IL_TZ).date(),
                    title=args.title, replace=True)
        return
    log.info("Done — %d new issue(s)", run_inbox(manifest))


if __name__ == "__main__":
    main()
