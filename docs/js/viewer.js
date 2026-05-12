// viewer.js — StPageFlip flipbook viewer with progressive image loading
'use strict';

const Viewer = (() => {
  let pageFlip = null;
  let currentIssue = null;

  const PRELOAD_COUNT = () => NEWSPAPER_CONFIG.preloadPages || 6;
  const READ_AHEAD    = () => NEWSPAPER_CONFIG.readAheadPages || 8;

  // ── URL helpers ────────────────────────────────────────────────────────────

  function pageUrl(issue, n) {
    const padded = String(n).padStart(3, '0');
    return `${NEWSPAPER_CONFIG.storageBase}/${issue.path}page-${padded}.jpg`;
  }

  // ── Lazy image loading ─────────────────────────────────────────────────────

  function loadImage(img) {
    if (img.src || !img.dataset.lazySrc) return;
    img.src = img.dataset.lazySrc;
  }

  function loadPagesAround(center) {
    if (!currentIssue) return;
    const start = Math.max(1, center - READ_AHEAD());
    const end   = Math.min(currentIssue.pages, center + READ_AHEAD());
    const container = document.getElementById('flipbook-container');
    for (let i = start; i <= end; i++) {
      const img = container.querySelector(`[data-page-num="${i}"] img`);
      if (img) loadImage(img);
    }
  }

  // ── Flipbook size calculation ──────────────────────────────────────────────

  async function measureFirstPage(issue) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 794, h: 1123 });  // A4 fallback
      img.src = pageUrl(issue, 1);
    });
  }

  function computeDimensions(naturalW, naturalH) {
    const wrap = document.getElementById('flipbook-wrap');
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    const isMobile = wrapW < 768;

    // Desktop: two pages side by side; mobile: single page
    const slotsWide = isMobile ? 1 : 2;
    const pageW = Math.floor(wrapW / slotsWide * 0.92);
    const pageH = Math.floor(pageW * naturalH / naturalW);

    // Clamp to wrap height
    if (pageH > wrapH * 0.95) {
      const clampedH = Math.floor(wrapH * 0.95);
      const clampedW = Math.floor(clampedH * naturalW / naturalH);
      return { pageW: clampedW, pageH: clampedH };
    }

    return { pageW, pageH };
  }

  // ── Build page elements ────────────────────────────────────────────────────

  function buildPageDivs(issue) {
    const divs = [];
    for (let i = 1; i <= issue.pages; i++) {
      const div = document.createElement('div');
      div.className = 'flip-page';
      div.dataset.pageNum = i;

      const img = document.createElement('img');
      img.alt = `דף ${i}`;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;background:#e8e2d4;';

      if (i <= PRELOAD_COUNT()) {
        img.src = pageUrl(issue, i);
      } else {
        img.dataset.lazySrc = pageUrl(issue, i);
      }

      div.appendChild(img);
      divs.push(div);
    }
    return divs;
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function updatePageIndicator(pageIndex) {
    if (!currentIssue) return;
    const el = document.getElementById('page-indicator');
    const displayPage = pageIndex + 1;
    el.textContent = `דף ${displayPage} מתוך ${currentIssue.pages}`;
  }

  function updateNavButtons() {
    if (!pageFlip) return;
    const cur = pageFlip.getCurrentPageIndex();
    document.getElementById('btn-prev').disabled = cur <= 0;
    document.getElementById('btn-next').disabled = cur >= currentIssue.pages - 1;
  }

  // ── Open ───────────────────────────────────────────────────────────────────

  async function open(issue) {
    currentIssue = issue;

    // Destroy previous instance
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }

    const container = document.getElementById('flipbook-container');
    container.innerHTML = '';

    window.App.showLoading(`טוען גיליון ${issue.number}...`);
    window.App._showViewInternal('viewer');

    const { w, h } = await measureFirstPage(issue);
    const { pageW, pageH } = computeDimensions(w, h);

    // Build all page divs, attach to container temporarily for StPageFlip
    const pageDivs = buildPageDivs(issue);
    const pageHolder = document.createElement('div');
    pageDivs.forEach(d => pageHolder.appendChild(d));
    container.appendChild(pageHolder);

    pageFlip = new St.PageFlip(container, {
      width:               pageW,
      height:              pageH,
      size:                'fixed',
      drawShadow:          true,
      flippingTime:        650,
      usePortrait:         true,    // single page on narrow screens
      startZIndex:         1,
      autoSize:            false,
      maxShadowOpacity:    0.4,
      showCover:           false,
      mobileScrollSupport: false,
      clickEventForward:   true,
      useMouseEvents:      true,
      swipeDistance:       30,
      rtl:                 true,    // Hebrew: right-to-left reading order
    });

    pageFlip.loadFromHTML(pageDivs);

    pageFlip.on('flip', (e) => {
      updatePageIndicator(e.data);
      loadPagesAround(e.data + 1);
      updateNavButtons();
    });

    pageFlip.on('init', () => {
      updatePageIndicator(0);
      loadPagesAround(1);
      updateNavButtons();
      window.App._showViewInternal('viewer');
    });
  }

  function close() {
    if (pageFlip) {
      try { pageFlip.destroy(); } catch (_) {}
      pageFlip = null;
    }
    currentIssue = null;
    document.getElementById('flipbook-container').innerHTML = '';
  }

  function next() {
    if (pageFlip) pageFlip.flipNext();
  }

  function prev() {
    if (pageFlip) pageFlip.flipPrev();
  }

  function toggleFullscreen() {
    const el = document.getElementById('viewer-view');
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    const viewerVisible = !document.getElementById('viewer-view').classList.contains('hidden');
    if (!viewerVisible) return;

    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown'  || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')                      { e.preventDefault(); prev(); }
    if (e.key === 'Escape')                                                  { window.App.showArchive(); }
    if (e.key === 'f' || e.key === 'F')                                      { toggleFullscreen(); }
  });

  // ── Wire up toolbar buttons ────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-prev').addEventListener('click', prev);
    document.getElementById('btn-next').addEventListener('click', next);
    document.getElementById('btn-back').addEventListener('click', () => window.App.showArchive());
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  });

  return { open, close, next, prev, toggleFullscreen };
})();
