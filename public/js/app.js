// app.js — Main application controller
'use strict';

window.App = (() => {
  let manifest = null;
  let latestIssueNum = null;

  // ── Hebrew calendar date (Hebcal API) ────────────────────────────────────

  async function fetchHebrewDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const res  = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${y}-${m}-${d}&g2h=1`);
    const data = await res.json();
    return (data.hebrew || '').replace(/״/g, '"').replace(/[ְ-ׇ]/g, '');
  }

  // ── View switching ─────────────────────────────────────────────────────────

  const ALL_VIEWS = ['loading-view', 'home-view', 'viewer-view'];

  function _showViewInternal(which) {
    const id = which + '-view';
    document.body.classList.toggle('viewer-mode', which === 'viewer');
    ALL_VIEWS.forEach(v => {
      document.getElementById(v).classList.toggle('hidden', v !== id);
    });
  }

  function showLoading(text) {
    _showViewInternal('loading');
    document.getElementById('loading-text').textContent = text || 'טוען...';
  }

  // ── Masthead ───────────────────────────────────────────────────────────────

  function setMastheadToday() {
    const labelEl = document.getElementById('mh-issue-label');
    if (labelEl) labelEl.textContent = latestIssueNum ? 'גיליון אחרון' : 'גיליון';
    document.getElementById('mh-issue').textContent = latestIssueNum || '—';
    fetchHebrewDate(new Date())
      .then(s => { document.getElementById('mh-date').textContent = s; })
      .catch(() => { document.getElementById('mh-date').textContent = ''; });
  }

  function setMastheadIssue(issue) {
    const labelEl = document.getElementById('mh-issue-label');
    if (labelEl) labelEl.textContent = 'גיליון';
    const [y, m, d] = issue.date.split('-').map(Number);
    document.getElementById('mh-issue').textContent = issue.number;
    fetchHebrewDate(new Date(y, m - 1, d))
      .then(s => { document.getElementById('mh-date').textContent = s; })
      .catch(() => { document.getElementById('mh-date').textContent = issue.date; });
  }

  function applyManifestMeta(m) {
    document.title = m.newspaper_name || 'עמנואל שלי';
  }

  // ── Featured (home) view ───────────────────────────────────────────────────

  function renderFeatured(issue) {
    const base = NEWSPAPER_CONFIG.storageBase;
    const container = document.getElementById('featured-container');
    container.innerHTML = '';

    const fig = document.createElement('figure');
    fig.className = 'featured';

    const img = document.createElement('img');
    img.src       = `${base}/${issue.cover || issue.thumb}`;
    img.alt       = `${issue.title || 'גיליון ' + issue.number} — שער`;
    img.className = 'featured-thumb';
    img.addEventListener('click', () => openIssue(issue));

    const cap = document.createElement('figcaption');
    cap.className = 'featured-caption';
    cap.innerHTML = `
      <span class="featured-kicker">הגיליון החדש</span>
      <span class="featured-title"></span>
      <span class="featured-meta"></span>
      <button type="button" class="featured-btn">לקריאת הגיליון ←</button>`;
    cap.querySelector('.featured-title').textContent = issue.title || `גיליון ${issue.number}`;
    cap.querySelector('.featured-meta').textContent =
      `${Archive.formatDate(issue.date)} · ${issue.pages} עמודים`;
    cap.querySelector('.featured-btn').addEventListener('click', () => openIssue(issue));

    fig.append(img, cap);
    container.appendChild(fig);
  }

  function renderPrevIssues(issues) {
    if (!issues || issues.length === 0) return;
    const section   = document.getElementById('prev-section');
    const container = document.getElementById('prev-container');
    Archive.renderInto(issues, container);
    section.classList.remove('hidden');
  }

  // ── Public navigation ──────────────────────────────────────────────────────

  function showHome(push = true) {
    Viewer.close();
    setMastheadToday();
    if (push && getIssueFromUrl()) clearIssueFromUrl();
    _showViewInternal('home');
  }

  function openIssue(issue, startPage, push = true) {
    setMastheadIssue(issue);
    if (push) setIssueInUrl(issue.number);
    Viewer.open(issue, startPage);
  }

  // ── URL helpers ────────────────────────────────────────────────────────────

  function getIssueFromUrl() {
    return parseInt(new URLSearchParams(window.location.search).get('issue'), 10) || null;
  }

  function getPageFromUrl() {
    return parseInt(new URLSearchParams(window.location.search).get('page'), 10) || 1;
  }

  function setIssueInUrl(num) {
    const url = new URL(window.location.href);
    url.searchParams.set('issue', num);
    url.searchParams.delete('page');
    history.pushState({ issue: num }, '', url.toString());
  }

  function clearIssueFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('issue');
    url.searchParams.delete('page');
    history.pushState({}, '', url.toString());
  }

  // ── Error toast ────────────────────────────────────────────────────────────

  let _toastTimer;
  function showError(msg) {
    const el = document.getElementById('error-toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
  }

  // ── Fetch manifest ─────────────────────────────────────────────────────────

  async function fetchManifest() {
    const res = await fetch(NEWSPAPER_CONFIG.manifestUrl, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    showLoading('טוען...');
    setMastheadToday();

    document.getElementById('mh-logo').addEventListener('click', () => showHome());
    document.getElementById('btn-back').addEventListener('click', () => showHome());
    const fy = document.getElementById('footer-year');
    if (fy) fy.textContent = new Date().getFullYear();

    const _masthead = document.getElementById('masthead');
    window.addEventListener('scroll', () => {
      _masthead.classList.toggle('masthead--scrolled', window.scrollY > 40);
    }, { passive: true });

    window.addEventListener('popstate', (e) => {
      const num = getIssueFromUrl();
      if (num && manifest) {
        const found = manifest.issues.find(i => i.number === num);
        if (found) { openIssue(found, getPageFromUrl(), false); return; }
      }
      showHome(false);
    });

    try {
      manifest = await fetchManifest();
      applyManifestMeta(manifest);

      const issues = manifest.issues || [];
      if (issues.length > 0) {
        latestIssueNum = issues[0].number;
        setMastheadToday();
        renderFeatured(issues[0]);
      }
      if (issues.length > 1) renderPrevIssues(issues.slice(1, 11)); // max 10 previous

      const targetNum = getIssueFromUrl();
      if (targetNum) {
        const found = issues.find(i => i.number === targetNum);
        if (found) { openIssue(found, getPageFromUrl(), false); return; }
      }

      if (issues.length === 0) {
        document.getElementById('featured-container').innerHTML =
          '<p class="empty-msg">עדיין לא פורסמו גיליונות</p>';
      }
      _showViewInternal('home');

    } catch (err) {
      console.error(err);
      showError('לא ניתן לטעון את הארכיון. אנא נסה שוב מאוחר יותר.');
      _showViewInternal('home');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showLoading, showHome, openIssue, showError, _showViewInternal };
})();
