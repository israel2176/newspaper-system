import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { buildFileName, isAllowedSender, isoDate } from '../src/worker.js';

test('file name keeps issue number and date', () => {
  assert.equal(buildFileName('Fwd: גיליון 290', 'emanuel.pdf', '2026-11-14'), 'גיליון 290 - emanuel 2026-11-14.pdf');
  assert.equal(buildFileName('', '', '2026-11-14'), 'newspaper 2026-11-14.pdf');
  assert.equal(buildFileName('a/b:c', 'x.PDF', '2026-01-01', 1), 'a b c - x (2) 2026-01-01.pdf');
});

test('sender filter', () => {
  assert.ok(!isAllowedSender(['ed@paper.co.il'], ''));                       // no list → reject
  assert.ok(isAllowedSender(['Ed@Paper.co.il', 'ed@paper.co.il'], 'a@b.com, ed@paper.co.il'));
  assert.ok(isAllowedSender(['x@paper.co.il'], '@paper.co.il'));             // whole domain
  assert.ok(!isAllowedSender(['ed@paper.co.il.evil.com'], 'ed@paper.co.il'));
  assert.ok(!isAllowedSender(['spam@x.com', 'ed@paper.co.il'], 'ed@paper.co.il')); // forged From
  assert.ok(!isAllowedSender([], 'ed@paper.co.il'));
});

test('date in Israel time', () => {
  assert.equal(isoDate('Thu, 13 Nov 2026 23:30:00 +0000'), '2026-11-14');
});

test('email() uploads the PDF to inbox/', async () => {
  const pdf = readFileSync(process.env.TEST_PDF);
  const b64 = pdf.toString('base64').replace(/.{76}/g, '$&\r\n');
  const mime = [
    'From: Editor <ed@paper.co.il>', 'To: paper@example.com',
    'Subject: =?UTF-8?B?' + Buffer.from('גיליון 291').toString('base64') + '?=',
    'Date: Fri, 13 Nov 2026 07:00:00 +0200', 'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="XX"', '',
    '--XX', 'Content-Type: text/plain; charset=utf-8', '', 'hello', '',
    '--XX', 'Content-Type: application/pdf; name="paper.pdf"',
    'Content-Disposition: attachment; filename="paper.pdf"', 'Content-Transfer-Encoding: base64', '',
    b64, '--XX--', '',
  ].join('\r\n');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return new Response('{}', { status: calls.length === 1 ? 422 : 201 });
  };
  let forwarded = null;
  const message = {
    from: 'ed@paper.co.il',
    raw: new Blob([mime]).stream(),
    forward: async (to) => { forwarded = to; },
    setReject: () => { throw new Error('should not reject'); },
  };
  await worker.email(message, { GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', GITHUB_BRANCH: 'master', ALLOWED_SENDERS: 'ed@paper.co.il', FORWARD_TO: 'me@x.com' });
  assert.equal(calls.length, 2);                       // first 422 → retried under a unique name
  assert.match(decodeURIComponent(calls[0].url), /contents\/inbox\/גיליון 291 - paper 2026-11-13\.pdf$/);
  assert.equal(Buffer.from(calls[1].body.content, 'base64').equals(pdf), true);
  assert.equal(calls[1].body.branch, 'master');
  assert.equal(forwarded, 'me@x.com');
});

test('email() rejects unknown senders without uploading', async () => {
  let fetched = false, rejected = null;
  globalThis.fetch = async () => { fetched = true; return new Response('{}'); };
  const mime = 'From: spam@x.com\r\nSubject: hi\r\n\r\nbody';
  await worker.email(
    { from: 'spam@x.com', raw: new Blob([mime]).stream(), setReject: (r) => { rejected = r; }, forward: async () => {} },
    { GITHUB_TOKEN: 't', GITHUB_REPO: 'o/r', ALLOWED_SENDERS: 'ed@paper.co.il' });
  assert.equal(fetched, false);
  assert.ok(rejected);
});
