#!/usr/bin/env python3
"""Admin upload API — protected by Bearer token."""
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pdf2image import convert_from_path
from PIL import Image

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("admin_api")

UPLOAD_TOKEN  = os.getenv("UPLOAD_TOKEN", "")
NEWSPAPER_DIR = Path(os.getenv("STORAGE_PATH", "/var/www/newspaper"))
FLATTEN_DPI   = int(os.getenv("JPG_DPI", "150"))
THUMB_WIDTH   = int(os.getenv("THUMB_WIDTH", "300"))

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://emanuel-sheli.israelcodes.ovh"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def require_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer ") or authorization[7:] != UPLOAD_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")


def load_manifest() -> dict:
    path = NEWSPAPER_DIR / "manifest.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"issues": []}


def save_manifest(manifest: dict):
    path = NEWSPAPER_DIR / "manifest.json"
    manifest["updated"] = datetime.now(timezone.utc).astimezone().isoformat()
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/issues")
def get_issues(_=Depends(require_token)):
    return load_manifest()


@app.post("/api/upload")
async def upload_issue(
    file: UploadFile = File(...),
    number: int = Form(...),
    date: str = Form(...),
    title: Optional[str] = Form(None),
    _=Depends(require_token),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    year = date.split("-")[0]
    issue_dir = NEWSPAPER_DIR / year / f"issue-{number}"
    issue_dir.mkdir(parents=True, exist_ok=True)

    pdf_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = Path(tmp.name)

    try:
        log.info("Rasterizing issue %s at %d DPI …", number, FLATTEN_DPI)
        spreads = convert_from_path(str(tmp_path), dpi=FLATTEN_DPI, fmt="jpeg", thread_count=2)
        if not spreads:
            raise HTTPException(500, "PDF produced no pages")

        # Each PDF page is a double-page spread; split down the middle.
        # Right half is the earlier page in Hebrew (RTL), so it goes first.
        pages = []
        for spread in spreads:
            w, h = spread.size
            mid = w // 2
            pages.append(spread.crop((mid, 0, w,   h)))  # right half — earlier page
            pages.append(spread.crop((0,   0, mid, h)))  # left half  — later page

        thumb = issue_dir / "thumb.jpg"
        img = pages[0].copy()
        new_h = int(img.height * THUMB_WIDTH / img.width)
        img.resize((THUMB_WIDTH, new_h), Image.LANCZOS).save(str(thumb), "JPEG", quality=82, optimize=True)

        pdf_dest = issue_dir / "issue.pdf"
        rgb_pages = [p.convert("RGB") for p in pages]
        rgb_pages[0].save(str(pdf_dest), "PDF", save_all=True,
                          append_images=rgb_pages[1:], resolution=FLATTEN_DPI)

        size_mb = round(pdf_dest.stat().st_size / (1024 * 1024), 1)
        log.info("Issue %s saved: %d spreads → %d pages, %.1f MB", number, len(spreads), len(pages), size_mb)

    finally:
        tmp_path.unlink(missing_ok=True)

    manifest = load_manifest()
    issues = [i for i in manifest.get("issues", []) if i.get("number") != number]
    issues.insert(0, {
        "id": f"{year}-{number}",
        "number": number,
        "date": date,
        "title": title or f"גיליון {number}",
        "pages": len(pages),
        "path": f"newspaper/{year}/issue-{number}/",
        "thumb": f"newspaper/{year}/issue-{number}/thumb.jpg",
        "pdf": f"newspaper/{year}/issue-{number}/issue.pdf",
        "size_mb": size_mb,
    })
    issues.sort(key=lambda x: x["number"], reverse=True)
    manifest["issues"] = issues
    save_manifest(manifest)

    return {"ok": True, "number": number, "pages": len(pages), "size_mb": size_mb}


@app.delete("/api/issues/{issue_id}")
def delete_issue(issue_id: str, _=Depends(require_token)):
    manifest = load_manifest()
    before = len(manifest.get("issues", []))
    manifest["issues"] = [i for i in manifest.get("issues", []) if i.get("id") != issue_id]
    if len(manifest["issues"]) == before:
        raise HTTPException(404, "Issue not found")
    save_manifest(manifest)
    return {"ok": True, "deleted": issue_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8082, log_level="info")
