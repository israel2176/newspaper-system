// viewer.js — PDF.js RTL newspaper viewer (no image conversion needed)
'use strict';

const Viewer = (() => {
  const PDFJS = window['pdfjs-dist/build/pdf'];
  PDFJS.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let pdfDoc      = null;
  let totalPages  = 0;
  let currentPage = 1;   // right-side page number (RTL: page 1 is on the RIGHT)
  let currentIssue = null;
  let rendering   = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isMobile() { return window.innerWidth < 768; }

  function spreadSize() { return isMobile() ? 1 : 2; }

  // ── Rendering ──────────────────────────────────────────────────────────────

  async function renderOnePage(pageNum, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !pdfDoc || pageNum < 1 || pageNum > totalPages) return;

    const page   = await pdfDoc.getPage(pageNum);
    const spread = document.getElementById('spread-container');

    // Fit page into half the spread width (or full width on mobile)
    const slots    = isMobile() ? 1 : 2;
    const availW   = Math.floor((spread.clientWidth - 16) / slots);
    const availH   = spread.clientHeight - 4;

    const base   = page.getViewport({ scale: 1 });
    const scaleW = availW / base.width;
    const scaleH = availH / base.height;
    const scale  = Math.min(scaleW, scaleH);  // fit without cropping

    const vp = page.getViewport({ scale });
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
  }

  async function renderSpread(rightPage) {
    if (rendering) return;
    rendering = true;

    const leftPage  = rightPage + 1;
    const mobile    = isMobile();
    const canvasL   = document.getElementById('canvas-left');

    try {
      await renderOnePage(rightPage, 'canvas-right');

      if (!mobile && leftPage <= totalPages) {
        await renderOnePage(leftPage, 'canvas-left');
        canvasL.style.display = 'block';
      } else {
        canvasL.style.display = 'none';
      }

      updateIndicator(rightPage);
      updateNavButtons();
    } finally {
      rendering = false;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goNext() {
    // RTL Hebrew: "next" = go deeper into newspaper = higher page numbers
    const step = spreadSize();
    if (currentPage + step <= totalPages) {
      currentPage += step;
      renderSpread(currentPage);
    }
  }

  function goPrev() {
    const step = spreadSize();
    if (currentPage - step >= 1) {
      currentPage -= step;
      renderSpread(currentPage);
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function updateIndicator(rightPage) {
    const el = document.getElementById('page-indicator');
    if (!el) return;
    const endPage = Math.min(rightPage + spreadSize() - 1, totalPages);
    el.textContent = rightPage === endPage
      ? `דף ${rightPage} מתוך ${totalPages}`
      : `דפים ${rightPage}–${endPage} מתוך ${totalPages}`;
  }

  function updateNavButtons() {
    // LEFT button (❮) = go forward in Hebrew newspaper
    const btnLeft  = document.getElementById('btn-nav-left');
    // RIGHT button (❯) = go back
    const btnRight = document.getElementById('btn-nav-right');
    if (btnLeft)  btnLeft.disabled  = currentPage + spreadSize() > totalPages;
    if (btnRight) btnRight.disabled = currentPage <= 1;
  }

  // ── Open / Close ───────────────────────────────────────────────────────────

  async function open(issue) {
    currentIssue = issue;
    currentPage  = 1;

    if (pdfDoc) { try { pdfDoc.destroy(); } catch (_) {} pdfDoc = null; }

    window.App.showLoading(`טוען גיליון ${issue.number}...`);
    window.App._showViewInternal('viewer');

    const pdfUrl = `${NEWSPAPER_CONFIG.storageBase}/${issue.pdf}`;

    try {
      pdfDoc     = await PDFJS.getDocument({ url: pdfUrl }).promise;
      totalPages = pdfDoc.numPages;
      window.App._showViewInternal('viewer');
      await renderSpread(1);
    } catch (err) {
      console.error('PDF load error:', err);
      window.App.showError('שגיאה בטעינת הגיליון — ' + err.message);
      window.App.showHome();
    }
  }

  function close() {
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (_) {} pdfDoc = null; }
    currentIssue = null;
    totalPages   = 0;
    currentPage  = 1;
    ['canvas-right', 'canvas-left'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { c.width = 0; c.height = 0; }
    });
  }

  function toggleFullscreen() {
    const el = document.getElementById('viewer-view');
    if (!document.fullscreenElement) { el.requestFullscreen().catch(() => {}); }
    else { document.exitFullscreen().catch(() => {}); }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('viewer-view').classList.contains('hidden')) return;
    // RTL: arrow-right = next page, arrow-left = prev page
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
    if (e.key === 'ArrowLeft')                    { e.preventDefault(); goPrev(); }
    if (e.key === 'Escape') { window.App.showHome(); }
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
  });

  // Re-render on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!document.getElementById('viewer-view').classList.contains('hidden') && pdfDoc) {
        renderSpread(currentPage);
      }
    }, 300);
  });

  // ── Wire buttons ───────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-nav-left').addEventListener('click', goNext);   // ❮ left = forward in Hebrew
    document.getElementById('btn-nav-right').addEventListener('click', goPrev);  // ❯ right = back
    document.getElementById('btn-back').addEventListener('click', () => window.App.showHome());
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  });

  return { open, close, toggleFullscreen };
})();
