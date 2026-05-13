// viewer.js — StPageFlip newspaper viewer
'use strict';

const Viewer = (() => {
  let pageFlip    = null;
  let currentIssue = null;

  // ── Indicator & nav buttons ────────────────────────────────────────────────

  function updateIndicator(pageIdx) {
    const el = document.getElementById('page-indicator');
    if (!el || !currentIssue) return;
    el.textContent = `דף ${pageIdx + 1} מתוך ${currentIssue.pages}`;
  }

  function updateNavButtons(pageIdx) {
    const total    = currentIssue ? currentIssue.pages : 0;
    const btnLeft  = document.getElementById('btn-nav-left');
    const btnRight = document.getElementById('btn-nav-right');
    if (btnLeft)  btnLeft.disabled  = pageIdx >= total - 1;
    if (btnRight) btnRight.disabled = pageIdx <= 0;
  }

  // ── Open ───────────────────────────────────────────────────────────────────

  async function open(issue) {
    currentIssue = issue;

    window.App.showLoading(`טוען גיליון ${issue.number}...`);

    const el = document.getElementById('flipbook');
    el.innerHTML = '';

    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }

    // Calculate page dimensions to fit the viewer area
    const wrap   = document.getElementById('flipbook-wrap');
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    const btnSpace = 90; // space for left+right nav buttons
    const A4ratio  = 1 / 0.707; // height / width

    let pageW = Math.floor((availW - btnSpace) / 2);
    let pageH = Math.floor(pageW * A4ratio);
    if (pageH > availH - 16) {
      pageH = availH - 16;
      pageW = Math.floor(pageH / A4ratio);
    }

    // Build ordered image URL list
    const images = Array.from({ length: issue.pages }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return `${NEWSPAPER_CONFIG.storageBase}/${issue.path}pages/page-${n}.jpg`;
    });

    try {
      pageFlip = new St.PageFlip(el, {
        width:        pageW,
        height:       pageH,
        size:         'fixed',
        showCover:    true,
        usePortrait:  availW < 700,
        flippingTime: 700,
        maxShadowOpacity: 0.6,
        mobileScrollSupport: false,
        useMouseEvents: true,
        swipeDistance:  40,
        clickEventForward: false,
      });

      pageFlip.loadFromImages(images);

      pageFlip.on('flip', (e) => {
        updateIndicator(e.data);
        updateNavButtons(e.data);
      });

      window.App._showViewInternal('viewer');
      updateIndicator(0);
      updateNavButtons(0);

    } catch (err) {
      console.error('Flipbook error:', err);
      window.App.showError('שגיאה בטעינת הגיליון — ' + err.message);
      window.App.showHome();
    }
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  function close() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }
    currentIssue = null;
  }

  // ── Fullscreen ─────────────────────────────────────────────────────────────

  function toggleFullscreen() {
    const el = document.getElementById('viewer-view');
    if (!document.fullscreenElement) { el.requestFullscreen().catch(() => {}); }
    else { document.exitFullscreen().catch(() => {}); }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('viewer-view').classList.contains('hidden')) return;
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); pageFlip.flipNext(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); pageFlip.flipPrev(); }
    if (e.key === 'Escape') { window.App.showHome(); }
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
  });

  // Re-open on resize to recalculate dimensions
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!document.getElementById('viewer-view').classList.contains('hidden') && currentIssue) {
        const saved = currentIssue;
        open(saved);
      }
    }, 350);
  });

  // ── Wire buttons ───────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-nav-left').addEventListener('click', () => {
      if (pageFlip) pageFlip.flipNext();
    });
    document.getElementById('btn-nav-right').addEventListener('click', () => {
      if (pageFlip) pageFlip.flipPrev();
    });
    document.getElementById('btn-back').addEventListener('click', () => window.App.showHome());
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  });

  return { open, close, toggleFullscreen };
})();
