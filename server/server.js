'use strict';
/* Funke Server: ohne externe Abhängigkeiten (Node 22+). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { sendMail } = require('./mailer');
const { TYPES, WORDS, CMP, typeKey, norm } = require('./content');

const cfg = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'funke.db'),
  admin: process.env.ADMIN_TOKEN || '',
  secure: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1',
  baseUrl: (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),
  picksAnytime: process.env.PICKS_ANYTIME === '1',
  plus: process.env.PLUS_ENABLED === '1',
  publicDir: path.join(__dirname, '..', 'public')
};
fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new DatabaseSync(cfg.dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw TEXT NOT NULL, name TEXT NOT NULL, age INTEGER NOT NULL,
  gender TEXT NOT NULL, seek TEXT NOT NULL, goal TEXT DEFAULT '', kids TEXT DEFAULT '', amin INTEGER DEFAULT 18, amax INTEGER DEFAULT 99,
  km INTEGER DEFAULT 999, ftime TEXT DEFAULT '18:00', lat REAL, lon REAL, ax TEXT DEFAULT '{}', tags TEXT DEFAULT '{}',
  interests TEXT DEFAULT '[]', prompts TEXT DEFAULT '[]', about TEXT DEFAULT '', ftype TEXT DEFAULT '', invite TEXT UNIQUE,
  ref INTEGER, vstatus TEXT DEFAULT 'none', onboarded INTEGER DEFAULT 0, paused INTEGER DEFAULT 0, banned INTEGER DEFAULT 0,
  consent_at INTEGER, created INTEGER, lastseen INTEGER);
CREATE TABLE IF NOT EXISTS sessions(th TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets(th TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, ord INTEGER DEFAULT 0, data BLOB NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS picks(user_id INTEGER, other_id INTEGER, day TEXT, score INTEGER, PRIMARY KEY(user_id, other_id));
CREATE TABLE IF NOT EXISTS passes(user_id INTEGER, other_id INTEGER, PRIMARY KEY(user_id, other_id));
CREATE TABLE IF NOT EXISTS sparks(from_id INTEGER, to_id INTEGER, prompt TEXT, note TEXT, created INTEGER, PRIMARY KEY(from_id, to_id));
CREATE TABLE IF NOT EXISTS threads(id INTEGER PRIMARY KEY, a INTEGER, b INTEGER, created INTEGER, closed_by INTEGER, closed_at INTEGER, UNIQUE(a, b));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, thread INTEGER NOT NULL, sender INTEGER, text TEXT NOT NULL, kind TEXT DEFAULT 'text', created INTEGER);
CREATE INDEX IF NOT EXISTS msg_thread ON messages(thread, id);
CREATE TABLE IF NOT EXISTS blocks(blocker INTEGER, blocked INTEGER, PRIMARY KEY(blocker, blocked));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, reporter INTEGER, target INTEGER, thread INTEGER, reason TEXT, text TEXT, created INTEGER, status TEXT DEFAULT 'open');
CREATE TABLE IF NOT EXISTS endorsements(id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, text TEXT, status TEXT DEFAULT 'pending', created INTEGER);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, data TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, user_id INTEGER, data TEXT, ts INTEGER);
`);

/* ---------- Helfer ---------- */
const now = () => Date.now();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rid = n => crypto.randomBytes(n).toString('hex');
const J = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F‪-‮⁦-⁩]/g, '').trim().slice(0, max);
const fmtB = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const berlin = (d = new Date()) => { const p = fmtB.format(d); return { day: p.slice(0, 10), hm: p.slice(11, 16) }; };
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg, code = 400) => { throw new HttpError(code, msg); };

function hashPw(pw) { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(pw, salt, 64); return salt.toString('hex') + ':' + h.toString('hex'); }
function checkPw(pw, stored) { const [s, h] = String(stored).split(':'); if (!s || !h) return false; const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64); const y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function validPw(pw) { return typeof pw === 'string' && pw.length >= 10 && pw.length <= 200; }

const hits = new Map();
function limit(key, max, ms) { const t = now(); const a = (hits.get(key) || []).filter(x => t - x < ms); if (a.length >= max) bad('Zu viele Anfragen. Bitte warte kurz.', 429); a.push(t); hits.set(key, a); }
setInterval(() => { const t = now(); for (const [k, a] of hits) { const f = a.filter(x => t - x < 3600e3); if (f.length) hits.set(k, f); else hits.delete(k); } db.prepare('DELETE FROM sessions WHERE expires<?').run(t); db.prepare('DELETE FROM resets WHERE expires<?').run(t); }, 600e3).unref();

const ipOf = req => (cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
function cookies(req) { const o = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return o; }
function setSession(res, uid) { const token = rid(32); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token), uid, now() + 30 * 864e5); res.setHeader('Set-Cookie', `fs=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${cfg.secure ? '; Secure' : ''}`); }
function userOf(req) {
  const t = cookies(req).fs; if (!t) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE th=? AND expires>?').get(sha(t), now()); if (!s) return null;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id); if (!u || u.banned) return null;
  if (!u.lastseen || now() - u.lastseen > 600e3) db.prepare('UPDATE users SET lastseen=? WHERE id=?').run(now(), u.id);
  return u;
}
const isAdmin = req => { const a = String(req.headers.authorization || ''); if (!cfg.admin || !a.startsWith('Bearer ')) return false; const x = Buffer.from(sha(a.slice(7))), y = Buffer.from(sha(cfg.admin)); return crypto.timingSafeEqual(x, y); };
const track = (uid, name, data) => { try { db.prepare('INSERT INTO events(user_id,name,data,ts) VALUES(?,?,?,?)').run(uid, name, data ? JSON.stringify(data).slice(0, 500) : null, now()); } catch {} };

/* ---------- Domänenlogik ---------- */
const GOALS = ['Feste Beziehung', 'Offen für alles', 'Erst mal kennenlernen'];
const KIDS = ['Ja', 'Offen', 'Nein', ''];
const GENDERS = ['w', 'm', 'd'];
const SEEKS = ['w', 'm', 'alle'];
const INTERESTS = ['Lachen', 'Natur', 'Stil', 'Sport', 'Kreativ', 'Ruhe'];
const PROMPT_QS = ['Mein perfekter Sonntag', 'Ich verliebe mich in', 'Mein Geheimtalent', 'Wir passen, wenn', 'Ein ehrlicher Satz über mich', 'Mein spontanster Moment'];
const REASONS = ['Unangemessene Nachricht oder Bilder', 'Fake-Profil oder Betrug', 'Bedrohung oder Belästigung', 'Minderjährig', 'Etwas anderes'];
const FAREWELLS = [n => `Danke für das nette Gespräch, ${n}. Ich glaube, es passt nicht ganz. Alles Gute!`, () => 'Ich habe gemerkt, dass ich gerade nicht bereit bin. Danke dir und alles Liebe.', () => 'Ich spüre den Funken leider nicht. Du bist toll, nur nicht mein Mensch.'];

function photoIds(uid) { return db.prepare("SELECT id FROM photos WHERE user_id=? AND kind='photo' ORDER BY ord, created").all(uid).map(r => r.id); }
function distKm(a, b) { if (a.lat == null || b.lat == null) return null; const R = 6371, rad = x => x * Math.PI / 180; const dLa = rad(b.lat - a.lat), dLo = rad(b.lon - a.lon); const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
const blockedSet = id => { const s = new Set(); for (const r of db.prepare('SELECT blocker,blocked FROM blocks WHERE blocker=? OR blocked=?').all(id, id)) { s.add(r.blocker === id ? r.blocked : r.blocker); } return s; };
const wantsGender = (seek, g) => seek === 'alle' || seek === g;

function eligible(me, o, blocked) {
  if (blocked.has(o.id)) return false;
  if (!wantsGender(me.seek, o.gender) || !wantsGender(o.seek, me.gender)) return false;
  if (o.age < me.amin || o.age > me.amax || me.age < o.amin || me.age > o.amax) return false;
  const d = distKm(me, o);
  if (d != null && ((me.km < 999 && d > me.km) || (o.km < 999 && d > o.km))) return false;
  return true;
}
function score(me, o) {
  const u = norm(J(me.ax, {})), v = norm(J(o.ax, {})), ts = J(me.tags, {}), ints = J(o.interests, []);
  const d = ['sp', 'na', 'hu', 'ge'].reduce((a, k) => a + Math.abs((u[k] || 0) - (v[k] || 0)), 0);
  const compat = 1 - d / 8;
  const attr = ints.length ? ints.reduce((a, t) => a + (ts[t] ?? .5), 0) / ints.length : .5;
  return Math.round(Math.min(.97, .55 * compat + .45 * attr + (me.goal && me.goal === o.goal ? .05 : 0)) * 100);
}
function reasons(me, o) {
  const u = norm(J(me.ax, {})), v = norm(J(o.ax, {})), ts = J(me.tags, {});
  const ks = ['sp', 'na', 'hu', 'ge'].map(k => [k, Math.abs((u[k] || 0) - (v[k] || 0))]).sort((a, b) => a[1] - b[1]);
  const r = []; const k1 = ks[0][0]; r.push(`Ihr seid beide eher ${WORDS[k1][(v[k1] || 0) >= 0 ? 0 : 1]}.`);
  const liked = J(o.interests, []).filter(t => (ts[t] ?? 0) >= .6); if (liked.length) r.push(`Du reagierst stark auf „${liked[0]}“. Genau das gehört zu ${o.name}.`);
  const d = ks.at(-1); if (d[1] > .7){ const w = WORDS[d[0]][(v[d[0]] || 0) >= 0 ? 0 : 1]; r.push(`Spannung: ${o.name} ist ${CMP[w]} als du. Das kann sich gut ergänzen.`); }
  if (me.goal && me.goal === o.goal) r.push(`Ihr sucht beide: ${me.goal}.`);
  return r;
}
function pub(me, o, extra = {}) {
  const ends = db.prepare("SELECT name,text FROM endorsements WHERE user_id=? AND status='approved' ORDER BY id DESC LIMIT 2").all(o.id);
  const d = distKm(me, o);
  return { id: o.id, name: o.name, age: o.age, goal: o.goal, kids: o.kids, about: o.about, interests: J(o.interests, []), prompts: J(o.prompts, []), photos: photoIds(o.id), type: TYPES[o.ftype]?.name || '', km: d == null ? null : Math.max(1, Math.round(d / 5) * 5), endorsements: ends, ...extra };
}
function pickLimit(me) { const n = db.prepare('SELECT COUNT(*) c FROM users WHERE ref=? AND onboarded=1').get(me.id).c; return 5 + Math.min(3, n); }
function picksFor(me) {
  const { day, hm } = berlin(); const out = { day, ready: true, at: me.ftime, picks: [], incoming: [], limit: pickLimit(me) };
  const first = berlin(new Date(me.created)).day === day;
  if (!cfg.picksAnytime && !first && hm < me.ftime) { out.ready = false; }
  const blocked = blockedSet(me.id);
  const done = id => db.prepare('SELECT 1 FROM passes WHERE user_id=? AND other_id=?').get(me.id, id) || db.prepare('SELECT 1 FROM sparks WHERE from_id=? AND to_id=?').get(me.id, id) || db.prepare('SELECT 1 FROM threads WHERE (a=? AND b=?) OR (a=? AND b=?)').get(me.id, id, id, me.id);
  const active = o => !o.banned && !o.paused && o.onboarded && o.vstatus === 'approved';
  for (const s of db.prepare('SELECT * FROM sparks WHERE to_id=? ORDER BY created DESC').all(me.id)) {
    if (out.incoming.length >= 3 || blocked.has(s.from_id) || done(s.from_id)) continue;
    const o = db.prepare('SELECT * FROM users WHERE id=?').get(s.from_id); if (!o || !active(o)) continue;
    out.incoming.push(pub(me, o, { score: score(me, o), reasons: reasons(me, o), incoming: { prompt: s.prompt, note: s.note } }));
  }
  if (!out.ready || me.vstatus !== 'approved' || me.paused) return out;
  let today = db.prepare('SELECT other_id,score FROM picks WHERE user_id=? AND day=?').all(me.id, day).filter(p => !done(p.other_id) && !blocked.has(p.other_id));
  const shownToday = db.prepare('SELECT COUNT(*) c FROM picks WHERE user_id=? AND day=?').get(me.id, day).c;
  if (shownToday < out.limit) {
    const seen = new Set(db.prepare('SELECT other_id FROM picks WHERE user_id=?').all(me.id).map(r => r.other_id));
    const cand = db.prepare('SELECT * FROM users WHERE id!=? AND onboarded=1 AND vstatus=\'approved\' AND banned=0 AND paused=0').all(me.id)
      .filter(o => !seen.has(o.id) && eligible(me, o, blocked) && !done(o.id)).map(o => ({ o, s: score(me, o) })).sort((a, b) => b.s - a.s).slice(0, out.limit - shownToday);
    const ins = db.prepare('INSERT OR IGNORE INTO picks VALUES(?,?,?,?)');
    for (const c of cand) { ins.run(me.id, c.o.id, day, c.s); today.push({ other_id: c.o.id, score: c.s }); }
  }
  for (const p of today) { const o = db.prepare('SELECT * FROM users WHERE id=?').get(p.other_id); if (o && active(o)) out.picks.push(pub(me, o, { score: p.score, reasons: reasons(me, o) })); }
  out.picks.sort((a, b) => b.score - a.score);
  return out;
}
function myState(u) {
  const t = TYPES[u.ftype];
  return {
    id: u.id, email: u.email, name: u.name, age: u.age, gender: u.gender, seek: u.seek, goal: u.goal, kids: u.kids, amin: u.amin, amax: u.amax, km: u.km, ftime: u.ftime,
    hasLocation: u.lat != null, interests: J(u.interests, []), prompts: J(u.prompts, []), about: u.about, photos: photoIds(u.id), vstatus: u.vstatus, onboarded: !!u.onboarded,
    paused: !!u.paused, type: t ? { key: u.ftype, ...t } : null, invite: u.invite, referred: db.prepare('SELECT COUNT(*) c FROM users WHERE ref=? AND onboarded=1').get(u.id).c,
    plusEnabled: cfg.plus, insights: insightsFor(u)
  };
}
function insightsFor(u) {
  const v = norm(J(u.ax, {})), ts = Object.entries(J(u.tags, {})).sort((a, b) => b[1] - a[1]); const out = [];
  if (ts.length >= 2 && ts[0][1] > ts.at(-1)[1]) out.push(`Du reagierst auf „${ts[0][0]}“ stärker als auf „${ts.at(-1)[0]}“.`);
  out.push(v.na > .3 ? 'Du brauchst Nähe und regelmäßigen Kontakt.' : v.na < -.3 ? 'Du brauchst Freiraum und jemanden, der das entspannt sieht.' : 'Nähe und Freiraum sind dir gleich wichtig.');
  out.push(v.ge > .3 ? 'Unter Menschen blühst du auf.' : v.ge < -.3 ? 'Deine beste Zeit hast du zu zweit.' : 'Du kannst Party und Sofa gleich gut.');
  return out;
}
function threadsFor(me) {
  return db.prepare('SELECT * FROM threads WHERE a=? OR b=? ORDER BY id DESC').all(me.id, me.id).map(t => {
    const oid = t.a === me.id ? t.b : t.a; const o = db.prepare('SELECT id,name,banned FROM users WHERE id=?').get(oid);
    const last = db.prepare("SELECT text,sender,kind,id FROM messages WHERE thread=? AND kind!='sys' ORDER BY id DESC LIMIT 1").get(t.id);
    return { id: t.id, other: o ? { id: o.id, name: o.name, photo: photoIds(o.id)[0] || null } : { id: 0, name: 'Gelöschter Nutzer', photo: null }, closed: !!t.closed_by, last: last ? { text: last.text.slice(0, 80), mine: last.sender === me.id, id: last.id } : null, lastId: last?.id || 0 };
  });
}
function mustThread(me, id) {
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(Number(id)); if (!t || (t.a !== me.id && t.b !== me.id)) bad('Chat nicht gefunden.', 404);
  return t;
}
function systemMsg(thread, text) { db.prepare("INSERT INTO messages(thread,sender,text,kind,created) VALUES(?,NULL,?,'sys',?)").run(thread, text, now()); }
function openThreads(id) { return db.prepare('SELECT COUNT(*) c FROM threads WHERE (a=? OR b=?) AND closed_by IS NULL').get(id, id).c; }
function closeBetween(a, b, by) { db.prepare('UPDATE threads SET closed_by=?, closed_at=? WHERE closed_by IS NULL AND ((a=? AND b=?) OR (a=? AND b=?))').run(by, now(), Math.min(a, b), Math.max(a, b), Math.min(a, b), Math.max(a, b)); }

function checkImage(dataUrl, max) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '')); if (!m) bad('Bitte ein Foto als JPEG, PNG oder WebP senden.');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 1000 || buf.length > max) bad('Das Foto ist zu groß oder zu klein.', 413);
  const ok = (m[1] === 'jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) || (m[1] === 'png' && buf[0] === 0x89 && buf[1] === 0x50) || (m[1] === 'webp' && buf.slice(8, 12).toString() === 'WEBP');
  if (!ok) bad('Die Bilddatei ist beschädigt.'); return { buf, mime: 'image/' + m[1] };
}

/* ---------- API ---------- */
const routes = [];
const route = (method, pattern, fn, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, opts });

route('POST', '/api/register', (ctx) => {
  limit('reg:' + ctx.ip, 8, 3600e3);
  const b = ctx.body; const email = clean(b.email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('Bitte gib eine gültige E-Mail-Adresse ein.');
  if (!validPw(b.password)) bad('Das Passwort braucht mindestens 10 Zeichen.');
  const name = clean(b.name, 30); if (name.length < 2) bad('Bitte gib deinen Vornamen ein.');
  const age = Number(b.age); if (!(age >= 18 && age <= 99)) bad('Funke ist ab 18 Jahren.');
  if (!GENDERS.includes(b.gender) || !SEEKS.includes(b.seek)) bad('Bitte wähle aus, wer du bist und wen du suchst.');
  if (b.consent !== true || b.over18 !== true) bad('Bitte bestätige Alter und Einwilligung.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) bad('Mit dieser E-Mail gibt es schon ein Konto.', 409);
  const ref = b.ref ? db.prepare('SELECT id FROM users WHERE invite=?').get(clean(b.ref, 20))?.id : null;
  const r = db.prepare('INSERT INTO users(email,pw,name,age,gender,seek,invite,ref,consent_at,created,lastseen,amin,amax) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(email, hashPw(b.password), name, age, b.gender, b.seek, rid(5), ref ?? null, now(), now(), now(), Math.max(18, age - 8), Math.min(99, age + 10));
  setSession(ctx.res, Number(r.lastInsertRowid)); track(Number(r.lastInsertRowid), 'register');
  return { ok: true };
});
route('POST', '/api/login', (ctx) => {
  limit('login:' + ctx.ip, 15, 600e3); const email = clean(ctx.body.email, 200).toLowerCase(); limit('loginm:' + email, 8, 600e3);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !checkPw(String(ctx.body.password || ''), u.pw)) bad('E-Mail oder Passwort stimmt nicht.', 401);
  if (u.banned) bad('Dieses Konto ist gesperrt.', 403);
  setSession(ctx.res, u.id); return { ok: true };
});
route('POST', '/api/logout', (ctx) => { const t = cookies(ctx.req).fs; if (t) db.prepare('DELETE FROM sessions WHERE th=?').run(sha(t)); ctx.res.setHeader('Set-Cookie', 'fs=; HttpOnly; Path=/; Max-Age=0'); return { ok: true }; });
route('POST', '/api/reset/request', async (ctx) => {
  limit('rst:' + ctx.ip, 5, 3600e3); const email = clean(ctx.body.email, 200).toLowerCase(); const u = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (u) { const token = rid(24); db.prepare('INSERT INTO resets VALUES(?,?,?)').run(sha(token), u.id, now() + 3600e3); await sendMail(email, 'Funke: Passwort zurücksetzen', `Hallo,\n\nüber diesen Link kannst du dein Passwort zurücksetzen (60 Minuten gültig):\n${cfg.baseUrl}/?reset=${token}\n\nWenn du das nicht warst, ignoriere diese E-Mail.\n`); }
  return { ok: true };
});
route('POST', '/api/reset/confirm', (ctx) => {
  limit('rstc:' + ctx.ip, 10, 3600e3); if (!validPw(ctx.body.password)) bad('Das Passwort braucht mindestens 10 Zeichen.');
  const r = db.prepare('SELECT * FROM resets WHERE th=? AND expires>?').get(sha(String(ctx.body.token || '')), now()); if (!r) bad('Der Link ist abgelaufen. Bitte fordere einen neuen an.', 410);
  db.prepare('UPDATE users SET pw=? WHERE id=?').run(hashPw(ctx.body.password), r.user_id); db.prepare('DELETE FROM resets WHERE user_id=?').run(r.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id); return { ok: true };
});
route('GET', '/api/me', (ctx) => myState(ctx.user), { auth: true });
route('PUT', '/api/me', (ctx) => {
  const b = ctx.body, u = ctx.user, set = {};
  if ('name' in b){ const v = clean(b.name, 30); if (v.length < 2) bad('Name ist zu kurz.'); set.name = v; }
  if ('goal' in b){ if (b.goal && !GOALS.includes(b.goal)) bad('Ungültiges Ziel.'); set.goal = b.goal || ''; }
  if ('kids' in b){ if (!KIDS.includes(b.kids)) bad('Ungültige Angabe.'); set.kids = b.kids; }
  if ('amin' in b || 'amax' in b){ let lo = Math.max(18, Math.min(99, Number(b.amin ?? u.amin) || 18)), hi = Math.max(lo, Math.min(99, Number(b.amax ?? u.amax) || 99)); set.amin = lo; set.amax = hi; }
  if ('km' in b){ const v = Number(b.km); if (![25, 50, 100, 999].includes(v)) bad('Ungültige Entfernung.'); set.km = v; }
  if ('ftime' in b){ if (!['12:00', '18:00', '21:00'].includes(b.ftime)) bad('Ungültige Uhrzeit.'); set.ftime = b.ftime; }
  if ('seek' in b){ if (!SEEKS.includes(b.seek)) bad('Ungültig.'); set.seek = b.seek; }
  if ('about' in b) set.about = clean(b.about, 300).replace(/https?:\/\/\S+/gi, '[Link entfernt]');
  if ('interests' in b){ const a = [...new Set((Array.isArray(b.interests) ? b.interests : []).filter(x => INTERESTS.includes(x)))].slice(0, 3); set.interests = JSON.stringify(a); }
  if ('prompts' in b){ const a = (Array.isArray(b.prompts) ? b.prompts : []).filter(p => PROMPT_QS.includes(p?.q) && clean(p.a, 140)).slice(0, 3).map(p => ({ q: p.q, a: clean(p.a, 140).replace(/https?:\/\/\S+/gi, '[Link entfernt]') })); set.prompts = JSON.stringify(a); }
  if ('paused' in b) set.paused = b.paused ? 1 : 0;
  if ('lat' in b && 'lon' in b){ const la = Number(b.lat), lo = Number(b.lon); if (Math.abs(la) <= 90 && Math.abs(lo) <= 180){ set.lat = Math.round(la * 50) / 50; set.lon = Math.round(lo * 50) / 50; } }
  if (b.clearLocation){ set.lat = null; set.lon = null; }
  const keys = Object.keys(set); if (keys.length) db.prepare(`UPDATE users SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).run(...keys.map(k => set[k]), u.id);
  return myState(db.prepare('SELECT * FROM users WHERE id=?').get(u.id));
}, { auth: true });
route('POST', '/api/onboarding', (ctx) => {
  const b = ctx.body, ax = {}; for (const k of ['sp', 'na', 'hu', 'ge']) ax[k] = Math.max(-12, Math.min(12, Number(b.ax?.[k]) || 0));
  const tags = {}; for (const t of INTERESTS){ const v = Number(b.tags?.[t]); if (Number.isFinite(v)) tags[t] = Math.max(0, Math.min(1, v)); }
  const key = typeKey(ax); db.prepare('UPDATE users SET ax=?, tags=?, ftype=? WHERE id=?').run(JSON.stringify(ax), JSON.stringify(tags), key, ctx.user.id);
  track(ctx.user.id, 'onboarding_scored', { times: b.times }); return myState(db.prepare('SELECT * FROM users WHERE id=?').get(ctx.user.id));
}, { auth: true });
route('POST', '/api/finish', (ctx) => {
  const u = ctx.user; if (!u.ftype) bad('Bitte erst die Fragen beantworten.'); if (photoIds(u.id).length < 2) bad('Bitte lade mindestens 2 Fotos hoch.');
  if (!u.goal) bad('Bitte wähle dein Beziehungsziel.');
  db.prepare('UPDATE users SET onboarded=1 WHERE id=?').run(u.id); track(u.id, 'onboarded', ctx.body.times); return myState(db.prepare('SELECT * FROM users WHERE id=?').get(u.id));
}, { auth: true });
route('POST', '/api/photos', (ctx) => {
  limit('ph:' + ctx.user.id, 30, 3600e3); if (photoIds(ctx.user.id).length >= 6) bad('Maximal 6 Fotos.');
  const { buf } = checkImage(ctx.body.data, 450e3); const id = rid(16);
  db.prepare("INSERT INTO photos VALUES(?,?,'photo',?,?,?)").run(id, ctx.user.id, photoIds(ctx.user.id).length, buf, now());
  if (ctx.user.vstatus === 'approved') db.prepare("UPDATE users SET vstatus='pending' WHERE id=?").run(ctx.user.id);
  return { id };
}, { auth: true });
route('DELETE', '/api/photos/:id', (ctx) => { db.prepare("DELETE FROM photos WHERE id=? AND user_id=? AND kind='photo'").run(ctx.params.id, ctx.user.id); return { ok: true }; }, { auth: true });
route('POST', '/api/selfie', (ctx) => {
  limit('sf:' + ctx.user.id, 6, 3600e3); const { buf } = checkImage(ctx.body.data, 450e3);
  db.prepare("DELETE FROM photos WHERE user_id=? AND kind='selfie'").run(ctx.user.id); db.prepare("INSERT INTO photos VALUES(?,?,'selfie',0,?,?)").run(rid(16), ctx.user.id, buf, now());
  db.prepare("UPDATE users SET vstatus='pending' WHERE id=?").run(ctx.user.id); track(ctx.user.id, 'selfie'); return { ok: true };
}, { auth: true });
route('GET', '/api/picks', (ctx) => picksFor(ctx.user), { auth: true });
route('POST', '/api/picks/:id/pass', (ctx) => { db.prepare('INSERT OR IGNORE INTO passes VALUES(?,?)').run(ctx.user.id, Number(ctx.params.id)); track(ctx.user.id, 'pass'); return { ok: true }; }, { auth: true });
route('GET', '/api/profile/:id', (ctx) => {
  const o = db.prepare('SELECT * FROM users WHERE id=?').get(Number(ctx.params.id)); const me = ctx.user;
  if (!o || o.banned || !o.onboarded || blockedSet(me.id).has(o.id)) bad('Profil nicht gefunden.', 404);
  const known = db.prepare('SELECT 1 FROM picks WHERE user_id=? AND other_id=?').get(me.id, o.id) || db.prepare('SELECT 1 FROM sparks WHERE to_id=? AND from_id=?').get(me.id, o.id) || db.prepare('SELECT 1 FROM threads WHERE (a=? AND b=?) OR (a=? AND b=?)').get(me.id, o.id, o.id, me.id);
  if (!known) bad('Profil nicht gefunden.', 404);
  return pub(me, o, { score: score(me, o), reasons: reasons(me, o) });
}, { auth: true });
route('POST', '/api/spark/:id', (ctx) => {
  const me = ctx.user, oid = Number(ctx.params.id); if (me.vstatus !== 'approved') bad('Dein Profil wird noch geprüft.', 403);
  const o = db.prepare('SELECT * FROM users WHERE id=?').get(oid); if (!o || o.banned || !o.onboarded || oid === me.id || blockedSet(me.id).has(oid)) bad('Profil nicht gefunden.', 404);
  const day = berlin().day; limit('sp:' + me.id, 15, 864e5);
  const prompt = clean(ctx.body.prompt, 80), note = clean(ctx.body.note, 300);
  db.prepare('INSERT OR REPLACE INTO sparks VALUES(?,?,?,?,?)').run(me.id, oid, prompt, note, now()); track(me.id, 'spark');
  const back = db.prepare('SELECT * FROM sparks WHERE from_id=? AND to_id=?').get(oid, me.id);
  if (!back) return { matched: false };
  const a = Math.min(me.id, oid), b = Math.max(me.id, oid);
  let t = db.prepare('SELECT * FROM threads WHERE a=? AND b=?').get(a, b);
  if (t && !t.closed_by) return { matched: true, thread: t.id };
  if (t) bad('Dieses Gespräch wurde beendet.', 409);
  if (openThreads(me.id) >= 5) bad('Du hast schon fünf offene Chats. Beende einen, um neu zu starten.', 409);
  if (openThreads(oid) >= 5) return { matched: false };
  const r = db.prepare('INSERT INTO threads(a,b,created) VALUES(?,?,?)').run(a, b, now()); const id = Number(r.lastInsertRowid);
  systemMsg(id, `Gegenseitiger Funke! ${back.prompt ? `${o.name} hat auf „${back.prompt}“ reagiert.` : ''}`.trim());
  if (back.note) db.prepare("INSERT INTO messages(thread,sender,text,kind,created) VALUES(?,?,?,'text',?)").run(id, oid, back.note, now());
  if (note) db.prepare("INSERT INTO messages(thread,sender,text,kind,created) VALUES(?,?,?,'text',?)").run(id, me.id, note, now());
  track(me.id, 'match'); track(oid, 'match'); return { matched: true, thread: id };
}, { auth: true });
route('GET', '/api/threads', (ctx) => threadsFor(ctx.user), { auth: true });
route('GET', '/api/threads/:id', (ctx) => {
  const t = mustThread(ctx.user, ctx.params.id); const since = Number(ctx.query.since) || 0; const oid = t.a === ctx.user.id ? t.b : t.a;
  const o = db.prepare('SELECT * FROM users WHERE id=?').get(oid);
  const msgs = db.prepare('SELECT id,sender,text,kind,created FROM messages WHERE thread=? AND id>? ORDER BY id LIMIT 200').all(t.id, since).map(m => ({ id: m.id, mine: m.sender === ctx.user.id, text: m.text, kind: m.kind, t: m.created }));
  return { id: t.id, closed: !!t.closed_by, other: o ? { id: o.id, name: o.name, photo: photoIds(o.id)[0] || null } : { id: 0, name: 'Gelöschter Nutzer', photo: null }, messages: msgs };
}, { auth: true });
route('POST', '/api/threads/:id/messages', (ctx) => {
  const t = mustThread(ctx.user, ctx.params.id); if (t.closed_by) bad('Dieses Gespräch ist beendet.', 409); limit('msg:' + ctx.user.id, 40, 60e3);
  const kind = ['text', 'card', 'date'].includes(ctx.body.kind) ? ctx.body.kind : 'text'; const text = clean(ctx.body.text, 1000); if (!text) bad('Die Nachricht ist leer.');
  const oid = t.a === ctx.user.id ? t.b : t.a; if (blockedSet(ctx.user.id).has(oid)) bad('Gespräch nicht möglich.', 403);
  const r = db.prepare('INSERT INTO messages(thread,sender,text,kind,created) VALUES(?,?,?,?,?)').run(t.id, ctx.user.id, text, kind, now()); track(ctx.user.id, 'msg_' + kind);
  return { id: Number(r.lastInsertRowid) };
}, { auth: true });
route('POST', '/api/threads/:id/close', (ctx) => {
  const t = mustThread(ctx.user, ctx.params.id); if (t.closed_by) return { ok: true }; const i = Number(ctx.body.tpl); if (!(i >= 0 && i < FAREWELLS.length)) bad('Bitte wähle eine Nachricht.');
  const oid = t.a === ctx.user.id ? t.b : t.a, o = db.prepare('SELECT name FROM users WHERE id=?').get(oid);
  db.prepare("INSERT INTO messages(thread,sender,text,kind,created) VALUES(?,?,?,'text',?)").run(t.id, ctx.user.id, FAREWELLS[i](o?.name || ''), now());
  systemMsg(t.id, 'Gespräch freundlich beendet. Kein Ghosting, keine offenen Enden.'); db.prepare('UPDATE threads SET closed_by=?, closed_at=? WHERE id=?').run(ctx.user.id, now(), t.id); track(ctx.user.id, 'close'); return { ok: true };
}, { auth: true });
route('POST', '/api/report', (ctx) => {
  const b = ctx.body, me = ctx.user; limit('rep:' + me.id, 10, 3600e3); const tid = Number(b.userId); if (!tid || tid === me.id) bad('Ungültig.');
  if (!REASONS.includes(b.reason)) bad('Bitte wähle einen Grund.');
  db.prepare('INSERT INTO reports(reporter,target,thread,reason,text,created) VALUES(?,?,?,?,?,?)').run(me.id, tid, Number(b.threadId) || null, b.reason, clean(b.text, 500), now());
  db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?)').run(me.id, tid); closeBetween(me.id, tid, me.id); track(me.id, 'report'); return { ok: true };
}, { auth: true });
route('POST', '/api/block/:id', (ctx) => { const tid = Number(ctx.params.id); if (!tid || tid === ctx.user.id) bad('Ungültig.'); db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?)').run(ctx.user.id, tid); closeBetween(ctx.user.id, tid, ctx.user.id); return { ok: true }; }, { auth: true });
route('GET', '/api/wingman', (ctx) => ({ invite: ctx.user.invite, items: db.prepare('SELECT id,name,text,status,created FROM endorsements WHERE user_id=? AND status!=\'hidden\' ORDER BY id DESC').all(ctx.user.id) }), { auth: true });
route('POST', '/api/wingman/:id', (ctx) => { const st = ctx.body.status; if (!['approved', 'hidden'].includes(st)) bad('Ungültig.'); db.prepare('UPDATE endorsements SET status=? WHERE id=? AND user_id=?').run(st, Number(ctx.params.id), ctx.user.id); return { ok: true }; }, { auth: true });
route('GET', '/api/w/:code', (ctx) => { limit('wg:' + ctx.ip, 60, 3600e3); const u = db.prepare('SELECT name FROM users WHERE invite=? AND onboarded=1').get(clean(ctx.params.code, 20)); if (!u) bad('Einladung nicht gefunden.', 404); return { name: u.name }; });
route('POST', '/api/w/:code', (ctx) => {
  limit('wp:' + ctx.ip, 5, 3600e3); const u = db.prepare('SELECT id FROM users WHERE invite=? AND onboarded=1 AND banned=0').get(clean(ctx.params.code, 20)); if (!u) bad('Einladung nicht gefunden.', 404);
  const name = clean(ctx.body.name, 30), text = clean(ctx.body.text, 200).replace(/https?:\/\/\S+/gi, ''); if (name.length < 2 || text.length < 10) bad('Bitte gib deinen Namen und mindestens einen Satz an.');
  if (db.prepare("SELECT COUNT(*) c FROM endorsements WHERE user_id=? AND status!='hidden'").get(u.id).c >= 10) bad('Es gibt schon genug Empfehlungen.', 409);
  db.prepare('INSERT INTO endorsements(user_id,name,text,created) VALUES(?,?,?,?)').run(u.id, name, text, now()); return { ok: true };
});
route('POST', '/api/event', (ctx) => { limit('ev:' + ctx.user.id, 120, 3600e3); const n = clean(ctx.body.name, 40); if (/^[a-z_]+$/.test(n)) track(ctx.user.id, 'c_' + n, ctx.body.data); return { ok: true }; }, { auth: true });
route('POST', '/api/feedback', (ctx) => { limit('fb:' + ctx.user.id, 10, 3600e3); const b = ctx.body; db.prepare('INSERT INTO feedback(user_id,data,ts) VALUES(?,?,?)').run(ctx.user.id, JSON.stringify({ fun: Number(b.fun) || 0, fit: Number(b.fit) || 0, share: clean(b.share, 20), pay: clean(b.pay, 20), text: clean(b.text, 1000) }), now()); return { ok: true }; }, { auth: true });
route('GET', '/api/export', (ctx) => {
  const u = ctx.user, id = u.id; const { pw, ...me } = u;
  return { exportiert: new Date().toISOString(), konto: me, fotos: db.prepare("SELECT id,kind,created FROM photos WHERE user_id=?").all(id).map(p => ({ ...p, daten: 'data:image/jpeg;base64,' + Buffer.from(db.prepare('SELECT data FROM photos WHERE id=?').get(p.id).data).toString('base64') })),
    funken: db.prepare('SELECT * FROM sparks WHERE from_id=? OR to_id=?').all(id, id), chats: db.prepare('SELECT * FROM threads WHERE a=? OR b=?').all(id, id).map(t => ({ ...t, nachrichten: db.prepare('SELECT sender,text,kind,created FROM messages WHERE thread=?').all(t.id) })),
    vorschlaege: db.prepare('SELECT * FROM picks WHERE user_id=?').all(id), blockiert: db.prepare('SELECT * FROM blocks WHERE blocker=?').all(id), ereignisse: db.prepare('SELECT name,data,ts FROM events WHERE user_id=?').all(id), feedback: db.prepare('SELECT data,ts FROM feedback WHERE user_id=?').all(id), empfehlungen: db.prepare('SELECT name,text,status FROM endorsements WHERE user_id=?').all(id) };
}, { auth: true });
route('DELETE', '/api/me', (ctx) => {
  limit('del:' + ctx.user.id, 5, 3600e3); if (!checkPw(String(ctx.body.password || ''), ctx.user.pw)) bad('Das Passwort stimmt nicht.', 401); const id = ctx.user.id;
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE messages SET text='[Nachricht gelöscht]', sender=NULL WHERE sender=?").run(id);
    db.prepare("UPDATE threads SET closed_by=?, closed_at=? WHERE closed_by IS NULL AND (a=? OR b=?)").run(id, now(), id, id);
    for (const t of ['sessions', 'resets', 'photos', 'picks', 'passes', 'events', 'feedback', 'endorsements']) db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id);
    db.prepare('DELETE FROM sparks WHERE from_id=? OR to_id=?').run(id, id); db.prepare('DELETE FROM picks WHERE other_id=?').run(id); db.prepare('DELETE FROM passes WHERE other_id=?').run(id);
    db.prepare('DELETE FROM blocks WHERE blocker=?').run(id); db.prepare('UPDATE reports SET reporter=NULL WHERE reporter=?').run(id); db.prepare('UPDATE users SET ref=NULL WHERE ref=?').run(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id); db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  ctx.res.setHeader('Set-Cookie', 'fs=; HttpOnly; Path=/; Max-Age=0'); return { ok: true };
}, { auth: true });

/* Admin */
route('GET', '/api/admin/pending', () => db.prepare("SELECT id,name,age,gender,created FROM users WHERE vstatus='pending' AND banned=0 ORDER BY created").all().map(u => ({ ...u, selfie: db.prepare("SELECT id FROM photos WHERE user_id=? AND kind='selfie'").get(u.id)?.id, photos: photoIds(u.id) })), { admin: true });
route('POST', '/api/admin/verify/:id', (ctx) => { db.prepare('UPDATE users SET vstatus=? WHERE id=?').run(ctx.body.ok ? 'approved' : 'rejected', Number(ctx.params.id)); db.prepare("DELETE FROM photos WHERE user_id=? AND kind='selfie'").run(Number(ctx.params.id)); /* Selfie nach der Prüfung immer löschen */ return { ok: true }; }, { admin: true });
route('GET', '/api/admin/reports', () => db.prepare("SELECT r.*, u.name tname, u.banned tbanned FROM reports r LEFT JOIN users u ON u.id=r.target WHERE r.status='open' ORDER BY r.id DESC LIMIT 100").all(), { admin: true });
route('POST', '/api/admin/ban/:id', (ctx) => { db.prepare('UPDATE users SET banned=1 WHERE id=?').run(Number(ctx.params.id)); db.prepare('DELETE FROM sessions WHERE user_id=?').run(Number(ctx.params.id)); return { ok: true }; }, { admin: true });
route('POST', '/api/admin/report/:id', (ctx) => { db.prepare("UPDATE reports SET status='done' WHERE id=?").run(Number(ctx.params.id)); return { ok: true }; }, { admin: true });
route('GET', '/api/admin/stats', () => {
  const c = q => db.prepare(q).get().c; const ev = Object.fromEntries(db.prepare('SELECT name, COUNT(*) c FROM events GROUP BY name').all().map(r => [r.name, r.c]));
  const fb = db.prepare('SELECT data FROM feedback').all().map(r => J(r.data, {})); const avg = k => fb.length ? Math.round(fb.reduce((a, x) => a + (x[k] || 0), 0) / fb.length * 10) / 10 : null;
  return { nutzer: c('SELECT COUNT(*) c FROM users'), onboarded: c('SELECT COUNT(*) c FROM users WHERE onboarded=1'), geprueft: c("SELECT COUNT(*) c FROM users WHERE vstatus='approved'"), wartend: c("SELECT COUNT(*) c FROM users WHERE vstatus='pending'"), chats: c('SELECT COUNT(*) c FROM threads'), nachrichten: c('SELECT COUNT(*) c FROM messages'), funken: c('SELECT COUNT(*) c FROM sparks'), meldungenOffen: c("SELECT COUNT(*) c FROM reports WHERE status='open'"), ereignisse: ev, feedback: { anzahl: fb.length, spass: avg('fun'), treffend: avg('fit'), zahlenJa: fb.filter(x => x.pay === 'Ja').length, teilenJa: fb.filter(x => x.share === 'Ja').length } };
}, { admin: true });

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
function headers(res) { res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()'); if (cfg.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); }
function sendJson(res, code, obj) { const s = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(s); }
function readBody(req, max = 1.6e6) { return new Promise((resolve, reject) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > max){ reject(new HttpError(413, 'Anfrage zu groß.')); req.destroy(); } else ch.push(c); }); req.on('end', () => { if (!ch.length) return resolve({}); try { const o = JSON.parse(Buffer.concat(ch).toString('utf8')); resolve(o && typeof o === 'object' ? o : {}); } catch { reject(new HttpError(400, 'Ungültige Anfrage.')); } }); req.on('error', reject); }); }
function serveStatic(req, res, p) {
  if (p === '/' || p === '') p = '/index.html'; if (p === '/admin') p = '/admin.html';
  if (/^\/w\/[A-Za-z0-9]+$/.test(p)) p = '/wingman.html';
  let f = path.normalize(path.join(cfg.publicDir, decodeURIComponent(p))); if (!f.startsWith(cfg.publicDir)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(cfg.publicDir, 'index.html');
  const ext = path.extname(f); const long = ext === '.woff2'; if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Nicht gefunden'); }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': long ? 'public, max-age=31536000, immutable' : 'no-cache' }); const st = fs.createReadStream(f); st.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); }); st.pipe(res);
}
const server = http.createServer(async (req, res) => {
  headers(res); const url = new URL(req.url, 'http://x'); const p = url.pathname;
  try {
    if (p === '/healthz') return sendJson(res, 200, { ok: true });
    const m = /^\/photo\/([a-f0-9]{32})$/.exec(p);
    if (m) {
      const me = userOf(req); const adm = isAdmin(req); if (!me && !adm) return sendJson(res, 401, { error: 'Bitte anmelden.' });
      const ph = db.prepare('SELECT * FROM photos WHERE id=?').get(m[1]); if (!ph) return sendJson(res, 404, { error: 'Nicht gefunden.' });
      const owner = db.prepare('SELECT id,vstatus,banned FROM users WHERE id=?').get(ph.user_id);
      const allowed = adm || ph.user_id === me?.id || (ph.kind === 'photo' && owner && !owner.banned && !blockedSet(me.id).has(owner.id) && (owner.vstatus === 'approved'));
      if (!allowed) return sendJson(res, 404, { error: 'Nicht gefunden.' });
      const buf = Buffer.from(ph.data); const mime = buf[0] === 0x89 ? 'image/png' : buf[0] === 0x52 ? 'image/webp' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' }); return res.end(buf);
    }
    if (p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return sendJson(res, 403, { error: 'Ungültige Herkunft.' });
      if (req.method !== 'GET' && req.method !== 'DELETE' && !String(req.headers['content-type'] || '').includes('application/json')) return sendJson(res, 415, { error: 'Ungültiger Inhaltstyp.' });
      let hit = null, params = {}; for (const r of routes) { if (r.method !== req.method) continue; const mm = r.re.exec(p); if (mm) { hit = r; params = mm.groups || {}; break; } }
      if (!hit) return sendJson(res, 404, { error: 'Nicht gefunden.' });
      const ctx = { req, res, params, query: Object.fromEntries(url.searchParams), ip: ipOf(req), body: {} };
      if (hit.opts.admin){ if (!isAdmin(req)) return sendJson(res, 401, { error: 'Nur für Admins.' }); }
      else if (hit.opts.auth){ ctx.user = userOf(req); if (!ctx.user) return sendJson(res, 401, { error: 'Bitte melde dich an.' }); }
      if (req.method !== 'GET') ctx.body = await readBody(req);
      const out = await hit.fn(ctx); return sendJson(res, 200, out ?? { ok: true });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, p);
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.code, { error: e.message });
    console.error('[fehler]', req.method, req.url, e); sendJson(res, 500, { error: 'Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.' });
  }
});
if (require.main === module) {
  if (!cfg.admin) console.warn('[hinweis] ADMIN_TOKEN fehlt: Admin-Bereich und Fotoprüfung sind deaktiviert.');
  server.listen(cfg.port, () => console.log(`Funke läuft auf Port ${cfg.port}`));
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => { try { db.close(); } catch {} process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); });
}
module.exports = { server, db, cfg };
