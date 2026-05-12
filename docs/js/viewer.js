// viewer.js — PDF.js single-page RTL newspaper viewer
'use strict';

const Viewer = (() => {
  const PDFJS = window['pdfjs-dist/build/pdf'];
  PDFJS.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let pdfDoc       = null;
  let totalPages   = 0;
  let currentPage  = 1;
  let currentIssue = null;
  let rendering    = false;

  // ── Rendering ──────────────────────────────────────────────────────────────

  async function renderPage(pageNum) {
    const canvas = document.getElementById('canvas-right');
    if (!canvas || !pdfDoc || pageNum < 1 || pageNum > totalPages) return;

    const page   = await pdfDoc.getPage(pageNum);
    const spread = document.getElementById('spread-container');

    // Fill the full available area — nav buttons float on top so use full dimensions
    const availW = spread.clientWidth  - 4;
    const availH = spread.clientHeight - 4;

    const base  = page.getViewport({ scale: 1 });
    const scale = Math.min(availW / base.width, availH / base.height);

    const vp = page.getViewport({ scale });
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
  }

  async function renderSpread(pageNum) {
    if (rendering) return;
    rendering = true;

    // Second canvas not needed — each PDF page is already a full newspaper spread
    document.getElementById('canvas-left').style.display = 'none';

    try {
      await renderPage(pageNum);
      updateIndicator(pageNum);
      updateNavButtons();
    } finally {
      rendering = false;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goNext() {
    // ❯ right button = advance forward (higher page numbers)
    if (currentPage < totalPages) {
      currentPage += 1;
      renderSpread(currentPage);
    }
  }

  function goPrev() {
    // ❮ left button = go back (lower page numbers)
    if (currentPage > 1) {
      currentPage -= 1;
      renderSpread(currentPage);
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function updateIndicator(pageNum) {
    const el = document.getElementById('page-indicator');
    if (el) el.textContent = `דף ${pageNum} מתוך ${totalPages}`;
  }

  function updateNavButtons() {
    const btnLeft  = document.getElementById('btn-nav-left');   // ❮ = next page (forward in Hebrew)
    const btnRight = document.getElementById('btn-nav-right');  // ❯ = prev page (back)
    if (btnLeft)  btnLeft.disabled  = currentPage >= totalPages;
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
    document.getElementById('btn-nav-left').addEventListener('click', goNext);   // ❮ = next page (Hebrew: forward is left)
    document.getElementById('btn-nav-right').addEventListener('click', goPrev);  // ❯ = prev page
    document.getElementById('btn-back').addEventListener('click', () => window.App.showHome());
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  });

  return { open, close, toggleFullscreen };
})();
