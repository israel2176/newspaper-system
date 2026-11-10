// viewer.js — Hebrew (right-to-left) flipbook viewer built on StPageFlip
'use strict';

/*
 * StPageFlip only knows left-to-right books. To get a real Hebrew newspaper
 * (cover on the right side of the spine, pages turning from left to right)
 * the pages are handed to the library in REVERSED order and the book is opened
 * on its last library page. Every "library index" is therefore converted to a
 * Hebrew page number with  hebrew = total - libIdx  (1-based).
 */
const Viewer = (() => {
  let pageFlip     = null;
  let currentIssue = null;
  let libTotal     = 0;      // pages given to the library (incl. padding blank)
  let padded       = false;  // a blank page was added at the end of the Hebrew order
  let portrait     = false;
  let lastSize     = '';
  let currentLib   = 0;

  const $ = (id) => document.getElementById(id);

  // ── Index helpers ──────────────────────────────────────────────────────────

  // library index → Hebrew page number (1-based), null for the padding blank
  function libToHeb(libIdx) {
    const heb = libTotal - libIdx;
    return heb > currentIssue.pages ? null : heb;
  }
  function hebToLib(heb) { return libTotal - heb; }

  function pageUrl(heb) {
    const n = String(heb).padStart(3, '0');
    return `${NEWSPAPER_CONFIG.storageBase}/${currentIssue.path}pages/page-${n}.jpg`;
  }

  // Hebrew page numbers currently visible (ascending)
  function visibleHebPages() {
    if (!pageFlip) return [];
    const idx = pageFlip.getCurrentPageIndex();
    let libs = [idx];
    if (!portrait) {
      // landscape spreads: [0], [1,2], [3,4] … — last page alone when total is even
      if (idx === 0) libs = [0];
      else {
        const start = idx % 2 === 1 ? idx : idx - 1;
        libs = start + 1 < libTotal ? [start, start + 1] : [start];
      }
    }
    return libs.map(libToHeb).filter(Boolean).sort((a, b) => a - b);
  }

  // ── Lazy image loading — only pages near the current spread ────────────────

  function loadAround(libIdx) {
    const radius = NEWSPAPER_CONFIG.readAheadPages || 6;
    document.querySelectorAll('#flipbook img[data-src]').forEach((img) => {
      const i = Number(img.dataset.lib);
      if (Math.abs(i - libIdx) <= radius) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      }
    });
  }

  // ── UI state ───────────────────────────────────────────────────────────────

  function updateUi(libIdx) {
    currentLib = libIdx;
    const pages = visibleHebPages();
    const total = currentIssue.pages;
    const ind = $('page-indicator');
    if (ind) {
      ind.textContent = pages.length > 1
        ? `עמודים ${pages[0]}–${pages[pages.length - 1]} מתוך ${total}`
        : `עמוד ${pages[0] || total} מתוך ${total}`;
    }
    // Left button = next page (Hebrew), right button = previous page
    const atStart = libIdx >= libTotal - 1;   // Hebrew cover
    const atEnd   = libIdx === 0 || pages.includes(total);
    $('btn-nav-left').disabled  = atEnd;
    $('btn-nav-right').disabled = atStart;

    // Center a closed book (front or back cover shown alone in landscape)
    const fb = $('flipbook');
    fb.classList.toggle('fb-cover-front', !portrait && libIdx === libTotal - 1);
    fb.classList.toggle('fb-cover-back',  !portrait && libIdx === 0);

    loadAround(libIdx);
    if (pages[0]) setPageInUrl(pages[0]);
  }

  function setPageInUrl(heb) {
    const url = new URL(window.location.href);
    if (heb > 1) url.searchParams.set('page', heb); else url.searchParams.delete('page');
    history.replaceState(history.state, '', url.toString());
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  function computeSize() {
    const wrap  = $('flipbook-wrap');
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    const ratio  = (currentIssue.page_height && currentIssue.page_width)
      ? currentIssue.page_height / currentIssue.page_width
      : 1.414;

    portrait = availW < 760 || availW / availH < 1.05;
    const sideSpace = portrait ? 12 : 110;
    const perRow    = portrait ? 1 : 2;

    let pageW = Math.floor((availW - sideSpace) / perRow);
    let pageH = Math.floor(pageW * ratio);
    if (pageH > availH - 16) {
      pageH = availH - 16;
      pageW = Math.floor(pageH / ratio);
    }
    return { pageW: Math.max(pageW, 100), pageH: Math.max(pageH, 140), availW, availH };
  }

  function build(startHeb) {
    if (pageFlip) { try { pageFlip.destroy(); } catch (_) {} pageFlip = null; }
    // destroy() removes the element itself — recreate a fresh one
    let fb = $('flipbook');
    if (!fb) {
      fb = document.createElement('div');
      fb.id = 'flipbook';
      $('btn-nav-right').before(fb);
    } else {
      fb.innerHTML = '';
    }

    const { pageW, pageH, availW, availH } = computeSize();
    lastSize = `${availW}x${availH}`;
    fb.style.width  = `${portrait ? pageW : pageW * 2}px`;
    fb.style.height = `${pageH}px`;
    fb.style.setProperty('--page-w', `${pageW}px`);

    // Hebrew order needs an even page count so the cover stays alone
    const n = currentIssue.pages;
    padded   = n % 2 === 1;
    libTotal = n + (padded ? 1 : 0);

    const nodes = [];
    for (let lib = 0; lib < libTotal; lib++) {
      const heb  = libTotal - lib;
      const page = document.createElement('div');
      page.className = 'fb-page';
      const isCover = heb === 1 || heb === n || heb > n;
      page.dataset.density = isCover ? 'hard' : 'soft';
      if (heb <= n) {
        const img = document.createElement('img');
        img.alt = `עמוד ${heb}`;
        img.draggable = false;
        img.decoding = 'async';
        img.dataset.src = pageUrl(heb);
        img.dataset.lib = lib;
        img.dataset.heb = heb;
        page.appendChild(img);
      } else {
        page.classList.add('fb-blank');
      }
      nodes.push(page);
    }
    fb.append(...nodes);

    const startLib = hebToLib(Math.min(Math.max(startHeb || 1, 1), n));
    loadAround(startLib);

    pageFlip = new St.PageFlip(fb, {
      width:  pageW,
      height: pageH,
      size:   'fixed',
      showCover:   true,
      usePortrait: portrait,
      startPage:   startLib,
      flippingTime: 650,
      maxShadowOpacity: 0.45,
      drawShadow: true,
      mobileScrollSupport: false,
      useMouseEvents: true,
      swipeDistance: 30,
      showPageCorners: !portrait,
      disableFlipByClick: true,
      autoSize: false,
    });
    pageFlip.loadFromHTML(nodes);
    pageFlip.on('flip', (e) => updateUi(e.data));
    pageFlip.on('changeOrientation', () => updateUi(pageFlip.getCurrentPageIndex()));
    updateUi(pageFlip.getCurrentPageIndex());
  }

  // ── Open / close ───────────────────────────────────────────────────────────

  function open(issue, startHeb) {
    currentIssue = issue;
    // The viewer must be visible BEFORE measuring, otherwise every size is 0
    window.App._showViewInternal('viewer');
    window.scrollTo(0, 0);
    $('viewer-title').textContent = issue.title || `גיליון ${issue.number}`;
    try {
      build(startHeb || 1);
    } catch (err) {
      console.error('Flipbook error:', err);
      window.App.showError('שגיאה בטעינת הגיליון');
    }
  }

  function close() {
    closeZoom();
    closePages();
    if (pageFlip) { try { pageFlip.destroy(); } catch (_) {} pageFlip = null; }
    currentIssue = null;
  }

  // Hebrew navigation. `disableFlipByClick` (so a tap on a page doesn't flip it)
  // also blocks the library's own flipNext/flipPrev, so lift it for that call.
  function libFlip(dir) {
    if (!pageFlip) return;
    const st = pageFlip.getSettings();
    st.disableFlipByClick = false;
    try { dir < 0 ? pageFlip.flipPrev() : pageFlip.flipNext(); }
    finally { st.disableFlipByClick = true; }
  }
  function next() { libFlip(-1); }
  function prev() { libFlip(1); }

  // ── Zoom overlay ───────────────────────────────────────────────────────────

  let zoomLevel = 1;

  function openZoom(hebPages) {
    if (!currentIssue) return;
    const pages = hebPages && hebPages.length ? hebPages : visibleHebPages();
    if (!pages.length) return;
    const box = $('zoom-pages');
    box.innerHTML = '';
    // RTL: the lower page number sits on the right
    pages.forEach((heb) => {
      const img = document.createElement('img');
      img.src = pageUrl(heb);
      img.alt = `עמוד ${heb}`;
      box.appendChild(img);
    });
    box.dataset.count = pages.length;
    zoomLevel = 1;
    applyZoom();
    $('zoom-overlay').classList.remove('hidden');
    $('zoom-scroll').scrollTo(0, 0);
    document.body.classList.add('no-scroll');
  }

  function applyZoom() {
    const box = $('zoom-pages');
    box.style.width = `${zoomLevel * 100}%`;
    $('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  function setZoom(z, cx, cy) {
    const sc = $('zoom-scroll');
    const old = zoomLevel;
    zoomLevel = Math.min(4, Math.max(1, z));
    // keep the point under the cursor in place
    const rect = sc.getBoundingClientRect();
    const px = (cx ?? rect.left + rect.width / 2) - rect.left;
    const py = (cy ?? rect.top + rect.height / 2) - rect.top;
    const fx = (sc.scrollLeft + px) / old;
    const fy = (sc.scrollTop + py) / old;
    applyZoom();
    sc.scrollLeft = fx * zoomLevel - px;
    sc.scrollTop  = fy * zoomLevel - py;
  }

  function closeZoom() {
    const ov = $('zoom-overlay');
    if (ov && !ov.classList.contains('hidden')) {
      ov.classList.add('hidden');
      $('zoom-pages').innerHTML = '';
      document.body.classList.remove('no-scroll');
    }
  }

  // ── Page picker (thumbnails of every page) ──────────────────────────────────

  function goToPage(heb) {
    if (!pageFlip) return;
    const lib = hebToLib(Math.min(Math.max(heb, 1), currentIssue.pages));
    pageFlip.turnToPage(lib);
    updateUi(pageFlip.getCurrentPageIndex());
  }

  function openPages() {
    if (!currentIssue) return;
    const grid = $('pages-grid');
    const current = visibleHebPages();
    const useThumbs = !!currentIssue.page_thumbs;
    grid.innerHTML = '';
    for (let heb = 1; heb <= currentIssue.pages; heb++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-thumb' + (current.includes(heb) ? ' is-current' : '');
      btn.setAttribute('aria-label', `מעבר לעמוד ${heb}`);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      const n = String(heb).padStart(3, '0');
      img.src = useThumbs
        ? `${NEWSPAPER_CONFIG.storageBase}/${currentIssue.path}pages/thumbs/page-${n}.jpg`
        : pageUrl(heb);
      const label = document.createElement('span');
      label.textContent = heb;
      btn.append(img, label);
      btn.addEventListener('click', () => { closePages(); goToPage(heb); });
      grid.append(btn);
    }
    $('pages-panel').classList.remove('hidden');
    $('btn-pages').setAttribute('aria-expanded', 'true');
    grid.querySelector('.is-current')?.scrollIntoView({ block: 'center' });
  }

  function closePages() {
    const panel = $('pages-panel');
    if (panel && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      $('btn-pages').setAttribute('aria-expanded', 'false');
    }
  }

  // ── Share ──────────────────────────────────────────────────────────────────

  async function share() {
    if (!currentIssue) return;
    const url = window.location.href;
    const title = `${currentIssue.title || 'גיליון ' + currentIssue.number} | עמנואל שלי`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (_) {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      window.App.showError('הקישור לעמוד הועתק');
    } catch (_) {
      window.prompt('העתיקו את הקישור:', url);
    }
  }

  // ── Fullscreen ─────────────────────────────────────────────────────────────

  function toggleFullscreen() {
    const el = $('viewer-view');
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || (() => Promise.reject()))
        .call(el)?.catch?.(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  const viewerOpen = () => currentIssue && !$('viewer-view').classList.contains('hidden');
  const zoomOpen   = () => !$('zoom-overlay').classList.contains('hidden');
  const pagesOpen  = () => !$('pages-panel').classList.contains('hidden');

  document.addEventListener('keydown', (e) => {
    if (!viewerOpen()) return;
    if (zoomOpen()) {
      if (e.key === 'Escape') closeZoom();
      if (e.key === '+' || e.key === '=') setZoom(zoomLevel + 0.5);
      if (e.key === '-') setZoom(zoomLevel - 0.5);
      return;
    }
    if (pagesOpen()) { if (e.key === 'Escape') closePages(); return; }
    if (e.key === 'g' || e.key === 'G') { openPages(); return; }
    if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); pageFlip?.turnToPage(libTotal - 1); updateUi(libTotal - 1); }
    else if (e.key === 'Escape') window.App.showHome();
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'z' || e.key === 'Z' || e.key === '+') openZoom();
  });

  // Rebuild only when the available area really changed (keeps the current page)
  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!viewerOpen()) return;
      const wrap = $('flipbook-wrap');
      const [w, h] = lastSize.split('x').map(Number);
      if (Math.abs(wrap.clientWidth - w) < 30 && Math.abs(wrap.clientHeight - h) < 60) return;
      const pages = visibleHebPages();
      build(pages[0] || 1);
    }, 250);
  }
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);

  document.addEventListener('DOMContentLoaded', () => {
    $('btn-nav-left').addEventListener('click', next);
    $('btn-nav-right').addEventListener('click', prev);
    $('btn-fullscreen').addEventListener('click', toggleFullscreen);
    $('btn-zoom').addEventListener('click', () => openZoom());
    $('btn-pages').addEventListener('click', () => (pagesOpen() ? closePages() : openPages()));
    $('pages-close').addEventListener('click', closePages);
    $('btn-share').addEventListener('click', share);
    $('btn-first').addEventListener('click', () => {
      if (!pageFlip) return;
      pageFlip.turnToPage(libTotal - 1);
      updateUi(libTotal - 1);
    });

    // Double-click / double-tap on a page → open that page zoomed
    $('flipbook-wrap').addEventListener('dblclick', (e) => {
      const img = e.target.closest?.('.fb-page img');
      openZoom(img ? [Number(img.dataset.heb)] : null);
    });

    $('zoom-close').addEventListener('click', closeZoom);
    $('zoom-in').addEventListener('click', () => setZoom(zoomLevel + 0.5));
    $('zoom-out').addEventListener('click', () => setZoom(zoomLevel - 0.5));
    const sc = $('zoom-scroll');
    sc.addEventListener('dblclick', (e) => setZoom(zoomLevel >= 2 ? 1 : 2.5, e.clientX, e.clientY));
    sc.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;            // pinch on trackpad / ctrl+wheel
      e.preventDefault();
      setZoom(zoomLevel * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX, e.clientY);
    }, { passive: false });

    // Drag to pan with the mouse
    let drag = null;
    sc.addEventListener('mousedown', (e) => {
      drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop };
      sc.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      sc.scrollLeft = drag.l - (e.clientX - drag.x);
      sc.scrollTop  = drag.t - (e.clientY - drag.y);
    });
    window.addEventListener('mouseup', () => { drag = null; sc.classList.remove('dragging'); });
  });

  return { open, close, toggleFullscreen, next, prev, goToPage };
})();
