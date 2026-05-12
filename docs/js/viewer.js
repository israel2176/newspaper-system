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
  let zoomScale    = 1;

  // ── Rendering ──────────────────────────────────────────────────────────────

  async function renderPage(pageNum) {
    const canvas = document.getElementById('canvas-right');
    if (!canvas || !pdfDoc || pageNum < 1 || pageNum > totalPages) return;

    const page   = await pdfDoc.getPage(pageNum);
    const spread = document.getElementById('spread-container');

    // Base scale to fit the page when not zoomed; multiply by zoomScale
    const wrap   = document.getElementById('spread-wrap');
    const availW = wrap.clientWidth  - 4;
    const availH = wrap.clientHeight - 4;

    const base      = page.getViewport({ scale: 1 });
    const baseScale = Math.min(availW / base.width, availH / base.height);
    const scale     = baseScale * zoomScale;

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

    document.getElementById('canvas-left').style.display = 'none';
    applyZoomState();

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
    if (currentPage < totalPages) {
      currentPage += 1;
      zoomScale = 1;
      renderSpread(currentPage);
    }
  }

  function goPrev() {
    if (currentPage > 1) {
      currentPage -= 1;
      zoomScale = 1;
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

  // ── Zoom ───────────────────────────────────────────────────────────────────

  function applyZoomState() {
    const wrap = document.getElementById('spread-wrap');
    const container = document.getElementById('spread-container');
    const canvas    = document.getElementById('canvas-right');
    if (zoomScale > 1) {
      wrap.style.overflow        = 'auto';
      wrap.style.alignItems      = 'flex-start';
      wrap.style.justifyContent  = 'flex-start';
      container.style.width      = 'auto';
      container.style.height     = 'auto';
      container.style.minWidth   = '100%';
      canvas.style.cursor        = 'zoom-out';
    } else {
      wrap.style.overflow        = 'hidden';
      wrap.style.alignItems      = 'center';
      wrap.style.justifyContent  = 'center';
      container.style.width      = '100%';
      container.style.height     = '100%';
      container.style.minWidth   = '';
      canvas.style.cursor        = 'zoom-in';
    }
  }

  function resetZoom() {
    zoomScale = 1;
    applyZoomState();
  }

  function setupZoom() {
    const canvas = document.getElementById('canvas-right');
    canvas.style.cursor = 'zoom-in';

    canvas.addEventListener('click', async (e) => {
      const wrap = document.getElementById('spread-wrap');
      if (zoomScale === 1) {
        // Remember click position relative to canvas, then zoom
        const rect   = canvas.getBoundingClientRect();
        const ratioX = (e.clientX - rect.left) / rect.width;
        const ratioY = (e.clientY - rect.top)  / rect.height;
        zoomScale = 2.5;
        applyZoomState();
        await renderPage(currentPage);
        // Scroll so the clicked area stays visible
        const newRect = canvas.getBoundingClientRect();
        wrap.scrollLeft = ratioX * canvas.clientWidth  - wrap.clientWidth  / 2;
        wrap.scrollTop  = ratioY * canvas.clientHeight - wrap.clientHeight / 2;
      } else {
        zoomScale = 1;
        applyZoomState();
        await renderPage(currentPage);
      }
    });

    // Pinch-to-zoom on touch
    let lastDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2)
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
    }, { passive: true });
    canvas.addEventListener('touchmove', async (e) => {
      if (e.touches.length !== 2) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newZoom = Math.max(1, Math.min(4, zoomScale * (dist / lastDist)));
      lastDist = dist;
      if (Math.abs(newZoom - zoomScale) > 0.05) {
        zoomScale = newZoom;
        applyZoomState();
        await renderPage(currentPage);
      }
    }, { passive: true });
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
      setupZoom();
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
