// archive.js — Renders the issue archive grid
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
    card.className = 'issue-card';
    card.dataset.issueId = issue.id;
    card.dataset.issueNumber = issue.number;
    card.setAttribute('aria-label', `${issue.title} — ${formatDate(issue.date)}`);
    card.type = 'button';

    const thumbUrl = `${NEWSPAPER_CONFIG.storageBase}/${issue.thumb}`;

    card.innerHTML = `
      <div class="card-thumb" aria-hidden="true">
        <span class="card-thumb-placeholder">&#9636;</span>
        <img
          loading="lazy"
          alt=""
          src="${thumbUrl}"
        >
      </div>
      <div class="card-info">
        <div class="card-number">No. ${issue.number}</div>
        <div class="card-date">${formatDate(issue.date)}</div>
        <div class="card-pages">${issue.pages} עמודים</div>
      </div>
    `;

    // Hide placeholder once image loads
    const img = card.querySelector('img');
    img.addEventListener('load', () => {
      const placeholder = card.querySelector('.card-thumb-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    });

    card.addEventListener('click', () => {
      window.App.openIssue(issue);
    });

    return card;
  }

  function render(issues) {
    const container = document.getElementById('archive-container');
    container.innerHTML = '';

    if (!issues || issues.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--ink-soft);padding:3rem;font-family:var(--font-serif)">אין גיליונות בארכיון עדיין</p>';
      return;
    }

    const byYear = groupByYear(issues);

    // Newest year first (Map preserves insertion order, issues arrive sorted already)
    for (const [year, yearIssues] of byYear) {
      const section = document.createElement('section');
      section.className = 'year-section';
      section.setAttribute('aria-label', `גיליונות שנת ${year}`);

      const heading = document.createElement('h2');
      heading.className = 'year-heading';
      heading.innerHTML = `${year} <span class="year-count">${yearIssues.length} גיליונות</span>`;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'issues-grid';

      for (const issue of yearIssues) {
        grid.appendChild(buildCard(issue));
      }

      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  return { render };
})();
