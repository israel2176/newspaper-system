// app.js — main controller: home page, routing, opening issues
'use strict';

window.App = (() => {
  let manifest = null;
  const $ = (id) => document.getElementById(id);

  // ── Views ──────────────────────────────────────────────────────────────────

  const ALL_VIEWS = ['loading-view', 'home-view', 'viewer-view'];

  function _showViewInternal(which) {
    document.body.classList.toggle('viewer-mode', which === 'viewer');
    ALL_VIEWS.forEach(v => $(v).classList.toggle('hidden', v !== which + '-view'));
  }

  function showLoading(text) {
    _showViewInternal('loading');
    $('loading-text').textContent = text || 'טוען…';
  }

  // ── Home ───────────────────────────────────────────────────────────────────

  function renderHero(issue) {
    const base = NEWSPAPER_CONFIG.storageBase;
    const title = issue.title || `גיליון ${issue.number}`;

    const cover = $('hero-cover');
    cover.classList.remove('skeleton');
    cover.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hero-cover-btn';
    btn.setAttribute('aria-label', `קריאת ${title}`);
    const img = document.createElement('img');
    img.src = `${base}/${issue.cover || issue.thumb}`;
    img.alt = `שער ${title}`;
    img.fetchPriority = 'high';
    btn.append(img);
    btn.addEventListener('click', () => openIssue(issue));
    cover.append(btn);

    $('hero-title').textContent = title;
    const greg = Archive.formatDate(issue.date);
    $('hero-meta').textContent = `${greg} · ${issue.pages} עמודים`;
    const [y, m, d] = issue.date.split('-').map(Number);
    window.hebrewDate(new Date(y, m - 1, d)).then(h => {
      if (h) $('hero-meta').textContent = `${h} · ${greg} · ${issue.pages} עמודים`;
    });

    const read = $('hero-read');
    read.disabled = false;
    read.onclick = () => openIssue(issue);
  }

  function renderHome(issues) {
    if (!issues.length) {
      $('hero-cover').classList.remove('skeleton');
      $('hero-title').textContent = 'עדיין לא פורסמו גיליונות';
      $('archive').classList.add('hidden');
      return;
    }
    renderHero(issues[0]);
    Archive.renderInto(issues, $('archive-grid'));
    $('archive-count').textContent = `${issues.length} גיליונות`;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function showHome(push = true) {
    Viewer.close();
    if (push && getIssueFromUrl()) {
      const url = new URL(window.location.href);
      url.searchParams.delete('issue');
      url.searchParams.delete('page');
      history.pushState({}, '', url.pathname + url.search);
    }
    _showViewInternal('home');
    document.title = 'עמנואל שלי — העיתון של עמנואל';
  }

  function openIssue(issue, startPage, push = true) {
    if (push) {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('issue', issue.number);
      url.searchParams.delete('page');
      history.pushState({ issue: issue.number }, '', url.toString());
    }
    document.title = `${issue.title || 'גיליון ' + issue.number} | עמנואל שלי`;
    Viewer.open(issue, startPage);
  }

  const getIssueFromUrl = () =>
    parseInt(new URLSearchParams(window.location.search).get('issue'), 10) || null;
  const getPageFromUrl = () =>
    parseInt(new URLSearchParams(window.location.search).get('page'), 10) || 1;

  function routeFromUrl() {
    const num = getIssueFromUrl();
    const found = num && manifest?.issues.find(i => i.number === num);
    if (found) openIssue(found, getPageFromUrl(), false);
    else showHome(false);
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  let toastTimer;
  function showError(msg) {
    const el = $('error-toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    showLoading();
    $('btn-back').addEventListener('click', () => showHome());
    window.addEventListener('popstate', routeFromUrl);

    // Logo / "home" link while inside the viewer → close the viewer without reload
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href="/"], a[href="/#archive"]');
      if (!a || !getIssueFromUrl()) return;
      e.preventDefault();
      showHome();
      if (a.getAttribute('href') === '/#archive') $('archive').scrollIntoView();
    });

    try {
      const res = await fetch(NEWSPAPER_CONFIG.manifestUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
      manifest.issues = manifest.issues || [];
      renderHome(manifest.issues);
      routeFromUrl();
      if (location.hash === '#archive' && !getIssueFromUrl()) $('archive').scrollIntoView();
    } catch (err) {
      console.error(err);
      _showViewInternal('home');
      showError('לא ניתן לטעון את הגיליונות כרגע. נסו שוב מאוחר יותר.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showLoading, showHome, openIssue, showError, _showViewInternal };
})();
