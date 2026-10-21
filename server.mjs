import { mutate as sharedMutate, advanceDue } from './tournament-core.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8765);
const siteOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : null;
const stateFile = path.join(dataDir, 'tournament.json');
const authFile = path.join(dataDir, 'admin.json');
fs.mkdirSync(dataDir, { recursive: true });
const fresh = () => ({ revision: 0, date: '', time: '16:00', decks: [], deckReservations: [], divisions: {
  junior: { players: [], rounds: [], byeHistory: [], interest: [] },
  adult: { players: [], rounds: [], byeHistory: [], interest: [] }
} });
const hash = value => createHash('sha256').update(value).digest('hex');
function passwordRecord(password) {
  const salt = randomBytes(32).toString('hex');
  return { salt, digest: scryptSync(password, salt, 64).toString('hex') };
}
function atomicWrite(file, value) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(temp, file);
}
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : fresh();
if (!state.divisions?.junior || !state.divisions?.adult || !Number.isInteger(state.revision)) {
  throw new Error('Ungültige Datendatei. Vor dem Start aus einer Sicherung wiederherstellen.');
}
let admin = fs.existsSync(authFile) ? JSON.parse(fs.readFileSync(authFile, 'utf8')) : null;
if (!admin && !process.env.ADMIN_PASSWORD && ['127.0.0.1', 'localhost'].includes(host)) {
  admin = passwordRecord('TCGCOMMUNITYLAUF');
  atomicWrite(authFile, admin);
}
if (process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD benötigt mindestens 12 Zeichen.');
  admin = passwordRecord(process.env.ADMIN_PASSWORD);
}
if (host !== '127.0.0.1' && host !== 'localhost' && (!admin || !siteOrigin?.startsWith('https://'))) {
  throw new Error('Für Netzwerkbetrieb ADMIN_PASSWORD und eine HTTPS-SITE_URL konfigurieren.');
}
const sessions = new Map();
const streams = new Set();
const limits = new Map();
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function rate(key, max, windowMs) {
  const now = Date.now();
  let entry = limits.get(key);
  if (!entry || entry.until <= now) { entry = { count: 0, until: now + windowMs }; limits.set(key, entry); }
  if (++entry.count > max) fail('Zu viele Versuche. Bitte später erneut versuchen.', 429);
}
function owner(req, res) {
  let token = /(?:^|;\s*)tcg_owner=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  if (!token) {
    token = randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `tcg_owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${siteOrigin?.startsWith('https://') ? '; Secure' : ''}`);
  }
  return hash(token);
}
function isAdmin(who) { return (sessions.get(who) || 0) > Date.now(); }
function requireAdmin(who) { if (!isAdmin(who)) fail('Bitte als Admin anmelden.', 403); }
function localSetup(req) {
  return !admin && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '');
}
function snapshot(who, setup = false) {
  const result = structuredClone(state);
  result.decks ||= [];result.deckReservations ||= [];
  const names=new Map();
  result.tradeInterest ||= [];for(const entry of result.tradeInterest){entry.owned=entry.owner===who;delete entry.owner;}
  for(const division of Object.values(result.divisions))for(const player of division.players)if(player.owner)names.set(player.owner,player.name);
  for (const division of Object.values(result.divisions)) for (const player of division.players) {
    player.owned = player.owner === who;
    delete player.owner;
  }
  for (const division of Object.values(result.divisions)) {
    division.interest ||= [];
    for(const entry of division.interest){entry.owned=entry.owner===who;delete entry.owner;}
  }
  for(const reservation of result.deckReservations){reservation.owned=reservation.owner===who;if(isAdmin(who))reservation.holder=names.get(reservation.owner)||'Gast';delete reservation.owner;}
  return { state: result, isAdmin: isAdmin(who), setupRequired: setup && !admin };
}
function broadcast() {
  for (const stream of streams) {
    if (stream.res.destroyed) { streams.delete(stream); continue; }
    if (!stream.res.write(`data: ${JSON.stringify(snapshot(stream.who, stream.setup))}\n\n`)) stream.res.destroy();
  }
}
function nameValue(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 28 || /[\x00-\x1f]/.test(value)) fail('Bitte einen Namen mit 1 bis 28 Zeichen eingeben.');
  return value.trim();
}
function unique(division, name, except) {
  if (division.players.some(p => p.id !== except && p.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) fail('Dieser Name ist bereits angemeldet.', 409);
}
function winners(round) { return round.matches.flatMap(m => m.bye ? [m.a] : m.winner ? [m.winner] : []); }
function mutate(action,input,who) {
 const next=sharedMutate(state,action,input,who,isAdmin(who));
 atomicWrite(stateFile,next);state=next;broadcast();
}
function advanceScheduledRounds(){
 const next=advanceDue(state);
 if(next!==state){atomicWrite(stateFile,next);state=next;broadcast();}
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON erforderlich.', 415);
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > 8192) fail('Anfrage zu groß.', 413); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks)); if (!value || Array.isArray(value) || typeof value !== 'object') throw 0; return value; }
  catch { fail('Ungültige Anfrage.'); }
}
function json(res, code, value) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const who = owner(req, res);
      if (req.method === 'GET' && url.pathname === '/api/state') { advanceScheduledRounds(); return json(res, 200, snapshot(who, localSetup(req))); }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        advanceScheduledRounds();
        if (streams.size >= 1000 || [...streams].filter(s => s.who === who).length >= 12) fail('Zu viele offene Verbindungen.', 429);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        const stream = { who, res, setup: localSetup(req) }; streams.add(stream);
        res.write(`data: ${JSON.stringify(snapshot(who, stream.setup))}\n\n`);
        const heartbeat = setInterval(() => { if (!res.write(': heartbeat\n\n')) res.destroy(); }, 15000);
        res.on('close', () => { clearInterval(heartbeat); streams.delete(stream); });
        return;
      }
      if (req.method !== 'POST') fail('Nicht gefunden.', 404);
      const expectedOrigin = siteOrigin || `http://${req.headers.host}`;
      if (req.headers.origin !== expectedOrigin) fail('Unzulässiger Ursprung der Anfrage.', 403);
      rate('write:' + who, 90, 60000);
      const input = await body(req);
      if (url.pathname === '/api/login' || url.pathname === '/api/setup') {
        rate('login:' + req.socket.remoteAddress, 12, 15 * 60000);
        if (typeof input.password !== 'string' || input.password.length > 256) fail('Ungültiges Passwort.');
        if (url.pathname === '/api/setup') {
          if (!localSetup(req)) fail('Einrichtung nur lokal beim ersten Start möglich.', 403);
          if (input.password.length < 12) fail('Bitte mindestens 12 Zeichen verwenden.');
          const record = passwordRecord(input.password); atomicWrite(authFile, record); admin = record;
        } else if (!admin || !timingSafeEqual(scryptSync(input.password, admin.salt, 64), Buffer.from(admin.digest, 'hex'))) {
          fail('Passwort stimmt nicht.', 401);
        }
        sessions.set(who, Date.now() + 8 * 60 * 60000); broadcast();
      } else if (url.pathname === '/api/logout') { sessions.delete(who); broadcast(); }
      else if (url.pathname === '/api/action') mutate(input.action, input, who);
      else fail('Nicht gefunden.', 404);
      return json(res, 200, snapshot(who, localSetup(req)));
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail('Methode nicht erlaubt.', 405);
    const files = { '/theme.css': ['theme.css', 'text/css'], '/bracket-view.js': ['bracket-view.js', 'text/javascript'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/sync-client.js': ['sync-client.js', 'text/javascript'] };
    const file = files[url.pathname];
    if (!file) fail('Nicht gefunden.', 404);
    const content = fs.readFileSync(path.join(root, file[0]));
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Speichern derzeit nicht möglich. Bitte erneut versuchen.' });
    else res.destroy();
    if (!error.status) console.error(error.message);
  }
});
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) if (entry.until <= now) limits.delete(key);
  for (const [who, expires] of sessions) if (expires <= now) { sessions.delete(who); broadcast(); }
}, 60000).unref();
server.listen(port, host, () => console.log(`TCG-Vorschau: http://${host}:${port} (gemeinsamer Speicher: ${dataDir})`));
