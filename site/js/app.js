// app.js — Main application controller
'use strict';

const App = (() => {
  let manifest = null;

  const MONTHS_HE = [
    'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
    'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
  ];

  // ── View switching ─────────────────────────────────────────────────────────

  const VIEWS = ['loading-view', 'archive-view', 'viewer-view'];

  function _showViewInternal(which) {
    const target = which === 'loading' ? 'loading-view'
                 : which === 'archive' ? 'archive-view'
                 : 'viewer-view';
    VIEWS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== target);
    });
  }

  function showLoading(text = 'טוען...') {
    _showViewInternal('loading');
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
  }

  // ── Masthead updates ───────────────────────────────────────────────────────

  function updateMastheadIdle() {
    const today = new Date();
    const d = today.getDate();
    const m = MONTHS_HE[today.getMonth()];
    const y = today.getFullYear();
    document.getElementById('mh-date').textContent = `${d} ${m} ${y}`;
    document.getElementById('mh-issue').textContent = '—';
  }

  function updateMastheadForIssue(issue) {
    const [y, mo, d] = issue.date.split('-').map(Number);
    document.getElementById('mh-date').textContent = `${d} ${MONTHS_HE[mo - 1]} ${y}`;
    document.getElementById('mh-issue').textContent = `No. ${issue.number}`;
  }

  function applyManifestMeta(m) {
    const title = m.newspaper_name || 'המקומון';
    document.getElementById('mh-name').textContent = title;
    document.title = `${title} — ארכיון גיליונות`;
    const tagline = m.tagline || '';
    const tagEl = document.getElementById('mh-tagline');
    if (tagEl) tagEl.textContent = tagline;
  }

  // ── Error toast ────────────────────────────────────────────────────────────

  let toastTimer = null;

  function showError(msg) {
    const toast = document.getElementById('error-toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
  }

  // ── Deep link (URL param) ──────────────────────────────────────────────────

  function getIssueFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const num = params.get('issue');
    return num ? parseInt(num, 10) : null;
  }

  function setIssueInUrl(issueNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set('issue', issueNumber);
    history.pushState({ issue: issueNumber }, '', url.toString());
  }

  function clearIssueFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('issue');
    history.pushState({}, '', url.toString());
  }

  // ── Public: show archive ───────────────────────────────────────────────────

  function showArchive() {
    Viewer.close();
    updateMastheadIdle();
    clearIssueFromUrl();
    _showViewInternal('archive');
  }

  // ── Public: open an issue ──────────────────────────────────────────────────

  async function openIssue(issue) {
    updateMastheadForIssue(issue);
    setIssueInUrl(issue.number);
    await Viewer.open(issue);
  }

  // ── Fetch manifest ─────────────────────────────────────────────────────────

  async function fetchManifest() {
    const resp = await fetch(NEWSPAPER_CONFIG.manifestUrl, {
      cache: 'no-cache',       // always fresh on first load; browser respects max-age afterwards
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    showLoading('טוען ארכיון...');
    updateMastheadIdle();

    // Masthead title click → back to archive
    document.getElementById('mh-name').addEventListener('click', showArchive);
    document.getElementById('mh-name').style.cursor = 'pointer';

    // Browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.issue) {
        const found = (manifest?.issues || []).find(i => i.number === e.state.issue);
        if (found) { openIssue(found); return; }
      }
      showArchive();
    });

    try {
      manifest = await fetchManifest();
      applyManifestMeta(manifest);
      Archive.render(manifest.issues);

      const targetIssueNum = getIssueFromUrl();
      if (targetIssueNum && manifest.issues.length > 0) {
        const issue = manifest.issues.find(i => i.number === targetIssueNum);
        if (issue) {
          await openIssue(issue);
          return;
        }
      }

      _showViewInternal('archive');
    } catch (err) {
      console.error('Failed to load manifest:', err);
      showError('לא ניתן לטעון את הארכיון. אנא נסה שוב מאוחר יותר.');
      _showViewInternal('archive');
      Archive.render([]);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // expose for viewer callbacks
  return { showLoading, showArchive, openIssue, showError, _showViewInternal };
})();
