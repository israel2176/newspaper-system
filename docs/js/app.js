// app.js — Main application controller
'use strict';

window.App = (() => {
  let manifest = null;

  // ── Hebrew calendar date (Hebcal API) ────────────────────────────────────

  async function fetchHebrewDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const res  = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${y}-${m}-${d}&g2h=1`);
    const data = await res.json();
    return (data.hebrew || '').replace(/״/g, '"');
  }

  // ── View switching ─────────────────────────────────────────────────────────

  const ALL_VIEWS = ['loading-view', 'home-view', 'viewer-view'];

  function _showViewInternal(which) {
    const id = which + '-view';
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
    document.getElementById('mh-issue').textContent = '—';
    fetchHebrewDate(new Date())
      .then(s => { document.getElementById('mh-date').textContent = s; })
      .catch(() => { document.getElementById('mh-date').textContent = ''; });
  }

  function setMastheadIssue(issue) {
    const [y, m, d] = issue.date.split('-').map(Number);
    document.getElementById('mh-issue').textContent = `No. ${issue.number}`;
    fetchHebrewDate(new Date(y, m - 1, d))
      .then(s => { document.getElementById('mh-date').textContent = s; })
      .catch(() => { document.getElementById('mh-date').textContent = issue.date; });
  }

  function applyManifestMeta(m) {
    const name = m.newspaper_name || 'עמנואל שלי';
    document.getElementById('mh-name').textContent = name;
    document.title = name;
    const tagEl = document.getElementById('mh-tagline');
    if (tagEl) tagEl.textContent = m.tagline || '';
  }

  // ── Featured (home) view ───────────────────────────────────────────────────

  function renderFeatured(issue) {
    const thumbUrl = `${NEWSPAPER_CONFIG.storageBase}/${issue.thumb}`;
    const img = document.createElement('img');
    img.src       = thumbUrl;
    img.alt       = `גיליון ${issue.number}`;
    img.className = 'featured-thumb';
    img.addEventListener('click', () => openIssue(issue));
    const container = document.getElementById('featured-container');
    container.innerHTML = '';
    container.appendChild(img);
  }

  function renderPrevIssues(issues) {
    if (!issues || issues.length === 0) return;
    const section   = document.getElementById('prev-section');
    const container = document.getElementById('prev-container');
    Archive.renderInto(issues, container);
    section.classList.remove('hidden');
  }

  // ── Public navigation ──────────────────────────────────────────────────────

  function showHome() {
    Viewer.close();
    setMastheadToday();
    clearIssueFromUrl();
    _showViewInternal('home');
  }

  async function openIssue(issue) {
    setMastheadIssue(issue);
    setIssueInUrl(issue.number);
    await Viewer.open(issue);
  }

  // ── URL helpers ────────────────────────────────────────────────────────────

  function getIssueFromUrl() {
    return parseInt(new URLSearchParams(window.location.search).get('issue'), 10) || null;
  }

  function setIssueInUrl(num) {
    const url = new URL(window.location.href);
    url.searchParams.set('issue', num);
    history.pushState({ issue: num }, '', url.toString());
  }

  function clearIssueFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('issue');
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

    document.getElementById('mh-name').style.cursor = 'pointer';
    document.getElementById('mh-name').addEventListener('click', showHome);
    document.getElementById('btn-back').addEventListener('click', showHome);

    window.addEventListener('popstate', (e) => {
      if (e.state?.issue && manifest) {
        const found = manifest.issues.find(i => i.number === e.state.issue);
        if (found) { openIssue(found); return; }
      }
      showHome();
    });

    try {
      manifest = await fetchManifest();
      applyManifestMeta(manifest);

      const issues = manifest.issues || [];
      if (issues.length > 0) renderFeatured(issues[0]);
      if (issues.length > 1) renderPrevIssues(issues.slice(1, 11)); // max 10 previous

      const targetNum = getIssueFromUrl();
      if (targetNum) {
        const found = issues.find(i => i.number === targetNum);
        if (found) { await openIssue(found); return; }
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
