// Cloudflare Email Worker — receives the newspaper by email and drops every PDF
// attachment into the repository's inbox/ folder. The "Publish newspaper"
// GitHub workflow then turns it into pages and Vercel redeploys the site.
//
//   paper@your-domain  ──(Email Routing)──▶  this worker  ──(GitHub API)──▶  inbox/*.pdf
import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).arrayBuffer();
    const email = await PostalMime.parse(raw);
    // Envelope sender (e.g. your personal mailbox when it auto-forwards) + the From header (the paper)
    const from = `${message.from || ''} ${email.from?.address || ''}`.toLowerCase();

    if (!isAllowedSender(from, env.ALLOWED_SENDERS)) {
      console.log(`Ignored email from ${from}`);
      if (env.FORWARD_TO) await message.forward(env.FORWARD_TO);
      return;
    }
    const pdfs = (email.attachments || []).filter(isPdf);
    console.log(`Email from ${from} "${email.subject}" — ${pdfs.length} PDF(s)`);

    const date = isoDate(email.date);
    for (const [i, att] of pdfs.entries()) {
      const name = buildFileName(email.subject, att.filename, date, i);
      await uploadToGithub(env, `inbox/${name}`, toBytes(att.content), `Newspaper by email: ${name}`)
        .catch((err) => {
          // 422 = a file with this name is already waiting in inbox/ — upload under a unique name
          if (!String(err.message).includes(' 422 ')) throw err;
          const alt = name.replace(/\.pdf$/, ` ${Date.now()}.pdf`);
          return uploadToGithub(env, `inbox/${alt}`, toBytes(att.content), `Newspaper by email: ${alt}`);
        });
      console.log(`Uploaded inbox/${name}`);
    }

    if (env.FORWARD_TO) await message.forward(env.FORWARD_TO);
  },
};

// ── helpers (exported for tests) ────────────────────────────────────────────

export function isAllowedSender(from, allowed) {
  const list = (allowed || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.some(s => from.includes(s));
}

export function isPdf(att) {
  return att.mimeType === 'application/pdf' || /\.pdf$/i.test(att.filename || '');
}

export function isoDate(value) {
  const d = value ? new Date(value) : new Date();
  const ok = !Number.isNaN(d.getTime()) ? d : new Date();
  // Israel time, so a Friday-morning email is not dated Thursday
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(ok);
}

// "<subject> <original name> YYYY-MM-DD.pdf" — the pipeline reads the issue
// number from it ("גיליון 290") and the date from the YYYY-MM-DD part.
export function buildFileName(subject, filename, date, index = 0) {
  const clean = (s) => (s || '')
    .replace(/\.pdf$/i, '')
    .replace(/^(\s*(fwd?|fw|re|הועבר)\s*:\s*)+/i, '')
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = [clean(subject), clean(filename)].filter(Boolean);
  let base = [...new Set(parts)].join(' - ').slice(0, 120) || 'newspaper';
  if (index) base += ` (${index + 1})`;
  return `${base} ${date}.pdf`;
}

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(String(content));
}

function base64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function uploadToGithub(env, path, bytes, commitMessage) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN secret is not set');
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'newspaper-email-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: base64(bytes),
      branch: env.GITHUB_BRANCH || 'master',
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub upload failed: ${res.status} ${await res.text()}`);
  }
}
