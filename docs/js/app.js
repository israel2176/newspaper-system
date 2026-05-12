// app.js — Main application controller
'use strict';

window.App = (() => {
  let manifest = null;
  let _previousView = 'home';

  // ── Hebrew calendar date (Intl API) ───────────────────────────────────────

  const hebrewFmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew-nu-hebr', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function hebrewDate(date) {
    try {
      const parts = hebrewFmt.formatToParts(date);
      const get   = t => (parts.find(p => p.type === t) || {}).value || '';
      const norm  = s => s.replace(/״/g, '"').replace(/^ב/, '');
      return `${norm(get('day'))} ${norm(get('month'))} ${norm(get('year'))}`;
    } catch (_) {
      return date.toLocaleDateString('he-IL');
    }
  }

  // ── View switching ─────────────────────────────────────────────────────────

  const ALL_VIEWS = ['loading-view', 'home-view', 'archive-view', 'viewer-view'];

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
    document.getElementById('mh-date').textContent = hebrewDate(new Date());
    document.getElementById('mh-issue').textContent = '—';
  }

  function setMastheadIssue(issue) {
    const [y, m, d] = issue.date.split('-').map(Number);
    document.getElementById('mh-date').textContent = hebrewDate(new Date(y, m - 1, d));
    document.getElementById('mh-issue').textContent = `No. ${issue.number}`;
  }

  function applyManifestMeta(m) {
    const name = m.newspaper_name || 'עמנואל שלי';
    document.getElementById('mh-name').textContent = name;
    document.title = name;
    const tagEl = document.getElementById('mh-tagline');
    if (tagEl) tagEl.textContent = m.tagline || '';
  }

  // ── Featured (home) view ───────────────────────────────────────────────────

  const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                     'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  function renderFeatured(issue) {
    const [y, m, d] = issue.date.split('-').map(Number);
    const gregDate  = `${d} ${MONTHS_HE[m - 1]} ${y}`;
    const thumbUrl  = `${NEWSPAPER_CONFIG.storageBase}/${issue.thumb}`;

    document.getElementById('featured-container').innerHTML = `
      <div class="featured-card">
        <div class="featured-thumb-wrap">
          <img class="featured-thumb" src="${thumbUrl}" alt="גיליון ${issue.number}">
        </div>
        <div class="featured-info">
          <div class="featured-label">הגיליון האחרון</div>
          <div class="featured-number">No. ${issue.number}</div>
          <div class="featured-date">${gregDate}</div>
          <div class="featured-pages">${issue.pages} עמודים</div>
          <button class="featured-read-btn" id="featured-read-btn">קרא עכשיו</button>
        </div>
      </div>
    `;

    document.getElementById('featured-read-btn').addEventListener('click', () => {
      _previousView = 'home';
      openIssue(issue);
    });
  }

  // ── Public navigation ──────────────────────────────────────────────────────

  function showHome() {
    Viewer.close();
    setMastheadToday();
    clearIssueFromUrl();
    _showViewInternal('home');
  }

  function showArchive() {
    _previousView = 'archive';
    setMastheadToday();
    clearIssueFromUrl();
    _showViewInternal('archive');
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

    document.getElementById('btn-to-archive').addEventListener('click', showArchive);
    document.getElementById('btn-archive-back').addEventListener('click', showHome);
    document.getElementById('btn-back').addEventListener('click', () => {
      _previousView === 'archive' ? showArchive() : showHome();
    });

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
      Archive.render(issues);
      if (issues.length > 0) renderFeatured(issues[0]);

      const targetNum = getIssueFromUrl();
      if (targetNum) {
        const found = issues.find(i => i.number === targetNum);
        if (found) { await openIssue(found); return; }
      }

      _showViewInternal(issues.length > 0 ? 'home' : 'archive');

    } catch (err) {
      console.error(err);
      showError('לא ניתן לטעון את הארכיון. אנא נסה שוב מאוחר יותר.');
      _showViewInternal('archive');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showLoading, showHome, showArchive, openIssue, showError, _showViewInternal };
})();
