# כתובת מייל ייעודית לעיתון (Cloudflare)

כל PDF שנשלח לכתובת כמו `paper@הדומיין-שלך` עולה לאתר לבד, תוך כ-3 דקות.

```
paper@domain ──(Cloudflare Email Routing)──▶ Worker ──▶ inbox/*.pdf ב-GitHub
                                                         │
                                       GitHub Actions: המרה לעמודים
                                                         ▼
                                                  Vercel מעדכן את האתר
```

## היתרונות לעומת תיבת Gmail
- **מיידי:** אין המתנה לבדיקה של כל שעה.
- **בלי סיסמאות מייל:** אין צורך בסיסמת אפליקציה של Gmail.
- **חינם:** Email Routing ו-Workers בחינם בתוכנית הבסיסית.

## הגדרה — פעם אחת

1. **הפעלת Email Routing**
   ב-Cloudflare: הדומיין ← **Email** ← **Email Routing** ← **Enable**. רשומות ה-MX נוספות לבד.
   אם כבר יש לדומיין מייל אצל ספק אחר, בחרו תת-דומיין, למשל `mail.example.com`.

2. **טוקן GitHub שמאפשר להעלות קבצים למאגר**
   - נכנסים ל-https://github.com/settings/personal-access-tokens/new.
   - **Repository access:** Only select repositories ← `newspaper-system`.
   - **Permissions:** Contents ← **Read and write**.

3. **טוקן Cloudflare**
   - נכנסים ל-https://dash.cloudflare.com/profile/api-tokens ← **Create Token**.
   - בוחרים בתבנית **Edit Cloudflare Workers**.
   - את ה-**Account ID** מעתיקים מעמוד הבית של החשבון, בצד ימין.

4. **סודות ב-GitHub**
   במאגר: Settings ← Secrets and variables ← Actions ← New repository secret.
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `NEWSPAPER_GITHUB_TOKEN`: הטוקן משלב 2.

   אחר כך: **Actions ← Deploy email worker ← Run workflow**.

5. **חיבור הכתובת ל-Worker**
   - Email Routing ← **Routing rules** ← **Create address**.
   - כתובת: `paper`.
   - Action: **Send to a Worker** ← `newspaper-email-inbox`.

6. **מעבירים את העיתון לכתובת החדשה.** יש שתי דרכים:
   - **הכי פשוט:** לבקש מהעיתון להוסיף את `paper@הדומיין` לרשימת התפוצה.
   - **העברה אוטומטית מהמייל האישי:** ב-Gmail מגדירים מסנן לפי השולח, עם הפעולה "העבר אל" `paper@הדומיין`.
     - Gmail שולח קוד אימות לכתובת החדשה.
     - כדי לראות את הקוד, מגדירים זמנית `FORWARD_TO` (ראו בהמשך) עם הכתובת האישית.

## הגדרות רשות (ב-`wrangler.toml`)
| משתנה | מה עושה |
|---|---|
| `ALLOWED_SENDERS` | רק מיילים מכתובות או דומיינים אלה יפורסמו, למשל `paper.co.il,my@gmail.com`. מומלץ מאוד |
| `FORWARD_TO` | יעביר כל מייל גם לכתובת הזו. הכתובת צריכה להיות מאומתת ב-Email Routing ← Destination addresses |

אחרי שינוי, מריצים שוב את **Deploy email worker**.

## בדיקה
```bash
cd cloudflare/email-worker && npm ci && TEST_PDF=/path/to/file.pdf npm test
```
