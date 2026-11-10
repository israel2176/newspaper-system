<div dir="rtl">

# הגדרת המייל

1. **Cloudflare:** Email ← Email Routing ← Enable.
2. **טוקן GitHub:** יוצרים ב-[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
   - מגבילים אותו למאגר הזה בלבד.
   - בהרשאות: Contents ← Read and write.
3. **טוקן Cloudflare:** יוצרים ב-[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) לפי התבנית Edit Cloudflare Workers.
4. **שמירה ב-GitHub:** במאגר, Settings ← Secrets ← Actions. מוסיפים:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `NEWSPAPER_GITHUB_TOKEN`

   אחר כך מריצים את Actions ← Deploy email worker.
5. **יצירת הכתובת:** ב-Cloudflare, Email Routing ← Routing rules ← Create address. יוצרים כתובת, למשל `paper`, ובוחרים Send to a Worker ← `newspaper-email-inbox`.

לסינון שולחים מגדירים את `ALLOWED_SENDERS` בקובץ `wrangler.toml`.

</div>
