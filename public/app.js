(() => {
'use strict';
/* ---------- Funkenfeld ---------- */
(() => { const c = document.getElementById('sparks'), x = c.getContext('2d'); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; let W, H; const ps = [];
  const size = () => { W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio; };
  size(); addEventListener('resize', size);
  for (let i = 0; i < 40; i++) ps.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .4, v: Math.random() * .0012 + .0004, w: Math.random() * 6.28, h: Math.random() < .7 ? 22 : 330 });
  const tick = () => { x.clearRect(0, 0, W, H); for (const p of ps) { p.y -= p.v; p.w += .02; if (p.y < -.05) { p.y = 1.05; p.x = Math.random(); } const px = (p.x + Math.sin(p.w) * .01) * W, py = p.y * H, r = p.r * devicePixelRatio; const g = x.createRadialGradient(px, py, 0, px, py, r * 6); g.addColorStop(0, `hsla(${p.h} 100% 65% / .9)`); g.addColorStop(1, `hsla(${p.h} 100% 50% / 0)`); x.fillStyle = g; x.beginPath(); x.arc(px, py, r * 6, 0, 6.28); x.fill(); } if (!reduce && !document.hidden) requestAnimationFrame(tick); };
  tick(); document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) requestAnimationFrame(tick); }); })();

/* ---------- Helfer ---------- */
const app = document.getElementById('app');
const $ = s => app.querySelector(s), $$ = s => [...app.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
class ApiError extends Error { constructor(m, code) { super(m); this.code = code; } }
async function api(method, url, body) {
  let r; try { r = await fetch(url, { method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); }
  catch { throw new ApiError('Keine Verbindung. Bitte prüfe dein Internet.', 0); }
  let data = null; try { data = await r.json(); } catch {}
  if (r.status === 401 && S.me && !/login|register/.test(url)) { S.me = null; S.scr = 'welcome'; render(); throw new ApiError('Bitte melde dich neu an.', 401); }
  if (!r.ok) throw new ApiError(data?.error || 'Etwas ist schiefgelaufen.', r.status);
  return data;
}
const ev = (name, data) => { if (S.me) api('POST', '/api/event', { name, data }).catch(() => {}); };
function toast(t) { S.toast = t; paintToast(); clearTimeout(toast.h); toast.h = setTimeout(() => { S.toast = null; paintToast(); }, 3000); }
function paintToast() { let el = app.querySelector('.toast'); if (!S.toast) { el && el.remove(); return; } if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); app.appendChild(el); } el.textContent = S.toast; }
const fail = e => toast(e.message || 'Etwas ist schiefgelaufen.');
async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg || 'Kopiert.'); } catch { const ta = document.createElement('textarea'); ta.value = text; app.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg || 'Kopiert.'); } catch { toast('Kopieren nicht möglich.'); } ta.remove(); } }
async function shareLink(text, url, msg) { if (navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } } copy(`${text} ${url}`, msg); }
const origin = location.origin;
const hueOf = id => [(id * 47) % 360, (id * 83 + 200) % 360];
const SIL = '<svg class="sil" viewBox="0 0 200 200" aria-hidden="true"><path fill="#fff" d="M100 26c24 0 40 18 40 42s-16 46-40 46-40-22-40-46 16-42 40-42Zm-78 174c4-40 36-70 78-70s74 30 78 70Z"/></svg>';
function aura(h, o = {}) { const [a, b] = h; return `<div class="aura" style="${o.style || ''}"><div class="fx" style="background:radial-gradient(circle at 25% 25%,hsl(${a} 95% 62%),transparent 55%),radial-gradient(circle at 80% 70%,hsl(${b} 85% 55%),transparent 55%),linear-gradient(160deg,hsl(${a} 60% 22%),hsl(${b} 55% 14%))"></div>${o.photo ? `<img class="ph" src="/photo/${o.photo}" alt="" loading="lazy">` : (o.ini ? `<div class="ini" style="font-size:${o.ini}px">${esc(o.letter)}</div>` : SIL)}${o.cap || ''}</div>`; }
const avatarOf = (o, sz) => `<div class="av" style="${sz ? `width:${sz}px;height:${sz}px` : ''}">${aura(hueOf(o.id), { photo: o.photo, ini: 20, letter: (o.name || '?')[0] })}</div>`;
const ring = s => { const r = 24, c = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 58 58" role="img" aria-label="${s} Prozent Passung"><circle cx="29" cy="29" r="${r}" fill="rgba(10,5,8,.55)" stroke="rgba(255,255,255,.18)" stroke-width="4"/><circle cx="29" cy="29" r="${r}" fill="none" stroke="#ff7a2e" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c * s / 100} ${c}" transform="rotate(-90 29 29)"/><text x="29" y="33" text-anchor="middle" font-size="13" fill="#fff3ea">${s}</text></svg>`; };
const ICON = {
  heute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8Z"/></svg>',
  chats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16v11H9l-5 4Z"/></svg>',
  wingman: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 20c1-4 4-5 6-5s5 1 6 5M13 15c1-.5 2-.5 4-.5 2 0 4 1 5 5"/></svg>',
  ich: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>'
};
const TAGS = ['Lachen', 'Natur', 'Stil', 'Sport', 'Kreativ', 'Ruhe'];
const GOALS = ['Feste Beziehung', 'Offen für alles', 'Erst mal kennenlernen'];
const PROMPT_QS = ['Mein perfekter Sonntag', 'Ich verliebe mich in', 'Mein Geheimtalent', 'Wir passen, wenn', 'Ein ehrlicher Satz über mich', 'Mein spontanster Moment'];
const MOODS = [
  { t: 'Lachen, bis die Luft wegbleibt', s: 'Albern sein ist erlaubt.', h: [30, 345], tags: ['Lachen'], ax: { hu: 1 } },
  { t: 'Sonnenaufgang auf dem Gipfel', s: 'Früh raus, Aussicht gewinnen.', h: [160, 200], tags: ['Natur', 'Sport'], ax: { sp: 1 } },
  { t: 'Flohmarkt und Kaffeehaus', s: 'Schätze finden, Menschen beobachten.', h: [330, 280], tags: ['Stil', 'Kreativ'], ax: { sp: -1 } },
  { t: 'Sonntag nur mit Buch', s: 'Handy aus, Decke an.', h: [265, 310], tags: ['Ruhe'], ax: { ge: -1, hu: -1 } },
  { t: 'Festival bis zum Morgengrauen', s: 'Laut, nass, unvergesslich.', h: [5, 45], tags: ['Sport', 'Lachen'], ax: { ge: 1, sp: 1 } },
  { t: 'Gespräch bis drei Uhr nachts', s: 'Über alles, was wirklich zählt.', h: [250, 300], tags: ['Ruhe', 'Kreativ'], ax: { hu: -1 } },
  { t: 'Kochen für zwölf Freunde', s: 'Zu viel Essen, zu viel Lachen.', h: [20, 355], tags: ['Stil', 'Lachen'], ax: { ge: 1 } },
  { t: 'Atelier, Musik, Experimente', s: 'Etwas bauen, das es nicht gibt.', h: [200, 150], tags: ['Kreativ'], ax: { na: 1 } }
];
const PAIRS = [
  [['Spontaner Roadtrip', { sp: 1 }], ['Geplanter Urlaub', { sp: -1 }]],
  [['Streit sofort klären', { na: 1 }], ['Erst mal abkühlen', { na: -1 }]],
  [['Comedy-Abend', { hu: 1 }], ['Gespräch bis drei Uhr', { hu: -1 }]],
  [['Party mit Freunden', { ge: 1 }], ['Sofa zu zweit', { ge: -1 }]],
  [['Jeden Tag schreiben', { na: 1 }], ['Melden, wenn was ist', { na: -1 }]],
  [['Neues Restaurant', { sp: 1 }], ['Der Stamm-Italiener', { sp: -1 }]]
];
const SCENES = [
  ['Sonntag, 10 Uhr. Du …', [['stehst auf dem Wochenmarkt und quatschst mit allen.', { ge: 1, sp: 1 }], ['liegst mit Kaffee und Buch im Bett.', { ge: -1, hu: -1 }], ['schreibst: Wer kommt mit zum See?', { sp: 1, ge: 1, hu: 1 }]]],
  ['Dein Date sagt kurzfristig ab. Du …', [['schreibst: Kein Ding, nächste Woche?', { na: -1, sp: 1 }], ['fragst, ob alles okay ist.', { na: 1, hu: -1 }], ['schickst ein lustiges GIF.', { hu: 1 }]]],
  ['Nach drei Dates wünschst du dir …', [['dass wir uns fast täglich hören.', { na: 1 }], ['dass jeder sein Leben behält.', { na: -1 }], ['dass wir was Verrücktes machen.', { sp: 1, hu: 1 }]]]
];
const CARDS = ['Was war das Beste an deiner Woche?', 'Worauf bist du stolz, was kaum jemand weiß?', 'Was bedeutet Zuhause für dich?'];
const REASONS = ['Unangemessene Nachricht oder Bilder', 'Fake-Profil oder Betrug', 'Bedrohung oder Belästigung', 'Minderjährig', 'Etwas anderes'];
const WHY = {
  picks: ['Wenige Vorschläge statt endlosem Stapel', 'Studien zur Wahlüberlastung zeigen: Je mehr Profile man nacheinander sieht, desto eher lehnt man ab und desto unzufriedener wird man (Pronk & Denissen, 2020). Funke begrenzt deshalb die Zahl der Vorschläge am Tag.'],
  learn: ['Lernen aus Reaktionen statt Wunschliste', 'Was Menschen vorab als Wunschkriterien nennen, sagt kaum voraus, wen sie beim echten Treffen anziehend finden (Eastwick & Finkel, 2008). Funke lernt aus Bauchreaktionen und Entscheidungen.'],
  reasons: ['Begründung zu jedem Vorschlag', 'Eine Begründung macht neugierig und senkt die Neigung, reflexhaft abzulehnen. Sie zeigt auch Unterschiede, weil Ergänzung genauso wichtig sein kann wie Ähnlichkeit.'],
  cards: ['Gesprächskarten mit steigender Tiefe', 'Schrittweise, gegenseitige Selbstöffnung erzeugt Nähe zwischen Fremden (Aron et al., 1997). Die drei Karten gehen von leicht zu tief.'],
  date: ['Sanfter Schubs zum Treffen', 'Lange Chats ohne Treffen bauen Fantasiebilder auf, die beim Date enttäuschen. Deshalb gibt es einen einfachen Date-Vorschlag direkt im Chat.'],
  end: ['Freundlich beenden statt Ghosting', 'Ghosting gehört zu den Hauptgründen für Dating-Burnout; 78 % der Nutzer fühlen sich zumindest manchmal erschöpft (Forbes Health, 2024).'],
  safety: ['Sicherheit eingebaut', 'In den USA haben 56 % der Nutzerinnen unter 50 ungefragt sexuelle Inhalte bekommen (Pew Research, 2023). Deshalb: Foto-Prüfung für alle, Melden mit einem Tipp, sofortiges Blockieren.'],
  wingman: ['Freunde spielen mit', 'Bevor Apps übernahmen, lernten sich Paare sehr häufig über Freunde kennen (Rosenfeld, Thomas & Hausen, 2019). Der Wingman bringt dieses Vertrauen zurück.']
};
const why = k => S.research ? `<button class="why" data-why="${k}">◆ Warum so?</button>` : '';

/* ---------- Zustand ---------- */
const S = { me: null, scr: 'boot', tab: 'heute', view: null, research: store.get('research', false), picks: null, threads: [], chat: null, sheet: null, overlay: null, toast: null,
  ob: { ax: { sp: 0, na: 0, hu: 0, ge: 0 }, votes: {}, mi: 0, pr: 0, sc: 0, times: {}, tl: Date.now(), about: '', interests: [], prompts: [{ q: PROMPT_QS[0], a: '' }, { q: PROMPT_QS[2], a: '' }] }, busy: false, seen: store.get('funke-seen', {}), install: null, wingman: null, curProfile: null };
const ONB = ['goals', 'mood', 'pairs', 'scenes', 'profile', 'photos', 'selfie', 'reveal'];
const mark = () => { const n = Date.now(); const k = S.scr; S.ob.times[k] = (S.ob.times[k] || 0) + Math.round((n - S.ob.tl) / 1000); S.ob.tl = n; };
const go = scr => { if (ONB.includes(S.scr)) mark(); S.scr = scr; S.view = null; render(); const sc = $('#sc'); if (sc) sc.scrollTop = 0; };
const sheet = (k, a) => { S.sheet = { k, a }; render(); };
const closeSheet = () => { S.sheet = null; render(); };
const unread = () => S.threads.some(t => t.last && !t.last.mine && t.last.id > (S.seen[t.id] || 0) && !t.closed);
const markSeen = (tid, id) => { if ((S.seen[tid] || 0) < id) { S.seen[tid] = id; store.set('funke-seen', S.seen); } };
function resumePoint() { const m = S.me; if (!m.goal) return 'goals'; if (!m.type) return 'mood'; if (!m.about && !m.interests.length) return 'profile'; if (m.photos.length < 2) return 'photos'; if (m.vstatus === 'none') return 'selfie'; return 'reveal'; }

/* ---------- Bildschirme: Start ---------- */
const FIELD = (id, label, type, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val || '')}" ${extra}></div>`;
const SCR = {
  boot: () => '<div style="flex:1"></div><p class="muted" style="text-align:center">Funke lädt …</p><div style="flex:1"></div>',
  welcome: () => `<div style="flex:1"></div><div class="stack" style="gap:16px"><div class="eyebrow">Dating, das zuhört</div>
    <h1>Erzähl uns nicht, was du suchst.<br><span class="hot">Zeig's uns.</span></h1>
    <p class="muted" style="font-size:16px">Fünf Minuten spielen. Dann zeigt dir Funke wenige Menschen, die wirklich passen, und sagt dir, warum.</p></div>
    <div class="stack"><button class="btn fire w" data-act="to-register">Funken zünden</button><button class="btn line w" data-act="to-login">Ich habe schon ein Konto</button>
    <p class="disclaim">Ab 18 Jahren. <a class="link" href="/legal/datenschutz.html" target="_blank" rel="noopener">Datenschutz</a> · <a class="link" href="/legal/nutzungsbedingungen.html" target="_blank" rel="noopener">Nutzungsbedingungen</a> · <a class="link" href="/legal/impressum.html" target="_blank" rel="noopener">Impressum</a></p></div>`,
  register: () => `<button class="backlink" data-act="to-welcome">← Zurück</button><h2>Willkommen bei Funke.</h2>
    ${FIELD('f-name', 'Vorname', 'text', '', 'autocomplete="given-name" maxlength="30"')}${FIELD('f-age', 'Alter', 'number', '', 'inputmode="numeric" min="18" max="99"')}
    <div class="field"><label>Ich bin</label><div class="choice three" data-g="gender">${[['w', 'Frau'], ['m', 'Mann'], ['d', 'Divers']].map(([k, l]) => `<button class="opt" data-v="${k}" aria-pressed="${S.form?.gender === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label>Ich interessiere mich für</label><div class="choice three" data-g="seek">${[['w', 'Frauen'], ['m', 'Männer'], ['alle', 'Alle']].map(([k, l]) => `<button class="opt" data-v="${k}" aria-pressed="${S.form?.seek === k}">${l}</button>`).join('')}</div></div>
    ${FIELD('f-email', 'E-Mail', 'email', '', 'autocomplete="email"')}${FIELD('f-pw', 'Passwort (mind. 10 Zeichen)', 'password', '', 'autocomplete="new-password"')}
    <label class="check"><input type="checkbox" id="f-18"><span>Ich bin mindestens 18 Jahre alt.</span></label>
    <label class="check"><input type="checkbox" id="f-consent"><span>Ich habe die <a href="/legal/datenschutz.html" target="_blank" rel="noopener">Datenschutzerklärung</a> und die <a href="/legal/nutzungsbedingungen.html" target="_blank" rel="noopener">Nutzungsbedingungen</a> gelesen. Ich willige ausdrücklich ein, dass Funke meine Angaben zu Beziehungswünschen und Orientierung, die Fotos und mein Verhalten in der App zum Zweck der Partnervermittlung verarbeitet. Ich kann das jederzeit widerrufen, indem ich mein Konto lösche.</span></label>
    <p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="register">Konto erstellen</button>`,
  login: () => `<button class="backlink" data-act="to-welcome">← Zurück</button><h2>Schön, dass du wieder da bist.</h2>${FIELD('f-email', 'E-Mail', 'email', '', 'autocomplete="email"')}${FIELD('f-pw', 'Passwort', 'password', '', 'autocomplete="current-password"')}
    <p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="login">Anmelden</button><button class="link" data-act="to-forgot" style="align-self:center">Passwort vergessen?</button>`,
  forgot: () => `<button class="backlink" data-act="to-login">← Zurück</button><h2>Passwort zurücksetzen</h2><p class="muted small">Wir senden dir einen Link per E-Mail.</p>${FIELD('f-email', 'E-Mail', 'email', '', 'autocomplete="email"')}<p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="forgot">Link senden</button>`,
  reset: () => `<h2>Neues Passwort</h2>${FIELD('f-pw', 'Neues Passwort (mind. 10 Zeichen)', 'password', '', 'autocomplete="new-password"')}<p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="reset">Speichern</button>`
};
const FILTERS = (m) => `<div class="field"><label>Ich suche</label><div class="choice three" data-f="goal">${GOALS.map(v => `<button class="opt" data-v="${v}" aria-pressed="${m.goal === v}" style="font-size:13px">${v}</button>`).join('')}</div></div>
  <div class="field"><label>Alter von bis</label><div class="row" style="flex-wrap:nowrap"><input id="amin" inputmode="numeric" value="${m.amin}" aria-label="Mindestalter"><span class="muted">bis</span><input id="amax" inputmode="numeric" value="${m.amax}" aria-label="Höchstalter"></div></div>
  <div class="field"><label>Entfernung <span class="small" style="text-transform:none;letter-spacing:0">${m.hasLocation ? '' : '(braucht deinen Standort, siehe Ich)'}</span></label><div class="choice" style="grid-template-columns:repeat(4,1fr)" data-f="km">${[[25, '25 km'], [50, '50 km'], [100, '100 km'], [999, 'Egal']].map(([v, l]) => `<button class="opt" data-v="${v}" aria-pressed="${m.km === v}">${l}</button>`).join('')}</div></div>
  <div class="field"><label>Kinderwunsch</label><div class="choice three" data-f="kids">${['Ja', 'Offen', 'Nein'].map(v => `<button class="opt" data-v="${v}" aria-pressed="${m.kids === v}">${v}</button>`).join('')}</div></div>`;
const head = (label, i) => `<div class="row" style="justify-content:space-between"><div class="eyebrow">${label}</div>${i ? `<span class="small muted">${i}</span>` : ''}</div>`;
Object.assign(SCR, {
  goals: () => `<div class="eyebrow">Schritt 1 · Deine Grenzen</div><h2>Ein paar harte Fakten. Den Rest lernen wir.</h2><p class="muted small">Nur das, was wirklich nicht verhandelbar ist. Alles andere zeigt uns dein Bauch.</p>${FILTERS(S.me)}<p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="goals-next">Weiter</button>`,
  mood: () => { const m = MOODS[S.ob.mi]; return `${head('Schritt 2 · Funkt es?', `${S.ob.mi + 1} / ${MOODS.length}`)}<p class="muted small">Folge deinem Bauch. Wisch nach rechts für Funkt, links für Nein, nach oben für Vielleicht.</p>
    <div class="deck">${MOODS[S.ob.mi + 1] ? `<div class="swipe" style="transform:scale(.94) translateY(14px);opacity:.6">${aura(MOODS[S.ob.mi + 1].h, { style: 'height:100%' })}</div>` : ''}
    <div class="swipe" id="card">${aura(m.h, { style: 'height:100%', cap: `<div class="cap"><div class="nm" style="font-size:28px">${esc(m.t)}</div><p class="small" style="margin-top:6px">${esc(m.s)}</p></div>` })}<div class="stamp yes">FUNKT</div><div class="stamp no">NEIN</div><div class="stamp maybe">VIELLEICHT</div></div></div>
    <div class="vbtns"><button class="round" data-v="nein" aria-label="Nein">Nein</button><button class="round" data-v="vielleicht" aria-label="Vielleicht">Hm</button><button class="round fire" data-v="ja" aria-label="Funkt">Funkt</button></div>
    ${S.ob.mi > 0 ? '<button class="backlink" data-act="undo" style="align-self:center">↶ Letzte Entscheidung zurücknehmen</button>' : ''}${why('learn')}`; },
  pairs: () => { const [a, b] = PAIRS[S.ob.pr]; return `${head('Schritt 3 · Dies oder das', `${S.ob.pr + 1} / ${PAIRS.length}`)}<h2>Schnell. Nicht nachdenken.</h2><div class="split"><button data-i="0">${a[0]}</button><div class="or">ODER</div><button data-i="1">${b[0]}</button></div>`; },
  scenes: () => { const [q, o] = SCENES[S.ob.sc]; return `${head('Schritt 4 · Alltagsszenen', `${S.ob.sc + 1} / ${SCENES.length}`)}<div class="bubble q" style="font-family:var(--display);font-weight:700;font-size:20px">${q}</div><div class="stack">${o.map((x, i) => `<button class="ans" data-i="${i}">… ${x[0]}</button>`).join('')}</div>`; },
  profile: () => `<div class="eyebrow">Schritt 5 · Über dich</div><h2>Ein paar Worte, die nach dir klingen.</h2>
    <div class="field"><label>Das macht mich aus (bis zu 3)</label><div class="row" data-g="interests">${TAGS.map(t => `<button class="opt" style="padding:10px 14px" data-v="${t}" aria-pressed="${S.ob.interests.includes(t)}">${t}</button>`).join('')}</div></div>
    <div class="field"><label for="about">Kurz über mich</label><textarea id="about" maxlength="300" placeholder="Zwei, drei Sätze, die dich beschreiben.">${esc(S.ob.about)}</textarea></div>
    ${S.ob.prompts.map((p, i) => `<div class="field"><label for="pq${i}">Frage ${i + 1}</label><select id="pq${i}" data-pq="${i}" style="font:inherit;color:var(--ink);background:var(--coal);border:1px solid var(--line);border-radius:16px;padding:12px">${PROMPT_QS.map(q => `<option ${q === p.q ? 'selected' : ''}>${q}</option>`).join('')}</select><input id="pa${i}" maxlength="140" placeholder="Deine Antwort" value="${esc(p.a)}"></div>`).join('')}
    <p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="profile-next">Weiter</button>`,
  photos: () => `<div class="eyebrow">Schritt 6 · Deine Fotos</div><h2>Zeig dich, wie Freunde dich kennen.</h2><p class="muted small">Mindestens 2, höchstens 6 Fotos. Nur Fotos, auf denen du selbst zu sehen bist.</p>
    <div class="slots">${Array.from({ length: 6 }, (_, i) => { const id = S.me.photos[i]; return id ? `<div class="slot photo-slot"><img src="/photo/${id}" alt="Foto ${i + 1}"><button class="rm" data-rm="${id}" aria-label="Foto ${i + 1} löschen">×</button></div>` : `<button class="slot" data-act="pick-photo" aria-label="Foto hinzufügen">+</button>`; }).join('')}</div>
    <input type="file" id="file" accept="image/*" class="sr" tabindex="-1">
    <div class="card"><h3>Profil-Coach</h3><p class="small muted">${S.me.photos.length === 0 ? 'Tipp: Ein Foto, auf dem du lachst, und eines bei etwas, das du liebst, erzählen mehr als fünf Selfies.' : S.me.photos.length < 3 ? 'Gut! Noch ein Foto mit Freunden oder bei deinem Hobby?' : 'Starke Auswahl.'}</p></div>
    ${S.view === 'photos' ? '<button class="btn fire w" data-act="back">Fertig</button>' : `<button class="btn fire w" data-act="photos-next" ${S.me.photos.length < 2 ? 'disabled' : ''}>${S.me.photos.length < 2 ? 'Mindestens 2 Fotos' : 'Weiter'}</button>`}`,
  selfie: () => `<div class="eyebrow">Schritt 7 · Echt sein</div><h2>Ein Selfie, damit nur echte Menschen hier sind.</h2><p class="muted small">Unser Team vergleicht dein Selfie mit deinen Fotos, meist innerhalb von 24 Stunden. Das Selfie wird nie anderen gezeigt und nach der Prüfung nicht weiter genutzt.</p>
    <div class="scan ${S.me.vstatus === 'pending' ? 'done' : ''}">${S.me.vstatus === 'pending' ? '<h3 style="color:var(--mint)">Eingereicht</h3>' : '<span class="muted small">Selfie aufnehmen</span>'}</div>
    <input type="file" id="selfie-file" accept="image/*" capture="user" class="sr" tabindex="-1">${why('safety')}
    <button class="btn fire w" data-act="${S.me.vstatus === 'pending' ? 'selfie-next' : 'take-selfie'}">${S.me.vstatus === 'pending' ? 'Weiter' : 'Selfie aufnehmen'}</button>`,
  reveal: () => { const t = S.me.type; return `<div class="eyebrow">Dein Funke-Typ</div>
    <div class="typecard"><div class="fx" style="background:radial-gradient(circle at 30% 30%,hsl(${t.h[0]} 95% 60%),transparent 50%),radial-gradient(circle at 75% 70%,hsl(${t.h[1]} 85% 55%),transparent 50%),#2b1220"></div>
    <div class="small" style="font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.85">${esc(S.me.name)} ist</div><div class="tname">${esc(t.name)}</div><p style="font-size:16px;font-weight:600">${esc(t.lead)}</p>
    <ul>${t.tr.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="small" style="opacity:.75;margin-top:6px">funke · Welcher Typ bist du?</div></div>
    <div class="stack">${S.me.insights.map(i => `<div class="insight">${esc(i)}</div>`).join('')}</div>
    <div class="cta-row"><button class="btn line" data-act="share-type">Als Bild teilen</button><button class="btn line" data-act="share-invite">Freunde einladen</button></div>
    <button class="btn fire w" data-act="enter">Los geht's</button>`; }
});

/* ---------- Tabs ---------- */
const statusBox = () => { const v = S.me.vstatus; if (v === 'approved') return ''; if (v === 'pending') return '<div class="status warn"><b>Dein Profil wird geprüft.</b><br>Das dauert meist weniger als 24 Stunden. Du kannst solange schon dein Profil verbessern und Freunde einladen.</div>'; if (v === 'rejected') return '<div class="status warn"><b>Wir konnten dein Selfie nicht zuordnen.</b><br>Bitte nimm ein neues Selfie auf, auf dem dein Gesicht gut zu sehen ist.<br><button class="btn line" style="margin-top:10px" data-act="take-selfie">Neues Selfie</button><input type="file" id="selfie-file" accept="image/*" capture="user" class="sr" tabindex="-1"></div>'; return '<div class="status warn"><b>Ein Schritt fehlt noch.</b><br>Bitte reiche ein Selfie ein.<br><button class="btn line" style="margin-top:10px" data-act="take-selfie">Selfie aufnehmen</button><input type="file" id="selfie-file" accept="image/*" capture="user" class="sr" tabindex="-1"></div>'; };
const pickCard = (p, inc) => `<button class="pick" data-id="${p.id}">${aura(hueOf(p.id), { style: 'height:400px', photo: p.photos[0], cap: `<div class="cap">${inc ? '<div class="eyebrow" style="margin-bottom:6px;color:var(--mint)">Hat dir gefunkt</div>' : ''}<div class="nm">${esc(p.name)}, ${p.age}</div><p class="small" style="margin-top:6px">${esc(p.reasons[0] || '')}</p><div class="tags" style="margin-top:8px"><span class="tag">${esc(p.goal || '')}</span></div></div>` })}${ring(p.score)}</button>`;
const TAB = {
  heute: () => {
    const day = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); const d = S.picks; let body = '';
    if (S.me.paused) return `<div class="eyebrow">${day}</div><h2>Du machst gerade Pause.</h2><p class="muted">Niemand sieht dein Profil. Deine Chats bleiben. Komm zurück, wann du willst.</p><button class="btn fire w" data-act="unpause">Pause beenden</button>`;
    if (!d) return `<div class="eyebrow">${day}</div><h2>Einen Moment …</h2>`;
    const all = [...d.incoming.map(p => ({ p, inc: true })), ...d.picks.map(p => ({ p }))];
    if (S.me.vstatus !== 'approved') body = statusBox();
    else if (!d.ready) body = `<div class="status ok"><b>Dein Funke kommt heute um ${esc(d.at)} Uhr.</b><br>Bis dahin: Lade Freunde ein. Für jeden, der mitmacht, gibt es einen zusätzlichen Vorschlag (bis zu 3).</div>`;
    else if (!all.length) body = '<div class="status ok"><b>Wir sammeln gerade Menschen, die zu dir passen.</b><br>Funke ist noch ganz neu. Je mehr Freunde mitmachen, desto schneller füllt sich dein Funke des Tages. Schau morgen wieder vorbei.</div>';
    else body = `<div class="carousel">${all.map(x => pickCard(x.p, x.inc)).join('')}</div>`;
    return `<div class="eyebrow">${day} · ${esc(S.me.ftime)} Uhr</div><h2>${esc(S.me.name)}, dein Funke des Tages.</h2>
      ${all.length ? `<p class="muted small">${all.length} ${all.length === 1 ? "Mensch" : "Menschen"}, ausgewählt aus deinen Reaktionen. Morgen um ${esc(S.me.ftime)} Uhr kommen neue.</p>${why('picks')}` : ''}${body}
      <div class="card"><h3>Mehr Funken mit Freunden</h3><p class="small muted">${S.me.referred} von 3 Freunden sind schon dabei. Jeder bringt dir einen zusätzlichen Vorschlag am Tag.</p><button class="btn line" data-act="share-invite">Einladung teilen</button></div>`;
  },
  chats: () => { const ts = S.threads; if (!ts.length) return '<div class="eyebrow">Chats</div><h2>Noch kein Funke zurück.</h2><p class="muted">Reagiere auf etwas Konkretes in einem Profil. Das ist der beste Gesprächsstart.</p><button class="btn fire w" data-act="tab-heute">Zu deinen Vorschlägen</button>';
    const open = ts.filter(t => !t.closed).length; return `<div class="eyebrow">Chats · ${open} von max. 5</div><h2>Deine Funken</h2><p class="small muted">Höchstens fünf offene Gespräche, damit jedes Aufmerksamkeit bekommt.</p><div class="stack">${ts.map(t => { const u = t.last && !t.last.mine && t.last.id > (S.seen[t.id] || 0) && !t.closed; return `<button class="list-item" data-chat="${t.id}">${avatarOf(t.other)}<div class="grow" style="min-width:0"><b>${esc(t.other.name)}</b><p class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.closed ? 'Beendet' : t.last ? esc(t.last.text) : 'Sag hallo'}</p></div>${u ? '<span class="dot" style="position:static"></span>' : ''}</button>`; }).join('')}</div>`; },
  wingman: () => { const w = S.wingman; const link = `${origin}/w/${S.me.invite}`; return `<div class="eyebrow">Wingman</div><h2>Deine Freunde kennen dich am besten.</h2>${why('wingman')}
    <div class="stack small"><div class="reason"><b>1</b><span>Schick deinen Freunden den Wingman-Link. Sie brauchen kein Konto.</span></div><div class="reason"><b>2</b><span>Sie schreiben eine kurze Empfehlung über dich.</span></div><div class="reason"><b>3</b><span>Du entscheidest, welche auf deinem Profil erscheint.</span></div></div>
    <button class="btn fire w" data-act="share-wingman">Wingman-Link teilen</button><p class="small muted" style="word-break:break-all">${esc(link)}</p>
    ${w ? (w.items.length ? `<div class="stack">${w.items.map(e => `<div class="endorse stack"><div class="eyebrow" style="color:var(--mint)">${esc(e.name)} ${e.status === 'approved' ? '· auf deinem Profil' : '· wartet auf dich'}</div><p style="font-weight:600">„${esc(e.text)}“</p><div class="row">${e.status === 'approved' ? '' : `<button class="btn fire" data-e="${e.id}" data-st="approved">Zeigen</button>`}<button class="btn line" data-e="${e.id}" data-st="hidden">Verbergen</button></div></div>`).join('')}</div>` : '<p class="small muted">Noch keine Empfehlungen.</p>') : ''}`; },
  ich: () => { const m = S.me, t = m.type; return `<div class="eyebrow">Ich</div>
    <div class="typecard" style="min-height:220px"><div class="fx" style="background:radial-gradient(circle at 30% 30%,hsl(${t.h[0]} 95% 60%),transparent 50%),radial-gradient(circle at 75% 70%,hsl(${t.h[1]} 85% 55%),transparent 50%),#2b1220"></div><div class="small" style="font-weight:700;letter-spacing:.14em;text-transform:uppercase">${esc(m.name)}, ${m.age}</div><div class="tname" style="font-size:36px">${esc(t.name)}</div><p>${esc(t.lead)}</p></div>
    ${statusBox()}
    <div class="card"><h3>Was Funke über dich gelernt hat</h3>${m.insights.map(i => `<p class="small">${esc(i)}</p>`).join('')}</div>
    <div class="cta-row"><button class="btn line" data-act="edit-profile">Profil bearbeiten</button><button class="btn line" data-act="share-type">Typ als Bild</button></div>
    <button class="btn line w" data-act="my-photos">Fotos verwalten (${m.photos.length}/6)</button>
    <div class="card"><h3>Deine Grenzen</h3><p class="small muted">${esc(m.goal || 'Ziel offen')} · ${m.amin} bis ${m.amax} Jahre · ${m.km >= 999 ? 'Entfernung egal' : 'bis ' + m.km + ' km'}${m.kids ? ' · Kinderwunsch: ' + esc(m.kids) : ''}</p><button class="btn line" data-act="filters">Ändern</button></div>
    <div class="card"><h3>Dein Funke kommt um</h3><div class="choice three" data-f="ftime">${['12:00', '18:00', '21:00'].map(v => `<button class="opt" data-v="${v}" aria-pressed="${m.ftime === v}">${v}</button>`).join('')}</div></div>
    <div class="card"><div class="setting"><div><h3>Standort</h3><p class="small muted">${m.hasLocation ? 'Nur auf ca. 1 km genau gespeichert, anderen zeigen wir nur grobe Entfernungen.' : 'Für den Entfernungs-Filter. Freiwillig.'}</p></div><button class="btn line" data-act="${m.hasLocation ? 'loc-off' : 'loc-on'}">${m.hasLocation ? 'Entfernen' : 'Teilen'}</button></div></div>
    <div class="card"><div class="setting"><div><h3>Pause</h3><p class="small muted">Unsichtbar werden, Chats behalten.</p></div><button class="switch" role="switch" aria-checked="${m.paused}" aria-label="Pause" data-act="pause"></button></div>
    <div class="setting"><div><h3>Forschungs-Modus</h3><p class="small muted">Zeigt bei Funktionen, auf welcher Forschung sie beruhen.</p></div><button class="switch" role="switch" aria-checked="${S.research}" aria-label="Forschungs-Modus" data-act="research"></button></div></div>
    <div class="card"><h3>Funke Plus</h3><p class="small muted">${m.plusEnabled ? 'Aktiv.' : 'Kommt bald: tiefere Analyse und Date-Concierge. Bezahlt wird nie für Sichtbarkeit. Während des Starts ist alles kostenlos.'}</p>${m.plusEnabled ? '' : '<button class="btn line" data-act="plus-interest">Ich habe Interesse</button>'}</div>
    ${S.install ? '<button class="btn fire w" data-act="install">App auf dem Startbildschirm installieren</button>' : '<p class="small muted installbar">Tipp: Im Browser-Menü „Zum Startbildschirm hinzufügen“ wählen, dann öffnet sich Funke wie eine App.</p>'}
    <button class="btn line w" data-act="feedback">Feedback an das Funke-Team</button>
    <div class="card"><h3>Deine Daten</h3><button class="btn line" data-act="export">Alle Daten herunterladen</button><button class="btn line" data-act="delete" style="color:var(--gold)">Konto löschen</button></div>
    <button class="btn line w" data-act="logout">Abmelden</button>
    <p class="disclaim" style="text-align:center"><a class="link" href="/legal/datenschutz.html" target="_blank" rel="noopener">Datenschutz</a> · <a class="link" href="/legal/nutzungsbedingungen.html" target="_blank" rel="noopener">Nutzungsbedingungen</a> · <a class="link" href="/legal/impressum.html" target="_blank" rel="noopener">Impressum</a></p>`; }
};
const VIEW = {
  profile: () => { const p = S.curProfile; if (!p) return ''; const has = S.threads.some(t => t.other.id === p.id && !t.closed);
    return `<button class="backlink" data-act="back">← Zurück</button>
    ${aura(hueOf(p.id), { style: 'height:440px', photo: p.photos[0], cap: `<div class="cap"><div class="nm" style="font-size:38px">${esc(p.name)}, ${p.age}</div><p class="small" style="margin:6px 0 10px">${p.km ? `ca. ${p.km} km · ` : ''}verifiziert · ${esc(p.type)}</p></div>` })}
    ${p.photos.length > 1 ? `<div class="row" style="flex-wrap:nowrap;overflow-x:auto">${p.photos.slice(1).map(id => `<img src="/photo/${id}" alt="" style="height:120px;border-radius:16px;flex:none">`).join('')}</div>` : ''}
    <div class="tags"><span class="tag" style="background:rgba(255,177,59,.3)">${esc(p.goal || 'Offen')}</span>${p.kids ? `<span class="tag">Kinderwunsch: ${esc(p.kids)}</span>` : ''}${p.interests.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="card"><div class="row" style="justify-content:space-between"><h3>Warum ihr zwei</h3><span class="hot" style="font-family:var(--display);font-weight:900;font-size:22px">${p.score} %</span></div>${p.reasons.map((r, i) => `<div class="reason"><b>${i + 1}</b><span class="small">${esc(r)}</span></div>`).join('')}${why('reasons')}</div>
    ${p.incoming ? `<div class="endorse stack"><div class="eyebrow" style="color:var(--mint)">${esc(p.name)} hat dir gefunkt</div>${p.incoming.prompt ? `<p class="small muted">Reaktion auf: ${esc(p.incoming.prompt)}</p>` : ''}${p.incoming.note ? `<p style="font-weight:600">„${esc(p.incoming.note)}“</p>` : ''}<button class="btn fire" data-act="spark-back">Zurückfunken</button></div>` : ''}
    ${p.about ? `<div class="prompt"><span class="q">Über mich</span><span class="a" style="font-size:16px;font-family:var(--body);font-weight:500">${esc(p.about)}</span></div>` : ''}
    ${p.prompts.map((q, i) => `<div class="prompt"><span class="q">${esc(q.q)}</span><span class="a">${esc(q.a)}</span>${has ? '' : `<button class="btn line" data-react="${i}">Funken senden</button>`}</div>`).join('')}
    ${p.endorsements.map(e => `<div class="endorse stack"><div class="eyebrow" style="color:var(--mint)">Wingman · ${esc(e.name)}</div><p style="font-weight:600">„${esc(e.text)}“</p></div>`).join('')}
    ${has ? '' : '<button class="btn line w" data-act="pass">Nicht für mich</button>'}
    <button class="backlink" data-act="report-profile">Melden oder blockieren</button>`; },
  feedback: () => '',
  me: () => ''
};
const msgHtml = m => `<div class="m ${m.kind === 'sys' ? 'sys' : m.mine ? 'me' : 'them'}" data-mid="${m.id}">${m.kind === 'card' ? '🃏 ' : m.kind === 'date' ? '📅 ' : ''}${esc(m.text)}</div>`;
function chatView() { const c = S.chat; const closed = c.closed;
  return { head: `<div class="chathead"><button class="backlink" data-act="back" aria-label="Zurück">←</button>${avatarOf(c.other, 42)}<div class="grow" style="min-width:0"><b>${esc(c.other.name)}</b>${closed ? '<p class="small muted">Beendet</p>' : ''}</div>${closed ? '' : '<button class="pill" data-act="card">Karte</button><button class="pill" data-act="dateplan">Date</button><button class="pill" data-act="endchat">Beenden</button>'}<button class="pill" data-act="report-chat" aria-label="Melden">⋯</button></div>`,
    body: `<div class="msgs" id="msgs">${c.messages.map(msgHtml).join('')}</div>`, foot: closed ? '' : `<div class="composer"><input id="msg" placeholder="Nachricht an ${esc(c.other.name)}" aria-label="Nachricht" maxlength="1000"><button class="btn fire" data-act="send">Senden</button></div>` }; }

const SHEET = {
  why: k => `<div class="eyebrow" style="color:var(--mint)">Forschung hinter der Funktion</div><h3>${WHY[k][0]}</h3><p>${WHY[k][1]}</p><p class="disclaim">Quellen sind Kurzangaben. Vor einer Veröffentlichung im Original prüfen.</p><button class="btn line w" data-act="close">Verstanden</button>`,
  react: a => { const p = S.curProfile; const q = a == null ? null : p.prompts[a]; return `<div class="eyebrow">Funken senden an ${esc(p.name)}</div>${q ? `<div class="prompt"><span class="q">${esc(q.q)}</span><span class="a">${esc(q.a)}</span></div>` : ''}<input id="rin" maxlength="300" placeholder="Schreib etwas dazu (optional)"><button class="btn fire w" data-act="sendspark" data-i="${a ?? ''}">Funken senden</button>`; },
  card: () => `<div class="eyebrow">Gesprächskarte</div><h3>Wähle eine Frage. Von leicht bis tief.</h3><div class="stack">${CARDS.map((q, i) => `<button class="ans" data-act="usecard" data-i="${i}"><small class="muted">Stufe ${i + 1}</small><br>${q}</button>`).join('')}</div>${why('cards')}`,
  dateplan: () => { const d = S.dp || {}; return `<div class="eyebrow">Date vorschlagen</div><h3>Wann passt es?</h3><div class="choice" data-g="dday">${['Do', 'Fr', 'Sa', 'So'].map(v => `<button class="opt" data-v="${v}" aria-pressed="${d.day === v}">${v}</button>`).join('')}</div><div class="choice" data-g="dtime">${['Nachmittag', 'Abend'].map(v => `<button class="opt" data-v="${v}" aria-pressed="${d.time === v}">${v}</button>`).join('')}</div><div class="choice three" data-g="dkind">${['Kaffee', 'Spaziergang', 'Drink'].map(v => `<button class="opt" data-v="${v}" aria-pressed="${d.kind === v}">${v}</button>`).join('')}</div>
    <div class="status"><b>Sicherheit zuerst</b><br>Trefft euch an einem öffentlichen Ort, reist selbst an und sag einer Vertrauensperson, wo du bist.</div>${why('date')}<button class="btn fire w" data-act="dateok" ${d.day && d.time && d.kind ? '' : 'disabled'}>Vorschlag senden</button>`; },
  endchat: () => { const n = S.chat.other.name; const T = [`Danke für das nette Gespräch, ${n}. Ich glaube, es passt nicht ganz. Alles Gute!`, 'Ich habe gemerkt, dass ich gerade nicht bereit bin. Danke dir und alles Liebe.', 'Ich spüre den Funken leider nicht. Du bist toll, nur nicht mein Mensch.']; return `<div class="eyebrow">Freundlich beenden</div><h3>Wähle eine Nachricht. ${esc(n)} bekommt sie, danach ist der Chat geschlossen.</h3><div class="stack">${T.map((t, i) => `<button class="ans" data-act="endok" data-i="${i}">${esc(t)}</button>`).join('')}</div>${why('end')}`; },
  report: () => `<div class="eyebrow">Melden</div><h3>Was ist passiert?</h3><div class="stack">${REASONS.map((t, i) => `<button class="ans" data-act="reportok" data-i="${i}">${t}</button>`).join('')}</div><textarea id="rtxt" maxlength="500" placeholder="Optional: Was möchtest du uns sagen?"></textarea><p class="small muted">Die Person wird sofort für dich blockiert. Unser Team prüft die Meldung.</p>`,
  filters: () => `<div class="eyebrow">Deine Grenzen</div>${FILTERS(S.me)}<button class="btn fire w" data-act="filtersok">Speichern</button>`,
  editprofile: () => `<div class="eyebrow">Profil bearbeiten</div><div class="field"><label>Das macht mich aus (bis zu 3)</label><div class="row" data-g="interests">${TAGS.map(t => `<button class="opt" style="padding:10px 14px" data-v="${t}" aria-pressed="${S.ob.interests.includes(t)}">${t}</button>`).join('')}</div></div><div class="field"><label for="about">Kurz über mich</label><textarea id="about" maxlength="300">${esc(S.ob.about)}</textarea></div>
    ${S.ob.prompts.map((p, i) => `<div class="field"><select id="pq${i}" data-pq="${i}" style="font:inherit;color:var(--ink);background:var(--coal);border:1px solid var(--line);border-radius:16px;padding:12px">${PROMPT_QS.map(q => `<option ${q === p.q ? 'selected' : ''}>${q}</option>`).join('')}</select><input id="pa${i}" maxlength="140" value="${esc(p.a)}"></div>`).join('')}<button class="btn fire w" data-act="profileok">Speichern</button>`,
  feedback: () => { const f = S.fb || {}; const star = k => `<div class="stars" data-k="${k}">${[1, 2, 3, 4, 5].map(n => `<button class="opt" aria-pressed="${f[k] === n}" data-n="${n}">${n}</button>`).join('')}</div>`; const pick = (k, o) => `<div class="choice three" data-k="${k}">${o.map(v => `<button class="opt" data-v="${v}" aria-pressed="${f[k] === v}">${v}</button>`).join('')}</div>`;
    return `<div class="eyebrow">Feedback</div><h3>Wie gefällt dir Funke?</h3><div class="field"><label>Spaß beim Einrichten</label>${star('fun')}</div><div class="field"><label>Wie treffend ist dein Funke-Typ?</label>${star('fit')}</div><div class="field"><label>Würdest du deinen Typ teilen?</label>${pick('share', ['Ja', 'Vielleicht', 'Nein'])}</div><div class="field"><label>Würdest du für mehr Tiefe zahlen?</label>${pick('pay', ['Ja', 'Vielleicht', 'Nein'])}</div><div class="field"><label for="ftxt">Was fehlt oder stört?</label><textarea id="ftxt" maxlength="1000">${esc(f.text || '')}</textarea></div><button class="btn fire w" data-act="fbok">Senden</button>`; },
  delete: () => `<div class="eyebrow" style="color:var(--gold)">Konto löschen</div><h3>Das kann nicht rückgängig gemacht werden.</h3><p class="small muted">Profil, Fotos, Funken und Vorschläge werden gelöscht. Deine Nachrichten in Chats werden aus den Gesprächen entfernt. Gespeichert bleiben nur Meldungen, die der Sicherheit dienen.</p>${FIELD('dpw', 'Zur Bestätigung dein Passwort', 'password', '', 'autocomplete="current-password"')}<p class="err" id="err" role="alert"></p><button class="btn fire w" data-act="deleteok">Endgültig löschen</button>`,
  overlayMatch: () => ''
};

/* ---------- Rendern ---------- */
function render() {
  const sc0 = $('#sc'); const keep = sc0 ? sc0.scrollTop : 0; let html = '';
  if (!S.me) { html = `<div class="top"><div class="logo"><i></i>funke</div></div><div class="scroll" id="sc">${SCR[S.scr]()}</div>`; }
  else if (ONB.includes(S.scr) && !(S.scr === 'photos' && S.view === 'photos')) {
    const i = ONB.indexOf(S.scr); html = `<div class="top"><div class="logo"><i></i>funke</div><span class="pill">Schritt ${i + 1}/${ONB.length}</span></div><div class="fuse"><b style="width:${Math.round(i / (ONB.length - 1) * 100)}%"></b></div><div class="scroll" id="sc">${SCR[S.scr]()}</div>`;
  } else if (S.view === 'chat' && S.chat) { const v = chatView(); html = `${v.head}<div class="scroll" id="sc">${v.body}</div>${v.foot}`; }
  else {
    const body = S.view === 'photos' ? SCR.photos() : S.view ? VIEW[S.view]() : TAB[S.tab]();
    html = `<div class="top"><div class="logo"><i></i>funke</div><button class="pill ${S.research ? 'on' : ''}" data-act="research">${S.research ? 'Forschung an' : 'Forschung'}</button></div><div class="scroll" id="sc">${body}</div>
    <nav class="tabs" aria-label="Hauptnavigation">${[['heute', 'Heute'], ['chats', 'Chats'], ['wingman', 'Wingman'], ['ich', 'Ich']].map(([k, l]) => `<button data-tab="${k}" ${S.tab === k && !S.view ? 'aria-current="page"' : ''}>${ICON[k]}${l}${k === 'chats' && unread() ? '<span class="dot"></span>' : ''}</button>`).join('')}</nav>`;
  }
  if (S.sheet) html += `<div class="sheet-bg" data-act="close-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${SHEET[S.sheet.k](S.sheet.a)}</div></div>`;
  if (S.overlay) html += S.overlay;
  app.innerHTML = html; paintToast(); bind();
  const sc = $('#sc'); if (sc) { if (S.view === 'chat') sc.scrollTop = sc.scrollHeight; else sc.scrollTop = keep; }
}

/* ---------- Bindung ---------- */
function bind() {
  if (S.me && S.scr === 'mood') bindSwipe();
  const f = $('#file'); if (f) f.onchange = async () => { const file = f.files[0]; f.value = ''; if (file) await uploadPhoto(file, '/api/photos'); };
  const sf = $('#selfie-file'); if (sf) sf.onchange = async () => { const file = sf.files[0]; sf.value = ''; if (file) { await uploadPhoto(file, '/api/selfie', true); } };
  const m = $('#msg'); if (m) m.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } };
}
async function resize(file, max = 900) {
  const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) throw new ApiError('Dieses Bild kann nicht gelesen werden.', 0);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [.82, .7, .55]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 560e3) return d; } throw new ApiError('Das Foto ist zu groß.', 0);
}
async function uploadPhoto(file, url, selfie) {
  if (S.busy) return; S.busy = true; toast(selfie ? 'Selfie wird gesendet …' : 'Foto wird hochgeladen …');
  try { const data = await resize(file); await api('POST', url, { data }); S.me = await api('GET', '/api/me'); toast(selfie ? 'Selfie eingereicht.' : 'Foto hinzugefügt.'); }
  catch (e) { fail(e); } finally { S.busy = false; render(); }
}
function bindSwipe() {
  const card = $('#card'); if (!card) return; let sx = 0, sy = 0, dx = 0, dy = 0, on = false; const st = card.querySelectorAll('.stamp');
  const decide = v => { const m = MOODS[S.ob.mi]; S.ob.votes[S.ob.mi] = v; card.classList.remove('drag'); card.style.transform = v === 'ja' ? 'translate(140%,0) rotate(18deg)' : v === 'nein' ? 'translate(-140%,0) rotate(-18deg)' : 'translate(0,-130%)'; card.style.opacity = '0'; setTimeout(() => { S.ob.mi++; if (S.ob.mi >= MOODS.length) { S.ob.mi = MOODS.length - 1; recomputeMood(); go('pairs'); } else render(); }, 260); };
  card.addEventListener('pointerdown', e => { on = true; sx = e.clientX; sy = e.clientY; card.classList.add('drag'); card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => { if (!on) return; dx = e.clientX - sx; dy = e.clientY - sy; card.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 14}deg)`; st[0].style.opacity = Math.max(0, dx / 100); st[1].style.opacity = Math.max(0, -dx / 100); st[2].style.opacity = Math.max(0, -dy / 100 - Math.abs(dx) / 200); });
  const end = () => { if (!on) return; on = false; if (dx > 100) decide('ja'); else if (dx < -100) decide('nein'); else if (dy < -100) decide('vielleicht'); else { card.classList.remove('drag'); card.style.transform = ''; st.forEach(x => x.style.opacity = 0); } dx = dy = 0; };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  $$('.vbtns button').forEach(b => b.onclick = () => decide(b.dataset.v));
}
const addAx = (d, f = 1) => { for (const k in d) S.ob.ax[k] += d[k] * f; };
function recomputeMood() { /* Achsen aus Stimmungskarten: neu berechnen, damit "Zurücknehmen" stimmt */ S.ob.moodAx = { sp: 0, na: 0, hu: 0, ge: 0 }; MOODS.forEach((m, i) => { const v = S.ob.votes[i]; const f = v === 'ja' ? 1 : v === 'vielleicht' ? .5 : 0; for (const k in m.ax) S.ob.moodAx[k] += m.ax[k] * f; }); }
function obScores() { const ax = { sp: 0, na: 0, hu: 0, ge: 0 }; for (const k in ax) ax[k] = (S.ob.moodAx?.[k] || 0) + (S.ob.pairAx?.[k] || 0) + (S.ob.sceneAx?.[k] || 0);
  const tags = {}, n = {}; MOODS.forEach((m, i) => { const v = S.ob.votes[i]; if (v === undefined) return; for (const t of m.tags) { n[t] = (n[t] || 0) + 1; tags[t] = (tags[t] || 0) + (v === 'ja' ? 1 : v === 'vielleicht' ? .5 : 0); } }); for (const t in tags) tags[t] /= n[t]; return { ax, tags }; }

/* ---------- Aktionen ---------- */
const readAges = () => { const a = document.getElementById('amin'), b = document.getElementById('amax'); if (!a || !b) return {}; let lo = Math.max(18, Math.min(99, Number(a.value) || 18)), hi = Math.max(lo, Math.min(99, Number(b.value) || 99)); return { amin: lo, amax: hi }; };
const readProfile = () => ({ about: ($('#about')?.value || '').trim(), prompts: S.ob.prompts.map((p, i) => ({ q: $('#pq' + i)?.value || p.q, a: ($('#pa' + i)?.value || '').trim() })) });
async function loadAll() { S.me = await api('GET', '/api/me'); const [p, t, w] = await Promise.all([api('GET', '/api/picks').catch(() => null), api('GET', '/api/threads').catch(() => []), api('GET', '/api/wingman').catch(() => null)]); S.picks = p; S.threads = t; S.wingman = w; }
async function enterApp() { await loadAll(); S.scr = 'app'; S.tab = 'heute'; S.view = null; S.ob.about = S.me.about; S.ob.interests = [...S.me.interests]; if (S.me.prompts.length) S.ob.prompts = S.me.prompts.map(p => ({ ...p })); render(); }
async function refreshThreads() { if (!S.me || S.scr !== 'app') return; try { S.threads = await api('GET', '/api/threads'); if (!S.view && !S.sheet && !S.overlay && (S.tab === 'chats')) render(); else { const d = $('.tabs [data-tab="chats"] .dot'); if (unread() && !d) render(); } } catch {} }
setInterval(() => { if (!document.hidden) refreshThreads(); }, 20000);
async function pollChat() { if (S.view !== 'chat' || !S.chat || document.hidden) return; try { const last = S.chat.messages.at(-1)?.id || 0; const r = await api('GET', `/api/threads/${S.chat.id}?since=${last}`); S.chat.closed = r.closed; if (r.messages.length) { S.chat.messages.push(...r.messages); markSeen(S.chat.id, r.messages.at(-1).id); const box = $('#msgs'), sc = $('#sc'); if (box) { const near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120; box.insertAdjacentHTML('beforeend', r.messages.map(msgHtml).join('')); if (near) sc.scrollTop = sc.scrollHeight; } } } catch {} }
setInterval(pollChat, 4000);
async function openChat(id) { try { const c = await api('GET', `/api/threads/${id}`); S.chat = c; S.view = 'chat'; S.overlay = null; S.sheet = null; if (c.messages.length) markSeen(c.id, c.messages.at(-1).id); const t = S.threads.find(x => x.id === c.id); render(); } catch (e) { fail(e); } }
async function sendMsg(kind = 'text', text) { const inp = $('#msg'); const v = text ?? inp?.value.trim(); if (!v) return; try { await api('POST', `/api/threads/${S.chat.id}/messages`, { text: v, kind }); if (inp) inp.value = ''; await pollChat(); S.threads = await api('GET', '/api/threads'); } catch (e) { fail(e); } }
async function doSpark(prompt, note) { const p = S.curProfile; try { const r = await api('POST', `/api/spark/${p.id}`, { prompt, note }); S.sheet = null; S.picks = await api('GET', '/api/picks'); S.threads = await api('GET', '/api/threads'); if (r.matched) { S.overlay = `<div class="overlay"><div class="eyebrow">Gegenseitig</div><div class="big">Funke<br><span class="hot">zurück!</span></div><p>${esc(p.name)} findet dich auch spannend.</p><button class="btn fire" data-chat="${r.thread}">Gespräch starten</button></div>`; render(); } else { S.view = null; toast('Funken gesendet. Du erfährst es, sobald zurückgefunkt wird.'); render(); } } catch (e) { fail(e); } }
async function shareImage() {
  const t = S.me.type; ev('share_type'); try { await document.fonts.load('900 150px Unbounded'); await document.fonts.load('600 50px Figtree'); } catch {}
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d'); x.fillStyle = '#120b10'; x.fillRect(0, 0, 1080, 1920);
  const g1 = x.createRadialGradient(320, 520, 0, 320, 520, 900); g1.addColorStop(0, `hsl(${t.h[0]} 95% 60%)`); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, 1080, 1920);
  const g2 = x.createRadialGradient(820, 1300, 0, 820, 1300, 900); g2.addColorStop(0, `hsl(${t.h[1]} 85% 55%)`); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(0, 0, 1080, 1920);
  x.fillStyle = '#fff3ea'; x.font = '700 44px Figtree, sans-serif'; x.fillText('MEIN FUNKE-TYP', 90, 1060); x.font = '900 150px Unbounded, sans-serif'; x.fillText(t.name, 90, 1230);
  x.font = '600 50px Figtree, sans-serif'; let line = '', y = 1340; for (const w of t.lead.split(' ')) { if (x.measureText(line + w).width > 900) { x.fillText(line, 90, y); line = ''; y += 66; } line += w + ' '; } x.fillText(line, 90, y);
  x.font = '600 44px Figtree, sans-serif'; t.tr.forEach((s, i) => x.fillText('•  ' + s, 90, y + 110 + i * 64)); x.font = '900 56px Unbounded, sans-serif'; x.fillText('funke', 90, 1800); x.font = '500 38px Figtree, sans-serif'; x.fillText('Welcher Typ bist du?', 330, 1798);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'mein-funke-typ.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Ich bin ${t.name}. Welcher Funke-Typ bist du? ${origin}/?ref=${S.me.invite}` }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mein-funke-typ.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Bild gespeichert. Jetzt in deiner Story posten.');
}

async function onClick(e) {
  const t = e.target.closest('[data-act],[data-tab],[data-id],[data-chat],[data-why],[data-react],[data-rm],[data-e],[data-g] .opt,[data-k] .opt,[data-f] .opt,[data-g] .opt'); if (!t || !app.contains(t)) return;
  if (t.dataset.act === 'close-bg') { if (e.target === t) closeSheet(); return; }
  const act = t.dataset.act;
  if (t.dataset.why) return sheet('why', t.dataset.why);
  if (t.dataset.tab) { S.view = null; S.tab = t.dataset.tab; if (S.tab === 'chats') refreshThreads(); if (S.tab === 'heute') api('GET', '/api/picks').then(p => { S.picks = p; if (S.tab === 'heute' && !S.view) render(); }).catch(() => {}); if (S.tab === 'wingman') api('GET', '/api/wingman').then(w => { S.wingman = w; if (S.tab === 'wingman' && !S.view) render(); }).catch(() => {}); return render(); }
  if (t.dataset.react !== undefined) return sheet('react', Number(t.dataset.react));
  if (t.dataset.chat) return openChat(Number(t.dataset.chat));
  if (t.dataset.id && !act) { const all = [...(S.picks?.incoming || []), ...(S.picks?.picks || [])]; S.curProfile = all.find(p => p.id === Number(t.dataset.id)); if (S.curProfile) { S.view = 'profile'; render(); } return; }
  if (t.dataset.rm) { try { await api('DELETE', `/api/photos/${t.dataset.rm}`); S.me = await api('GET', '/api/me'); render(); } catch (er) { fail(er); } return; }
  if (t.dataset.e) { try { await api('POST', `/api/wingman/${t.dataset.e}`, { status: t.dataset.st }); S.wingman = await api('GET', '/api/wingman'); render(); } catch (er) { fail(er); } return; }
  if (t.matches('[data-f] .opt')) { const f = t.parentElement.dataset.f; const v = f === 'km' ? Number(t.dataset.v) : t.dataset.v; try { if (f === 'ftime') { S.me = await api('PUT', '/api/me', { ftime: v }); } else { Object.assign(S.me, readAges(), { [f]: v }); } render(); } catch (er) { fail(er); } return; }
  if (t.matches('[data-k] .opt')) { S.fb = S.fb || {}; S.fb.text = $('#ftxt')?.value || S.fb.text; S.fb[t.parentElement.dataset.k] = t.dataset.n ? Number(t.dataset.n) : t.dataset.v; return render(); }
  if (t.matches('[data-g] .opt')) { const g = t.parentElement.dataset.g;
    if (g === 'gender' || g === 'seek') { S.form = { ...(S.form || {}), name: $('#f-name').value, age: $('#f-age').value, email: $('#f-email').value, [g]: t.dataset.v }; const keep = { n: S.form.name, a: S.form.age, e: $('#f-email').value }; render(); $('#f-name').value = keep.n; $('#f-age').value = keep.a; $('#f-email').value = keep.e; return; }
    if (g === 'interests') { const v = t.dataset.v; const a = S.ob.interests; const keepP = readProfile(); S.ob.about = keepP.about; S.ob.prompts = keepP.prompts; if (a.includes(v)) S.ob.interests = a.filter(x => x !== v); else if (a.length < 3) a.push(v); return render(); }
    if (g.startsWith('d')) { S.dp = S.dp || {}; S.dp[{ dday: 'day', dtime: 'time', dkind: 'kind' }[g]] = t.dataset.v; return render(); } return; }
  try { await actions(act, t); } catch (er) { fail(er); }
}
async function actions(act, t) {
  const err = m => { const el = $('#err'); if (el) el.textContent = m; };
  switch (act) {
    case 'to-register': S.form = {}; return go('register'); case 'to-login': return go('login'); case 'to-welcome': return go('welcome'); case 'to-forgot': return go('forgot');
    case 'register': { const f = S.form || {}; const b = { name: $('#f-name').value, age: Number($('#f-age').value), gender: f.gender, seek: f.seek, email: $('#f-email').value, password: $('#f-pw').value, over18: $('#f-18').checked, consent: $('#f-consent').checked, ref: sessionStorage.getItem('funke-ref') || undefined };
      if (!b.name || !b.age || !b.gender || !b.seek || !b.email || !b.password) return err('Bitte fülle alle Felder aus.'); if (!b.over18 || !b.consent) return err('Bitte bestätige Alter und Einwilligung.');
      try { await api('POST', '/api/register', b); S.me = await api('GET', '/api/me'); S.ob.tl = Date.now(); go('goals'); } catch (e) { err(e.message); } return; }
    case 'login': try { await api('POST', '/api/login', { email: $('#f-email').value, password: $('#f-pw').value }); await boot(); } catch (e) { err(e.message); } return;
    case 'forgot': try { await api('POST', '/api/reset/request', { email: $('#f-email').value }); err('Wenn es ein Konto gibt, ist eine E-Mail unterwegs.'); } catch (e) { err(e.message); } return;
    case 'reset': try { await api('POST', '/api/reset/confirm', { token: S.resetToken, password: $('#f-pw').value }); history.replaceState(null, '', '/'); toast('Passwort geändert. Bitte melde dich an.'); go('login'); } catch (e) { err(e.message); } return;
    case 'goals-next': { const a = readAges(); if (!S.me.goal) return err('Was suchst du gerade?'); S.me = await api('PUT', '/api/me', { goal: S.me.goal, kids: S.me.kids, km: S.me.km, ...a }); return go('mood'); }
    case 'undo': if (S.ob.mi > 0) { S.ob.mi--; delete S.ob.votes[S.ob.mi]; recomputeMood(); render(); } return;
    case 'profile-next': { const p = readProfile(); S.ob.about = p.about; S.ob.prompts = p.prompts; if (!S.ob.interests.length) return err('Wähle mindestens eine Sache, die dich ausmacht.'); if (!p.about && !p.prompts.some(x => x.a)) return err('Schreib ein paar Worte über dich.'); S.me = await api('PUT', '/api/me', { about: p.about, interests: S.ob.interests, prompts: p.prompts }); return go('photos'); }
    case 'profileok': { const p = readProfile(); S.ob.about = p.about; S.ob.prompts = p.prompts; S.me = await api('PUT', '/api/me', { about: p.about, interests: S.ob.interests, prompts: p.prompts }); S.sheet = null; toast('Profil gespeichert.'); return render(); }
    case 'pick-photo': return $('#file').click();
    case 'photos-next': return go(S.me.vstatus === 'none' ? 'selfie' : 'reveal');
    case 'take-selfie': return $('#selfie-file').click();
    case 'selfie-next': { const tm = S.ob.times; await api('POST', '/api/finish', { times: tm }); S.me = await api('GET', '/api/me'); return go('reveal'); }
    case 'enter': { if (!S.me.onboarded) { await api('POST', '/api/finish', { times: S.ob.times }); } return enterApp(); }
    case 'share-type': return shareImage();
    case 'share-invite': ev('invite'); return shareLink('Komm zu Funke, der Dating-App, die zuhört.', `${origin}/?ref=${S.me.invite}`, 'Einladung kopiert.');
    case 'share-wingman': ev('wingman_share'); return shareLink(`Sei mein Wingman bei Funke und schreib eine kurze Empfehlung über mich:`, `${origin}/w/${S.me.invite}`, 'Wingman-Link kopiert.');
    case 'tab-heute': S.tab = 'heute'; return render();
    case 'back': if (S.view === 'chat') { S.chat = null; S.view = null; S.threads = await api('GET', '/api/threads').catch(() => S.threads); } else { S.view = null; } return render();
    case 'close': return closeSheet();
    case 'research': S.research = !S.research; store.set('research', S.research); toast(S.research ? 'Forschungs-Modus an: Tippe auf „Warum so?“' : 'Forschungs-Modus aus'); return render();
    case 'pause': S.me = await api('PUT', '/api/me', { paused: !S.me.paused }); return render();
    case 'unpause': S.me = await api('PUT', '/api/me', { paused: false }); S.picks = await api('GET', '/api/picks'); return render();
    case 'sendspark': { const i = t.dataset.i; const pr = i === '' ? null : S.curProfile.prompts[Number(i)]; return doSpark(pr?.q || '', ($('#rin').value || '').trim()); }
    case 'spark-back': return doSpark(S.curProfile.incoming?.prompt || '', '');
    case 'pass': await api('POST', `/api/picks/${S.curProfile.id}/pass`, {}); S.picks = await api('GET', '/api/picks'); S.view = null; return render();
    case 'send': return sendMsg();
    case 'card': return sheet('card'); case 'usecard': { S.sheet = null; render(); return sendMsg('card', `Gesprächskarte: ${CARDS[Number(t.dataset.i)]}`); }
    case 'dateplan': S.dp = {}; return sheet('dateplan');
    case 'dateok': { const d = S.dp; S.sheet = null; render(); return sendMsg('date', `Date-Vorschlag: ${d.kind}, ${d.day} ${d.time}. Wollen wir uns auf halber Strecke an einem öffentlichen Ort treffen?`); }
    case 'endchat': return sheet('endchat');
    case 'endok': { await api('POST', `/api/threads/${S.chat.id}/close`, { tpl: Number(t.dataset.i) }); S.sheet = null; S.chat.closed = true; await pollChat(); S.threads = await api('GET', '/api/threads'); return render(); }
    case 'report-chat': S.reportTarget = { userId: S.chat.other.id, threadId: S.chat.id }; return sheet('report');
    case 'report-profile': S.reportTarget = { userId: S.curProfile.id }; return sheet('report');
    case 'reportok': { await api('POST', '/api/report', { ...S.reportTarget, reason: REASONS[Number(t.dataset.i)], text: $('#rtxt')?.value || '' }); S.sheet = null; S.view = null; S.chat = null; S.picks = await api('GET', '/api/picks'); S.threads = await api('GET', '/api/threads'); toast('Gemeldet und blockiert. Danke, dass du hilfst.'); return render(); }
    case 'filters': return sheet('filters');
    case 'filtersok': { S.me = await api('PUT', '/api/me', { goal: S.me.goal, kids: S.me.kids, km: S.me.km, ...readAges() }); S.sheet = null; S.picks = await api('GET', '/api/picks'); toast('Gespeichert. Deine nächsten Vorschläge berücksichtigen das.'); return render(); }
    case 'edit-profile': S.ob.about = S.me.about; S.ob.interests = [...S.me.interests]; if (S.me.prompts.length) S.ob.prompts = S.me.prompts.map(p => ({ ...p })); while (S.ob.prompts.length < 2) S.ob.prompts.push({ q: PROMPT_QS[S.ob.prompts.length], a: '' }); return sheet('editprofile');
    case 'my-photos': S.view = 'photos'; return render();
    case 'loc-on': return new Promise(res => { if (!navigator.geolocation) { toast('Dein Gerät unterstützt keinen Standort.'); return res(); } navigator.geolocation.getCurrentPosition(async pos => { try { S.me = await api('PUT', '/api/me', { lat: pos.coords.latitude, lon: pos.coords.longitude }); S.picks = await api('GET', '/api/picks'); toast('Standort gespeichert.'); } catch (e) { fail(e); } render(); res(); }, () => { toast('Standort nicht freigegeben.'); res(); }, { timeout: 10000 }); });
    case 'loc-off': S.me = await api('PUT', '/api/me', { clearLocation: true }); return render();
    case 'plus-interest': ev('plus_interest'); toast('Danke! Wir melden uns, wenn es soweit ist.'); return;
    case 'install': { const p = S.install; S.install = null; p.prompt(); await p.userChoice; return render(); }
    case 'feedback': S.fb = {}; return sheet('feedback');
    case 'fbok': { const f = S.fb || {}; await api('POST', '/api/feedback', { fun: f.fun, fit: f.fit, share: f.share, pay: f.pay, text: $('#ftxt')?.value || '' }); S.sheet = null; toast('Danke für dein Feedback!'); return render(); }
    case 'export': { const d = await api('GET', '/api/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'funke-meine-daten.json'; document.body.appendChild(a); a.click(); a.remove(); return; }
    case 'delete': return sheet('delete');
    case 'deleteok': try { await api('DELETE', '/api/me', { password: $('#dpw').value }); S.me = null; S.sheet = null; S.scr = 'welcome'; toast('Dein Konto wurde gelöscht.'); return render(); } catch (e) { err(e.message); } return;
    case 'logout': await api('POST', '/api/logout', {}); S.me = null; S.scr = 'welcome'; S.picks = null; S.threads = []; return render();
  }
}
app.addEventListener('click', onClick);
app.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sheet) closeSheet(); });
app.addEventListener('change', e => { if (e.target.matches('[data-pq]')) { const i = Number(e.target.dataset.pq); S.ob.prompts[i].q = e.target.value; } });
/* Dies-oder-das und Szenen: eigene Handler, da Buttons ohne data-act */
app.addEventListener('click', e => {
  if (!S.me) return; const b = e.target.closest('.split button'); if (b && S.scr === 'pairs') { S.ob.pairAx = S.ob.pairAx || { sp: 0, na: 0, hu: 0, ge: 0 }; const d = PAIRS[S.ob.pr][Number(b.dataset.i)][1]; for (const k in d) S.ob.pairAx[k] += d[k]; S.ob.pr++; if (S.ob.pr >= PAIRS.length) go('scenes'); else render(); return; }
  const a = e.target.closest('.ans[data-i]'); if (a && S.scr === 'scenes' && !S.sheet) { S.ob.sceneAx = S.ob.sceneAx || { sp: 0, na: 0, hu: 0, ge: 0 }; const d = SCENES[S.ob.sc][1][Number(a.dataset.i)][1]; for (const k in d) S.ob.sceneAx[k] += d[k]; S.ob.sc++; if (S.ob.sc >= SCENES.length) { const { ax, tags } = obScores(); api('POST', '/api/onboarding', { ax, tags, times: S.ob.times }).then(m => { S.me = m; go('profile'); }).catch(fail); } else render(); }
});
/* Ziel/Kinder bei Onboarding-Filtern: Zustand lokal halten */
addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.install = e; });

/* ---------- Start ---------- */
async function boot() {
  const q = new URLSearchParams(location.search); if (q.get('ref')) sessionStorage.setItem('funke-ref', q.get('ref').slice(0, 20));
  if (q.get('reset')) { S.resetToken = q.get('reset'); S.me = null; S.scr = 'reset'; return render(); }
  try { S.me = await api('GET', '/api/me'); } catch (e) { S.me = null; }
  if (!S.me) { S.scr = 'welcome'; return render(); }
  S.ob.tl = Date.now();
  if (!S.me.onboarded) { const r = resumePoint(); if (r === 'reveal' && S.me.vstatus === 'none') return go('selfie'); S.scr = r; S.ob.about = S.me.about; S.ob.interests = [...S.me.interests]; return render(); }
  await enterApp();
}
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
S.scr = 'boot'; render(); boot();
})();
