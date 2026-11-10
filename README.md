# עמנואל שלי — עיתון אונליין

> מייל עם PDF ← GitHub Actions ← עמודי JPG ← Vercel ← דפדפן עם דפדוף מימין לשמאל

## איך זה עובד

```
מייל ייעודי (Gmail)          תיקיית inbox/ במאגר
        │  (IMAP, כל שעה)            │  (העלאה ידנית דרך GitHub)
        └──────────────┬─────────────┘
                       ▼
     GitHub Actions — scripts/newspaper_pipeline.py
       • ממיר כל עמוד ב-PDF לתמונה (poppler)
       • מפצל כפולות עמודים לשני עמודים (ימין ← שמאל)
       • יוצר תמונת שער ותמונה ממוזערת, מעדכן manifest.json
       • עושה commit ל-public/newspaper/
                       ▼
     Vercel — פריסה אוטומטית של public/ בכל commit
```

אין שרת לתחזק: הכול רץ ב-GitHub Actions ובאחסון הסטטי של Vercel. שניהם בחינם.

## מבנה

```
public/                  ← האתר (התיקייה ש-Vercel מגיש)
  index.html, about.html, contact.html
  js/  app.js · viewer.js (דפדפת RTL) · archive.js · config.js
  vendor/page-flip.browser.js
  newspaper/manifest.json + <year>/issue-<n>/{cover,thumb}.jpg, pages/page-NNN.jpg
scripts/newspaper_pipeline.py   ← עיבוד PDF ← עמודים
inbox/                          ← תיבה להעלאה ידנית של PDF
.github/workflows/publish-newspaper.yml
vercel.json
```

## הגדרה — פעם אחת

### 1. Vercel
ב-Vercel יוצרים פרויקט מהמאגר (**Add New → Project**, בוחרים את `newspaper-system`) ומשאירים את ברירות המחדל.
ההגדרות נמצאות ב-`vercel.json`. מכאן כל push ל-`master` מתפרסם לבד.
כדי לחבר דומיין: **Settings → Domains**.

### 2. תיבת מייל לעיתון (מומלץ: Gmail ייעודי)
1. פותחים חשבון Gmail חדש, למשל `emanuel.paper.inbox@gmail.com`.
2. בחשבון החדש מפעילים אימות דו-שלבי, ואז יוצרים **סיסמת אפליקציה** בכתובת https://myaccount.google.com/apppasswords.
3. במייל האישי, שאליו מגיע העיתון היום, מגדירים העברה אוטומטית:
   - **הגדרות → העברה ו-POP/IMAP → הוספת כתובת להעברה**, ומאשרים את הקוד שנשלח לתיבה החדשה.
   - **יצירת מסנן**: בשדה "מאת" שמים את כתובת השולח של העיתון, ובוחרים **"העבר אל"** ← הכתובת החדשה.

   מעכשיו כל גיליון שמגיע אליכם מועבר לבד לתיבה הייעודית.

> אפשר גם בלי תיבה ייעודית: לשים את פרטי המייל האישי ולהגדיר `SENDER_FILTER`.
> תיבה נפרדת בטוחה יותר, כי סיסמת האפליקציה נותנת גישה לכל התיבה.

### 3. סודות ב-GitHub
במאגר: **Settings → Secrets and variables → Actions**.

| סוג | שם | ערך |
|---|---|---|
| Secret | `EMAIL_USER` | כתובת התיבה הייעודית |
| Secret | `EMAIL_PASS` | סיסמת האפליקציה |
| Variable (רשות) | `SENDER_FILTER` | חלק מכתובת השולח, למשל `paper.co.il`. אפשר כמה, מופרדים בפסיקים |
| Variable (רשות) | `SUBJECT_FILTER` | מילה שחייבת להופיע בנושא המייל |
| Variable (רשות) | `MAX_ISSUES` | כמה גיליונות לשמור באתר (ברירת מחדל 11, ו-0 = הכול) |

אחר כך מריצים בדיקה: **Actions → Publish newspaper → Run workflow**.

## שימוש שוטף
- **אוטומטי:** כל שעה נבדקת התיבה. גיליון חדש עולה לאתר, והמייל מסומן בתווית `newspaper-processed` ומועבר לארכיון.
- **ידני:** מעלים PDF לתיקייה `inbox/` דרך האתר של GitHub (**Add file → Upload files**). פרטים ב-[inbox/README.md](inbox/README.md).
- **מקומי:** `python scripts/newspaper_pipeline.py file issue.pdf --number 290 --date 2026-11-14`. דורש `poppler-utils` ו-`pip install -r scripts/requirements.txt`.

מספר הגיליון נלקח משם הקובץ או מנושא המייל ("גיליון 290"). אם לא נמצא מספר, הגיליון מקבל את המספר הבא.

## הצופה
- דפדוף אמיתי מימין לשמאל: השער מימין, ועמוד 2 בצד ימין של הכפולה.
- במחשב מוצגת כפולה, ובנייד עמוד אחד.
- חיצים, החלקה, או גרירה של פינת העמוד.
- לחיצה כפולה או 🔍 פותחות הגדלה עם זום (+/−, Ctrl+גלגלת, צביטה).
- קישור ישיר לעמוד: `/?issue=285&page=12`.
- מקשים: `←`/רווח = הבא, `→` = הקודם, `Z` = הגדלה, `F` = מסך מלא, `Esc` = חזרה.
