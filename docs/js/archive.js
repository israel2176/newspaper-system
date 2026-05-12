// archive.js — Issue card rendering
'use strict';

const Archive = (() => {
  const MONTHS_HE = [
    'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
    'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
  ];

  function formatDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return `${d} ${MONTHS_HE[m - 1]} ${y}`;
  }

  function groupByYear(issues) {
    const map = new Map();
    for (const issue of issues) {
      const year = issue.date.slice(0, 4);
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(issue);
    }
    return map;
  }

  function buildCard(issue) {
    const card = document.createElement('button');
    const ioSupported = 'IntersectionObserver' in window;
    card.className = 'issue-card' + (ioSupported ? ' card-hidden' : '');
    card.type = 'button';
    card.setAttribute('aria-label', `${issue.title} — ${formatDate(issue.date)}`);

    const thumbUrl = `${NEWSPAPER_CONFIG.storageBase}/${issue.thumb}`;
    card.innerHTML = `
      <div class="card-thumb" aria-hidden="true">
        <span class="card-thumb-placeholder">&#9636;</span>
        <img loading="lazy" alt="" src="${thumbUrl}">
      </div>
      <div class="card-info">
        <div class="card-number">No. ${issue.number}</div>
        <div class="card-date">${formatDate(issue.date)}</div>
        <div class="card-pages">${issue.pages} עמודים</div>
      </div>
    `;

    card.querySelector('img').addEventListener('load', () => {
      const ph = card.querySelector('.card-thumb-placeholder');
      if (ph) ph.style.display = 'none';
    });

    card.addEventListener('click', () => window.App.openIssue(issue));
    return card;
  }

  // Render issues as a flat grid (no year grouping)
  function renderInto(issues, container) {
    container.innerHTML = '';
    if (!issues || issues.length === 0) {
      container.innerHTML = '<p class="empty-msg">אין גיליונות נוספים</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'issues-grid';
    for (const issue of issues) grid.appendChild(buildCard(issue));
    container.appendChild(grid);

    if (!('IntersectionObserver' in window)) return;

    const cards = Array.from(grid.querySelectorAll('.issue-card.card-hidden'));
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      visible.forEach((entry, i) => {
        setTimeout(() => entry.target.classList.remove('card-hidden'), i * 60);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.06 });
    cards.forEach(c => obs.observe(c));
  }

  return { renderInto };
})();
