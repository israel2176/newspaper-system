// layout.js — shared header & footer for every page
'use strict';

// Hebrew date (e.g. כ"ה באייר תשפ"ו) via Hebcal, cached per day
window.hebrewDate = async (date) => {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const key = 'hd:' + iso;
  try { const c = localStorage.getItem(key); if (c) return c; } catch (_) {}
  try {
    const res = await fetch(`https://www.hebcal.com/converter?cfg=json&date=${iso}&g2h=1&strict=1`);
    const data = await res.json();
    const out = (data.hebrew || '').replace(/[\u0591-\u05C7]/g, '').replace(/״/g, '"').replace(/׳/g, "'");
    try { if (out) localStorage.setItem(key, out); } catch (_) {}
    return out;
  } catch (_) { return ''; }
};

(() => {
  const page = document.body.dataset.page || 'home';
  const year = new Date().getFullYear();

  const nav = [
    ['home',    '/',             'עמוד הבית'],
    ['archive', '/#archive',     'ארכיון גיליונות'],
    ['about',   '/about',        'אודות'],
    ['contact', '/contact',      'צור קשר'],
  ];
  const navLinks = nav.map(([key, href, label]) =>
    `<a href="${href}"${key === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');

  const header = document.getElementById('site-header');
  if (header) {
    header.innerHTML = `
      <div class="topbar">
        <div class="container topbar-inner">
          <span id="today-date" class="topbar-date"></span>
          <span class="topbar-note">העיתון המקומי של עמנואל · גיליון חדש בכל שבוע</span>
        </div>
      </div>
      <div class="container header-inner">
        <a href="/" class="brand" id="brand-link" aria-label="עמנואל שלי — עמוד הבית">
          <img src="/img/logo.png" alt="עמנואל שלי" width="588" height="185">
        </a>
        <button class="menu-toggle" id="menu-toggle" aria-label="תפריט" aria-expanded="false" aria-controls="main-nav">
          <span></span><span></span><span></span>
        </button>
        <nav class="main-nav" id="main-nav" aria-label="ניווט ראשי">${navLinks}</nav>
      </div>`;

    const toggle = document.getElementById('menu-toggle');
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open);
    });
    header.querySelectorAll('.main-nav a').forEach(a =>
      a.addEventListener('click', () => header.classList.remove('nav-open')));

    window.addEventListener('scroll', () => {
      header.classList.toggle('is-scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.innerHTML = `
      <div class="container footer-grid">
        <div class="footer-brand">
          <img src="/img/logo.png" alt="עמנואל שלי" width="588" height="185">
          <p>העיתון הקהילתי של עמנואל — חדשות, אירועים, פרסומים ומידע מקומי. יוצא לאור מדי שבוע.</p>
        </div>
        <div>
          <h3>ניווט</h3>
          <nav class="footer-links">${navLinks}</nav>
        </div>
        <div>
          <h3>יצירת קשר</h3>
          <ul class="footer-contact">
            <li><a href="tel:0583221232">0583-221-232</a></li>
            <li><a href="mailto:imanuel.sheli@gmail.com">imanuel.sheli@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container footer-bottom-inner">
          <span>© ${year} עמנואל שלי · כל הזכויות שמורות</span>
          <span>פותח ע"י <a href="https://israelcodes.ovh" target="_blank" rel="noopener">israelcodes</a></span>
        </div>
      </div>`;
  }

  // Today's Hebrew date in the top bar
  const dateEl = document.getElementById('today-date');
  if (dateEl) {
    const d = new Date();
    const greg = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    dateEl.textContent = greg;
    window.hebrewDate?.(d).then(h => { if (h) dateEl.textContent = `${greg} · ${h}`; });
  }
})();
