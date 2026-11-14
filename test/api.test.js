'use strict';
/* Ende-zu-Ende-Test der API: node --test test/ */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const PORT = 4300 + Math.floor(Math.random() * 500), BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'funke-'));
let proc;
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(3000, 7)]).toString('base64');

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', Cookie: this.cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || ''; const data = ct.includes('json') ? await r.json() : await r.arrayBuffer();
    return { status: r.status, data };
  }
}
const ADMIN = { Authorization: 'Bearer testadmin-token' };
async function signup(email, name, age, gender, seek, extra = {}) {
  const c = new Client();
  let r = await c.req('POST', '/api/register', { email, password: 'ein-langes-passwort', name, age, gender, seek, consent: true, over18: true, ...extra }); assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await c.req('PUT', '/api/me', { goal: 'Feste Beziehung', kids: 'Offen', amin: 20, amax: 50, km: 999, interests: ['Lachen', 'Natur'], prompts: [{ q: 'Mein Geheimtalent', a: 'Ich finde jede Pilzstelle.' }], about: 'Hallo https://spam.example Welt' });
  assert.equal(r.status, 200); assert.ok(!r.data.about.includes('https'));
  r = await c.req('POST', '/api/onboarding', { ax: { sp: 4, na: 2, hu: 4, ge: 1 }, tags: { Lachen: 1, Natur: 1, Stil: 0 } }); assert.equal(r.data.type.name, 'Funkenflug');
  for (let i = 0; i < 2; i++) assert.equal((await c.req('POST', '/api/photos', { data: JPEG })).status, 200);
  r = await c.req('POST', '/api/finish', {}); assert.equal(r.status, 200);
  assert.equal((await c.req('POST', '/api/selfie', { data: JPEG })).status, 200);
  const me = (await c.req('GET', '/api/me')).data; c.id = me.id; c.invite = me.invite; return c;
}
async function approve(c) { assert.equal((await new Client().req('POST', `/api/admin/verify/${c.id}`, { ok: true }, ADMIN)).status, 200); }

before(async () => {
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT), DB_PATH: path.join(tmp, 't.db'), ADMIN_TOKEN: 'testadmin-token', PICKS_ANYTIME: '1' }, stdio: 'inherit' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/healthz')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Server startet nicht');
});
after(() => { proc.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('Sicherheit: Pflichtfelder, Alter, Auth, Admin', async () => {
  const c = new Client();
  assert.equal((await c.req('POST', '/api/register', { email: 'x@y.de', password: 'kurz', name: 'Ab', age: 30, gender: 'w', seek: 'm', consent: true, over18: true })).status, 400);
  assert.equal((await c.req('POST', '/api/register', { email: 'x@y.de', password: 'ein-langes-passwort', name: 'Ab', age: 17, gender: 'w', seek: 'm', consent: true, over18: true })).status, 400);
  assert.equal((await c.req('POST', '/api/register', { email: 'x@y.de', password: 'ein-langes-passwort', name: 'Ab', age: 30, gender: 'w', seek: 'm' })).status, 400);
  assert.equal((await c.req('GET', '/api/me')).status, 401);
  assert.equal((await c.req('GET', '/api/admin/stats')).status, 401);
  assert.equal((await c.req('GET', '/api/admin/stats', undefined, { Authorization: 'Bearer falsch' })).status, 401);
  assert.equal((await c.req('POST', '/api/register', {}, { Origin: 'https://evil.example' })).status, 403);
  const r = await fetch(BASE + '/'); assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
});

test('Kompletter Ablauf: Prüfung, Vorschläge, Funke, Match, Chat, Beenden, Melden, Export, Löschen', async () => {
  const anna = await signup('anna@test.de', 'Anna', 30, 'w', 'm');
  const ben = await signup('ben@test.de', 'Ben', 32, 'm', 'w', { ref: anna.invite });
  const cem = await signup('cem@test.de', 'Cem', 33, 'm', 'w');
  // Ungeprüfte sehen nichts und können nicht funken
  assert.equal((await anna.req('GET', '/api/picks')).data.picks.length, 0);
  assert.equal((await anna.req('POST', `/api/spark/${ben.id}`, {})).status, 403);
  await approve(anna); await approve(ben); await approve(cem);
  // Selfie darf nur Admin/Eigentümer sehen
  const pend = await new Client().req('GET', '/api/admin/pending', undefined, ADMIN); assert.ok(Array.isArray(pend.data));
  let r = await anna.req('GET', '/api/picks'); assert.equal(r.data.picks.length, 2); assert.ok(r.data.picks[0].reasons.length >= 1); assert.ok(r.data.picks[0].photos.length === 2);
  assert.equal(r.data.picks.every(p => p.gender === undefined && p.email === undefined), true);
  // Fotos: Ben (geprüft) darf Annas Foto sehen, ein Ungeprüfter-Selfie ist nur für Admin sichtbar
  const ok = await ben.req('GET', `/photo/${r.data.picks[0].photos[0]}`); assert.equal(ok.status, 200);
  const outsider = new Client(); assert.equal((await outsider.req('GET', `/photo/${r.data.picks[0].photos[0]}`)).status, 401);
  // Anna funkt Ben, Ben sieht sie als eingehend, Gegenfunke erzeugt Match
  const benId = r.data.picks.find(p => p.name === 'Ben').id;
  r = await anna.req('POST', `/api/spark/${benId}`, { prompt: 'Mein Geheimtalent', note: 'Pilze? Erzähl!' }); assert.equal(r.data.matched, false);
  r = await ben.req('GET', '/api/picks'); const inc = r.data.incoming; assert.equal(inc.length, 1); assert.equal(inc[0].name, 'Anna'); assert.equal(inc[0].incoming.note, 'Pilze? Erzähl!');
  r = await ben.req('POST', `/api/spark/${anna.id}`, { prompt: 'Ich verliebe mich in', note: 'Pilze sind mein Leben.' }); assert.equal(r.data.matched, true); const tid = r.data.thread;
  // Chat
  r = await ben.req('GET', `/api/threads/${tid}`); assert.ok(r.data.messages.length >= 3); const lastId = r.data.messages.at(-1).id;
  assert.equal((await ben.req('POST', `/api/threads/${tid}/messages`, { text: 'Samstag Kaffee?', kind: 'date' })).status, 200);
  r = await anna.req('GET', `/api/threads/${tid}?since=${lastId}`); assert.equal(r.data.messages.length, 1); assert.equal(r.data.messages[0].kind, 'date'); assert.equal(r.data.messages[0].mine, false);
  assert.equal((await cem.req('GET', `/api/threads/${tid}`)).status, 404, 'Fremde dürfen nicht mitlesen');
  assert.equal((await anna.req('POST', `/api/threads/${tid}/messages`, { text: '   ' })).status, 400);
  // Passen, Wiederholung
  r = await cem.req('GET', '/api/picks'); const aid = r.data.picks.find(p => p.name === 'Anna').id; await cem.req('POST', `/api/picks/${aid}/pass`, {});
  // Beenden
  assert.equal((await anna.req('POST', `/api/threads/${tid}/close`, { tpl: 0 })).status, 200);
  r = await ben.req('GET', `/api/threads/${tid}`); assert.equal(r.data.closed, true); assert.equal((await ben.req('POST', `/api/threads/${tid}/messages`, { text: 'hallo' })).status, 409);
  // Melden blockiert beidseitig
  assert.equal((await ben.req('POST', '/api/report', { userId: cem.id, reason: 'Fake-Profil oder Betrug', text: 'Test' })).status, 200);
  r = await ben.req('GET', '/api/picks'); assert.ok(!r.data.picks.some(p => p.name === 'Cem'));
  r = await cem.req('GET', '/api/picks'); assert.ok(!r.data.picks.some(p => p.name === 'Ben'));
  const rep = await new Client().req('GET', '/api/admin/reports', undefined, ADMIN); assert.equal(rep.data.length, 1);
  // Wingman-Empfehlung per Link
  const pub = new Client(); assert.equal((await pub.req('GET', `/api/w/${anna.invite}`)).data.name, 'Anna');
  assert.equal((await pub.req('POST', `/api/w/${anna.invite}`, { name: 'Tess', text: 'Anna hört zu und lacht dann so laut.' })).status, 200);
  const w = (await anna.req('GET', '/api/wingman')).data; assert.equal(w.items.length, 1); await anna.req('POST', `/api/wingman/${w.items[0].id}`, { status: 'approved' });
  r = await ben.req('GET', `/api/profile/${anna.id}`); assert.equal(r.data.endorsements.length, 1);
  // Referral: Anna hat 1 Freund geworben → 6 Vorschläge möglich
  assert.equal((await anna.req('GET', '/api/me')).data.referred, 1);
  // Export und Löschen
  r = await anna.req('GET', '/api/export'); assert.equal(r.data.konto.email, 'anna@test.de'); assert.ok(!('pw' in r.data.konto)); assert.ok(r.data.chats.length === 1);
  assert.equal((await anna.req('DELETE', '/api/me', { password: 'falsch-falsch-falsch' })).status, 401);
  assert.equal((await anna.req('DELETE', '/api/me', { password: 'ein-langes-passwort' })).status, 200);
  assert.equal((await anna.req('GET', '/api/me')).status, 401);
  r = await ben.req('GET', `/api/threads/${tid}`); assert.ok(r.data.messages.some(m => m.text === '[Nachricht gelöscht]'));
  assert.equal((await new Client().req('POST', '/api/login', { email: 'anna@test.de', password: 'ein-langes-passwort' })).status, 401);
});

test('Login, Passwort-Reset, Sperre, Statistik', async () => {
  const dora = await signup('dora@test.de', 'Dora', 28, 'w', 'alle');
  const c = new Client(); assert.equal((await c.req('POST', '/api/login', { email: 'dora@test.de', password: 'ein-langes-passwort' })).status, 200);
  assert.equal((await c.req('POST', '/api/login', { email: 'dora@test.de', password: 'nope-nope-nope' })).status, 401);
  assert.equal((await c.req('POST', '/api/reset/request', { email: 'gibtsnicht@test.de' })).status, 200);
  assert.equal((await c.req('POST', '/api/reset/confirm', { token: 'abc', password: 'neues-langes-passwort' })).status, 410);
  assert.equal((await new Client().req('POST', `/api/admin/ban/${dora.id}`, {}, ADMIN)).status, 200);
  assert.equal((await c.req('GET', '/api/me')).status, 401);
  const st = await new Client().req('GET', '/api/admin/stats', undefined, ADMIN); assert.ok(st.data.nutzer >= 3); assert.ok(st.data.ereignisse.match >= 1);
});
