# מערכת עיתון מקומון אונליין

> Gmail → PDF → Flipbook אוטומטי

## ארכיטקטורה

```
Gmail (IMAP)
    │
    ▼
fetch_newspaper.py          ← רץ כל שעה על VPS (cron)
    │   pdftoppm via pdf2image
    │   Pillow לthumbnails
    ▼
/var/www/israelcodes.ovh/newspaper/
    ├── manifest.json
    └── 2026/issue-1218/
            ├── page-001.jpg … page-048.jpg
            └── thumb.jpg
    ▲
    │  nginx (CORS + cache headers)
    │
    ▼
GitHub Pages  ←  fetch(manifest.json)
    index.html / app.js / viewer.js
    StPageFlip RTL flipbook
```

## מבנה קבצים

```
newspaper-system/
├── scripts/
│   ├── fetch_newspaper.py   # סקריפט ראשי
│   ├── config.example.env   # תבנית הגדרות
│   ├── requirements.txt     # Pillow, pdf2image
│   ├── install.sh           # הגדרה ראשונית + cron + nginx
│   └── README.md
│
└── site/                    # GitHub Pages
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── config.js        # ← עדכן עם URL שלך
    │   ├── app.js
    │   ├── archive.js
    │   └── viewer.js
    └── README.md
```

## התקנה מהירה

### VPS

```bash
git clone https://github.com/YOUR/newspaper-system
cd newspaper-system/scripts

# ערוך את origin לפי שם המשתמש שלך ב-GitHub Pages
sudo GITHUB_PAGES_ORIGIN="https://YOUR-USERNAME.github.io" bash install.sh

# מלא credentials
sudo nano /etc/newspaper.env

# בדוק nginx ועדכן
sudo nginx -t && sudo nginx -s reload

# בדיקה ידנית
source /etc/newspaper.env && /opt/newspaper-venv/bin/python fetch_newspaper.py
```

### GitHub Pages

1. עדכן `site/js/config.js` עם ה-URL של ה-VPS שלך
2. Push לmain, הפעל GitHub Pages על תיקיית `site/`
