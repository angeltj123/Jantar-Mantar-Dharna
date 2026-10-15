/* Dharna Chowk Chalo — multiplayer game server.
   Serves the static client from ./public and runs authoritative game rooms over WebSocket (/ws). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');
const MAP = require('./public/shared/map.js');
const { World } = require('./public/shared/sim.js');

const PORT = +process.env.PORT || 3000;
const ROOM_CAP = +process.env.ROOM_CAP || 40;          // human players per room
const ROUND_SECONDS = +process.env.ROUND_SECONDS || 300;
const MAX_PER_IP = +process.env.MAX_PER_IP || 8;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const TICK = 50;                                       // 20 Hz simulation
const SNAP_EVERY = 2;                                  // 10 Hz snapshots
const AOI_X = 820, AOI_Y = 720;                        // area of interest half-size (world units)
const PUB = path.join(__dirname, 'public');

/* ---------- static files ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const cache = new Map();
function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const key = file + ':' + st.mtimeMs;
    let ent = cache.get(key);
    if (!ent) { const raw = fs.readFileSync(file); ent = { raw, gz: zlib.gzipSync(raw) }; cache.set(key, ent); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) { headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); res.end(ent.gz); }
    else { res.writeHead(200, headers); res.end(ent.raw); }
  });
}

/* ---------- rooms ---------- */
const rooms = new Map();
let pidSeq = 1;
class Room {
  constructor(name, isPublic) {
    this.name = name; this.isPublic = isPublic; this.clients = new Set(); this.tick = 0; this.emptySince = Date.now();
    this.world = new World({ roundLen: ROUND_SECONDS, interLen: 12 });
  }
  humans() { return this.clients.size; }
  teamCounts() { let P = 0, C = 0; for (const c of this.clients) c.team === 'P' ? P++ : C++; return { P, C }; }
  add(c, team) {
    if (team !== 'P' && team !== 'C') { const t = this.teamCounts(); team = t.C * 2 < t.P ? 'C' : 'P'; }
    c.team = team; c.room = this; this.clients.add(c);
    this.world.addHuman(c.pid, c.name, team);
    send(c, { t: 'hello', pid: c.pid, room: this.name, team, round: ROUND_SECONDS });
    this.broadcast({ t: 'ev', l: [{ k: 'toast', m: c.name + ' joined the ' + (team === 'P' ? 'andolan' : 'police') }] }, c);
  }
  remove(c) {
    this.clients.delete(c); this.world.removeHuman(c.pid);
    if (!this.clients.size) this.emptySince = Date.now();
  }
  broadcast(obj, except) { const s = JSON.stringify(obj); for (const c of this.clients) if (c !== except && c.ws.readyState === 1) c.ws.send(s); }
  step() {
    const w = this.world;
    w.step(TICK / 1000);
    this.tick++;
    const evs = w.drainEvents();
    for (const c of this.clients) for (const e of evs) {
      if (e.to !== undefined && e.to !== c.pid) continue;
      if (e.x !== undefined && e.to === undefined && e.k !== 'bus') { if (Math.abs(e.x - c.vx) > AOI_X + 200 || Math.abs(e.y - c.vy) > AOI_Y + 200) continue; }
      if (c.pending.length < 80) c.pending.push(stripEv(e));
    }
    if (this.tick % SNAP_EVERY === 0) for (const c of this.clients) this.sendSnap(c);
    if (this.tick % 10 === 0) for (const c of this.clients) this.sendState(c);
  }
  sendSnap(c) {
    const w = this.world, h = w.humans.get(c.pid), me = h && w.byId.get(h.eid);
    if (me) { c.vx = me.x; c.vy = me.y; }
    if (c.ws.readyState !== 1 || c.ws.bufferedAmount > 256 * 1024) return; // slow client: skip a frame
    const list = [];
    for (const e of w.ents) {
      if (e.dead) continue;
      if (e.kind === 'lead' || (Math.abs(e.x - c.vx) < AOI_X && Math.abs(e.y - c.vy) < AOI_Y)) list.push(e);
    }
    const n = Math.min(list.length, 1200);
    const size = 12 + n * 10 + 1 + w.bars.length * 7 + 1 + w.gas.length * 5 + 1 + w.shells.length * 4 + 1 + w.vans.length * 9;
    const buf = Buffer.allocUnsafe(size); let o = 0;
    buf.writeUInt8(1, o++); buf.writeUInt8(w.state === 'play' ? 0 : 1, o++);
    buf.writeUInt16LE(this.tick & 0xffff, o); o += 2;
    buf.writeFloatLE(w.state === 'play' ? w.timeLeft() : w.inter, o); o += 4;
    buf.writeUInt16LE(n, o); o += 2;
    buf.writeUInt16LE(me ? me.id & 0xffff : 0, o); o += 2;
    const KIND = { civ: 0, fol: 1, lead: 2, cop: 3 };
    for (let i = 0; i < n; i++) {
      const e = list[i];
      buf.writeUInt16LE(e.id & 0xffff, o); o += 2;
      buf.writeUInt8(KIND[e.kind] | ((e.look & 15) << 2) | (e.human ? 64 : 0), o++);
      buf.writeUInt8(e.col & 255, o++);
      buf.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(e.x * 10))), o); o += 2;
      buf.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(e.y * 10))), o); o += 2;
      buf.writeUInt8((e.stun > 0 ? 1 : 0) | (e.swing > 0 ? 2 : 0) | (e.gasd ? 4 : 0) | (e.held ? 8 : 0) | (e.drag ? 16 : 0) | (e.squad ? 32 : 0) | (e.dizzy > 0 && e.stun > 0 ? 64 : 0), o++);
      buf.writeUInt8(Math.round(((e.aim + Math.PI) / (2 * Math.PI)) * 255) & 255, o++);
    }
    buf.writeUInt8(w.bars.length, o++);
    for (let i = 0; i < w.bars.length; i++) {
      const b = w.bars[i]; buf.writeUInt8(b.broken ? 0 : Math.max(1, Math.ceil(b.hp)), o++);
      if (i >= MAP.BARS.length) { buf.writeUInt16LE(Math.round(b.x), o); o += 2; buf.writeUInt16LE(Math.round(b.y), o); o += 2; buf.writeUInt8(Math.round(((Math.atan2(b.y2 - b.y1, b.x2 - b.x1) + Math.PI) / (2 * Math.PI)) * 255) & 255, o++); buf.writeUInt8(Math.min(255, Math.round(b.half || 30)), o++); }
    }
    buf.writeUInt8(w.gas.length, o++);
    for (const g of w.gas) { buf.writeUInt16LE(Math.round(g.x), o); o += 2; buf.writeUInt16LE(Math.round(g.y), o); o += 2; buf.writeUInt8(Math.round(g.r * Math.min(1, (g.life - g.t) / 1.2 + .001) / 2) & 255, o++); }
    buf.writeUInt8(w.shells.length, o++);
    for (const s of w.shells) { buf.writeUInt16LE(Math.round(s.x), o); o += 2; buf.writeUInt16LE(Math.round(s.y), o); o += 2; }
    buf.writeUInt8(w.vans.length, o++);
    for (const v of w.vans) {
      buf.writeUInt16LE(Math.round(v.x), o); o += 2; buf.writeUInt16LE(Math.round(v.y), o); o += 2;
      buf.writeUInt8(Math.round(((v.ang + Math.PI) / (2 * Math.PI)) * 255) & 255, o++);
      buf.writeUInt8((v.stopT > 0 ? 1 : 0) | (v.leaving ? 2 : 0) | (v.flipped > 0 ? 4 : 0), o++);
      buf.writeUInt8(v.prisoners.length, o++);
      buf.writeUInt8(Math.min(255, Math.round(v.stopT * 10)), o++);
      buf.writeUInt8(Math.min(255, Math.round(v.unlock * 255)), o++);
    }
    c.ws.send(buf.subarray(0, o), { binary: true });
    if (c.pending.length) { c.ws.send(JSON.stringify({ t: 'ev', l: c.pending })); c.pending = []; }
  }
  sendState(c) {
    const w = this.world, h = w.humans.get(c.pid);
    const lead = w.leaders.filter(l => !l.dead).map(l => [l.id, l.name, l.col, l.count, Math.round(l.meter), Math.round(l.x), Math.round(l.y), l.human ? 1 : 0]);
    send(c, { t: 'st', room: this.name, team: c.team, players: this.teamCounts(), lead, arrests: w.arrests,
      board: w.board().slice(0, 8).map(r => [r[0], r[1], r[2], r[3] === c.pid ? 1 : 0]),
      me: h ? { score: Math.round(h.round.score), total: h.score, rec: h.round.rec, arrests: h.round.arrests, peak: h.round.peak, scat: h.round.scat, calls: Math.max(0, w.callsLeft(h)), squad: w.squadOf(h.pid), gas: h.gasAmmo, gasHits: h.gasHits, respawn: h.eid ? 0 : Math.max(0, h.respawn) } : null,
      state: w.state, win: w.winner, winBy: w.winBy });
  }
}
function stripEv(e) { const o = Object.assign({}, e); delete o.to; if (o.x !== undefined) { o.x = Math.round(o.x); o.y = Math.round(o.y); } return o; }
function send(c, obj) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(obj)); }
function findRoom(code) {
  if (code) {
    const name = 'r-' + code;
    let r = rooms.get(name);
    if (!r) { r = new Room(name, false); rooms.set(name, r); }
    return r.humans() < ROOM_CAP ? r : null;
  }
  for (const r of rooms.values()) if (r.isPublic && r.humans() < ROOM_CAP) return r;
  let i = 1; while (rooms.has('public-' + i)) i++;
  const r = new Room('public-' + i, true); rooms.set(r.name, r); return r;
}

/* ---------- http + ws ---------- */
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ rooms: [...rooms.values()].map(r => ({ name: r.isPublic ? r.name : 'private', players: r.humans(), teams: r.teamCounts() })), players: [...rooms.values()].reduce((a, r) => a + r.humans(), 0) }));
  }
  serveStatic(req, res);
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024, perMessageDeflate: false });
const perIp = new Map();
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) { ws.close(1008, 'origin'); return; }
  const fwd = process.env.TRUST_PROXY === '1' ? req.headers['x-forwarded-for'] : '';
  const ip = (fwd || req.socket.remoteAddress || '').split(',')[0].trim();
  const n = (perIp.get(ip) || 0) + 1;
  if (n > MAX_PER_IP) { ws.close(1008, 'too many connections'); return; }
  perIp.set(ip, n);
  const c = { ws, pid: 'p' + (pidSeq++), name: 'Player', team: 'P', room: null, vx: MAP.DZ.x, vy: MAP.DZ.y, pending: [], alive: true, msgs: 0, msgT: Date.now() };
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data, isBinary) => {
    const now = Date.now();
    if (now - c.msgT > 1000) { c.msgT = now; c.msgs = 0; }
    if (++c.msgs > 60 || isBinary) return;
    let m; try { m = JSON.parse(data.toString()); } catch (_) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join' && !c.room) {
      c.name = cleanName(m.name);
      const code = typeof m.room === 'string' ? m.room.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) : '';
      const r = findRoom(code);
      if (!r) { send(c, { t: 'err', m: 'That room is full. Try another code.' }); return; }
      r.add(c, m.team);
    } else if (!c.room) return;
    else if (m.t === 'in') c.room.world.setInput(c.pid, { ax: m.ax, ay: m.ay, hold: m.h, aim: m.aim });
    else if (m.t === 'act' && typeof m.k === 'string') c.room.world.action(c.pid, m.k, { x: +m.x, y: +m.y });
    else if (m.t === 'team' && (m.team === 'P' || m.team === 'C')) { c.team = m.team; c.room.world.setTeam(c.pid, m.team); send(c, { t: 'hello', pid: c.pid, room: c.room.name, team: c.team, round: ROUND_SECONDS }); }
    else if (m.t === 'ping') send(c, { t: 'pong', c: m.c });
  });
  ws.on('close', () => {
    perIp.set(ip, (perIp.get(ip) || 1) - 1); if (perIp.get(ip) <= 0) perIp.delete(ip);
    if (c.room) c.room.remove(c);
  });
  ws.on('error', () => {});
});
function cleanName(s) {
  s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return s || 'Andolankari' + ((Math.random() * 900 + 100) | 0);
}

setInterval(() => { for (const r of rooms.values()) if (r.clients.size) r.step(); }, TICK);
setInterval(() => {
  wss.clients.forEach(ws => { if (ws._dccDead) return ws.terminate(); ws._dccDead = true; ws.ping(); });
  for (const [name, r] of rooms) if (!r.clients.size && Date.now() - r.emptySince > 60000 && name !== 'public-1') rooms.delete(name);
}, 20000);
wss.on('connection', ws => ws.on('pong', () => { ws._dccDead = false; }));

server.listen(PORT, () => console.log('Dharna Chowk Chalo server on http://localhost:' + PORT));
