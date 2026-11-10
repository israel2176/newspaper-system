// archive.js — issue cards grid
'use strict';

const Archive = (() => {
  const MONTHS_HE = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ];

  function formatDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return `${d} ב${MONTHS_HE[m - 1]} ${y}`;
  }

  function buildCard(issue, isLatest) {
    const card = document.createElement('a');
    card.className = 'issue-card';
    card.href = `/?issue=${issue.number}`;
    const title = issue.title || `גיליון ${issue.number}`;
    card.setAttribute('aria-label', `${title} — ${formatDate(issue.date)}`);

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = `${NEWSPAPER_CONFIG.storageBase}/${issue.thumb}`;
    img.addEventListener('load', () => thumb.classList.add('loaded'));
    thumb.append(img);
    if (isLatest) {
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = 'חדש';
      thumb.append(badge);
    }

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = '<h3 class="card-title"></h3><p class="card-meta"></p>';
    info.querySelector('.card-title').textContent = title;
    info.querySelector('.card-meta').textContent = `${formatDate(issue.date)} · ${issue.pages} עמ׳`;

    card.append(thumb, info);
    card.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // allow "open in new tab"
      e.preventDefault();
      window.App.openIssue(issue);
    });
    return card;
  }

  function renderInto(issues, container) {
    container.innerHTML = '';
    issues.forEach((issue, i) => container.appendChild(buildCard(issue, i === 0)));
  }

  return { renderInto, formatDate };
})();
