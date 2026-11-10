<div dir="rtl">

# כתובת מייל לעיתון (Cloudflare)

כל PDF שנשלח לכתובת כמו `paper@הדומיין-שלך` עולה לאתר לבד, תוך כ-3 דקות.

**איך זה עובד:**

1. **Cloudflare Email Routing** מקבל את המייל ומעביר אותו לקוד שנמצא בתיקייה הזו (Email Worker).
2. **הקוד שומר** כל קובץ PDF מצורף בתיקייה `inbox` שבמאגר ב-GitHub.
3. **GitHub Actions** ממיר את ה-PDF לעמודים.
4. **Vercel** מעדכן את האתר.

הכול חינמי בתוכנית הבסיסית של Cloudflare.

## הגדרה — פעם אחת

### שלב 1: הפעלת Email Routing
1. נכנסים ל-Cloudflare ובוחרים את הדומיין.
2. בתפריט: **Email ← Email Routing ← Enable**.
3. Cloudflare מוסיף לבד את רשומות ה-MX.

> אם כבר יש לדומיין תיבות מייל אצל ספק אחר, השתמשו בתת-דומיין, למשל `mail.example.com`, כדי לא לפגוע בהן.

### שלב 2: טוקן GitHub, שמאפשר לשמור קבצים במאגר
1. נכנסים ל-https://github.com/settings/personal-access-tokens/new.
2. **Repository access:** בוחרים Only select repositories, ואת המאגר `newspaper-system`.
3. **Permissions:** בשורה Contents בוחרים **Read and write**.
4. לוחצים **Generate token** ומעתיקים את הטוקן.

### שלב 3: טוקן Cloudflare
1. נכנסים ל-https://dash.cloudflare.com/profile/api-tokens.
2. לוחצים **Create Token** ובוחרים את התבנית **Edit Cloudflare Workers**.
3. מעתיקים את הטוקן.
4. מעתיקים גם את ה-**Account ID**. הוא מופיע בעמוד הראשי של החשבון ב-Cloudflare, בצד.

### שלב 4: שמירת הטוקנים ב-GitHub
במאגר: **Settings ← Secrets and variables ← Actions ← New repository secret**. מוסיפים שלושה סודות:

| שם | ערך |
|---|---|
| `CLOUDFLARE_API_TOKEN` | הטוקן משלב 3 |
| `CLOUDFLARE_ACCOUNT_ID` | ה-Account ID משלב 3 |
| `NEWSPAPER_GITHUB_TOKEN` | הטוקן משלב 2 |

אחר כך מריצים: **Actions ← Deploy email worker ← Run workflow**.

### שלב 5: יצירת הכתובת וחיבורה לקוד
1. ב-Cloudflare: **Email Routing ← Routing rules ← Create address**.
2. **Custom address:** כותבים `paper`, או כל שם אחר.
3. **Action:** בוחרים **Send to a Worker**, ואת `newspaper-email-inbox`.
4. לוחצים **Save**.

### שלב 6: לשלוח את העיתון לכתובת החדשה
יש שתי דרכים:
- **הכי פשוט:** לבקש מהעיתון להוסיף את `paper@הדומיין` לרשימת התפוצה.
- **העברה אוטומטית מהמייל האישי:** מגדירים בתיבה האישית מסנן לפי כתובת השולח של העיתון, עם הפעולה "העבר אל" `paper@הדומיין`.
  - חלק מספקי המייל שולחים קוד אימות לכתובת החדשה לפני שמאפשרים העברה.
  - כדי לקבל את הקוד, מגדירים זמנית את `FORWARD_TO` (בטבלה למטה) עם הכתובת האישית.

## הגדרות רשות

ההגדרות נמצאות בקובץ `wrangler.toml`. אחרי כל שינוי מריצים שוב את **Deploy email worker**.

| הגדרה | מה היא עושה |
|---|---|
| `ALLOWED_SENDERS` | רק מיילים מהכתובות או מהדומיינים שברשימה יפורסמו באתר. כותבים אותם מופרדים בפסיקים. מומלץ מאוד, כדי שזרים לא יוכלו לפרסם |
| `FORWARD_TO` | כל מייל שמגיע יועבר גם לכתובת הזו. את הכתובת צריך לאמת קודם ב-Cloudflare: **Email Routing ← Destination addresses** |

## בדיקה (למפתחים)

</div>

```bash
cd cloudflare/email-worker
npm ci
TEST_PDF=/path/to/file.pdf npm test
```
