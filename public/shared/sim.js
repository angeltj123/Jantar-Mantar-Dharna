/* Dharna Chowk Chalo — game simulation. Runs on the server (authoritative, online)
   and in the browser (offline practice). No DOM access here. */
(function (G) {
  'use strict';
  const MAP = (typeof module !== 'undefined' && module.exports) ? require('./map.js') : G.DCMAP;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hyp = Math.hypot;
  const AI_NAMES = ['Chai Wala Union', 'Hostel Morcha', 'Auto Sangh', 'Pension Front', 'Pothole Samiti', 'Pyaaz Daam Morcha',
    'Late Train Sangharsh', 'Paani Tanker Sangh', 'Gas Cylinder Front', 'Parking Peeditt Manch', 'Bijli Bill Morcha', 'Rickshaw Ekta'];
  const SLOGANS = ['हल्ला बोल!', 'चलो चलो!', 'हक़ दो!', 'सुनो सरकार!', 'आवाज़ दो!', 'जंतर मंतर चलो!',
    'वोट चोर, गद्दी छोड़!', 'सरकार हाय हाय!', 'हमें चाहिए आज़ादी!', 'सोशल मीडिया फ़्री करो!', 'अकाउंट बैन मत करो!',
    'इंक़लाब ज़िंदाबाद!', 'रोज़गार दो!', 'महँगाई कम करो!', 'पेपर लीक बंद करो!', 'तानाशाही नहीं चलेगी!', 'हम होंगे कामयाब!',
    'जनता जाग गई!', 'हिसाब दो, जवाब दो!', 'इंटरनेट बंद मत करो!'];
  const NCOL = 12;
  const R = { civ: 6, fol: 6, lead: 8, cop: 7 };
  const SLIDE = [.35, -.35, .7, -.7, 1.05, -1.05, 1.35, -1.35];
  const VANS = 3, VAN_CAP = 5, VAN_STOP = 10, VAN_SPEED = 115, SQUAD_MAX = 5, HITS_PER_CALL = 10;
  const GROUP_REMOVE = 10, GROUP_RESCUE = 5, GROUP_BAR = 10, GROUP_FLIP = 10, COPS_BUILD = 5, GAS_START = 5, GAS_HITS = 5, GAS_EARN = 3, GAS_SCATTER = 5, MAX_BUILT = 6;

  function segDist(px, py, b) {
    const vx = b.x2 - b.x1, vy = b.y2 - b.y1, L2 = vx * vx + vy * vy;
    let t = ((px - b.x1) * vx + (py - b.y1) * vy) / L2; t = clamp(t, 0, 1);
    return hyp(px - (b.x1 + vx * t), py - (b.y1 + vy * t));
  }

  class World {
    constructor(o) {
      o = o || {};
      this.offline = !!o.offline;
      this.roundLen = o.roundLen || 300;
      this.interLen = o.interLen || 12;
      this.maxCiv = o.maxCiv || 260;
      this.humans = new Map();
      this.events = [];
      this.nameIdx = (Math.random() * AI_NAMES.length) | 0;
      this.reset();
    }

    /* ---------- setup ---------- */
    reset() {
      this.uid = 1; this.ents = []; this.byId = new Map(); this.leaders = [];
      this.bars = MAP.BARS.map(b => Object.assign({}, b, { hp: 100, broken: false, shake: 0 }));
      this.gas = []; this.shells = []; this.vans = [];
      this.t = 0; this.state = 'play'; this.winner = null; this.winBy = ''; this.inter = 0; this.arrests = 0;
      this.gasT = rnd(15, 19); this.colorNext = 1; this.balT = 0; this.nextAI = 0;
      for (let k = 0; k < this.maxCiv; k++) { const p = this.civPoint(); this.add('civ', p.x, p.y); }
      this.copPosts = this.makePosts();
      const vanStarts = ['S2', 'JP1', 'O9', 'PC', 'TM1', 'HM'];
      for (let k = 0; k < VANS; k++) { const id = vanStarts[k % vanStarts.length], n = MAP.nodes[id]; this.vans.push({ id: k + 1, x: n.x, y: n.y, ang: 0, from: id, to: id, prev: null, stopT: 0, cool: 3, prisoners: [], unlock: 0, leaving: false, wait: 0 }); }
      for (const h of this.humans.values()) { h.eid = 0; h.respawn = 0; h.gasInit = false; h.round = { rec: 0, arrests: 0, scat: 0, peak: 0, score: 0, called: 0 }; this.spawnHuman(h); }
      this.balance(true);
    }
    makePosts() {
      const posts = [];
      const dz = MAP.DZ;
      posts.push({ x: dz.x - 30, y: dz.y + 10, aggro: 170, leash: 210, pri: 0 });
      posts.push({ x: dz.x + 25, y: dz.y - 15, aggro: 170, leash: 210, pri: 0 });
      for (const b of this.bars) {
        const n = b.key ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const s = (k - (n - 1) / 2) * 22;
          // stand on the dharna side of the barricade
          const side = Math.sign((dz.x - b.x) * b.dirx + (dz.y - b.y) * b.diry) || 1;
          posts.push({ x: b.x + b.dirx * 18 * side + Math.cos(b.ang) * s, y: b.y + b.diry * 18 * side + Math.sin(b.ang) * s, aggro: 230, leash: 330, pri: b.key ? 1 : 2, bar: b.i });
        }
      }
      posts.push({ x: dz.x + 5, y: dz.y + 30, aggro: 170, leash: 210, pri: 3 });
      const roamNodes = ['S2', 'JP1', 'JT', 'O8', 'O10', 'PC', 'TM1', 'HM', 'O9', 'KG2', 'BS', 'WP'];
      for (const id of roamNodes) { const n = MAP.nodes[id]; posts.push({ x: n.x, y: n.y, aggro: 320, leash: 600, pri: 4, roam: true }); }
      return posts;
    }
    civPoint() { const s = MAP.CIVSPOTS[(Math.random() * MAP.CIVSPOTS.length) | 0]; return this.nudge(s.x, s.y, 16); }
    spawnPoint() { const s = MAP.SPAWNS[(Math.random() * MAP.SPAWNS.length) | 0]; return this.nudge(s.x, s.y, 10); }
    nudge(x, y, r) { for (let k = 0; k < 8; k++) { const nx = x + rnd(-r, r), ny = y + rnd(-r, r); if (MAP.isWalk(nx, ny)) return { x: nx, y: ny }; } return MAP.nearestWalk(x, y); }
    add(kind, x, y, o) {
      const e = Object.assign({ id: this.uid++, kind, x, y, px: x, py: y, r: R[kind], m: kind === 'lead' ? 4 : kind === 'cop' ? 3 : 1,
        look: (Math.random() * 16) | 0, col: 255, stun: 0, immune: 0, flee: 0, fx: 0, fy: 0, lead: null, rank: 0,
        ox: rnd(-12, 12), oy: rnd(-12, 12), wt: null, aim: 0, swing: 0, human: null, gasd: 0 }, o || {});
      this.ents.push(e); this.byId.set(e.id, e); return e;
    }
    remove(e) { e.dead = true; this.byId.delete(e.id); }
    nextColor() { const c = this.colorNext; this.colorNext = this.colorNext % (NCOL - 1) + 1; return c; }
    makeLeader(x, y, o) {
      const L = this.add('lead', x, y, Object.assign({ col: this.nextColor(), count: 0, meter: 0, trail: [{ x, y }], state: 'gather', gT: 0,
        goalSize: (rnd(12, 22)) | 0, path: null, pi: 0, naaraT: rnd(3, 7), speed: 132, slow: 1, ai: true, name: '' }, o || {}));
      this.leaders.push(L); return L;
    }
    spawnAIKafila(x, y) {
      const p = x === undefined ? this.spawnPoint() : { x, y };
      const name = AI_NAMES[this.nameIdx++ % AI_NAMES.length];
      const L = this.makeLeader(p.x, p.y, { name: name + ' 🤖' });
      for (let k = 0; k < 4; k++) { const q = this.nudge(p.x, p.y, 20); const f = this.add('fol', q.x, q.y, { col: L.col }); f.lead = L; }
      this.ev({ k: 'toast', m: name + ' kafila has started out' });
      return L;
    }
    spawnCopBot(post) {
      const p = post || this.copPosts[(Math.random() * this.copPosts.length) | 0];
      const q = this.nudge(p.x, p.y, 12);
      return this.add('cop', q.x, q.y, { post: { x: p.x, y: p.y }, home: p, aggro: p.aggro, leash: p.leash, roam: !!p.roam, cd: rnd(0, 1), wander: rnd(2, 6), bot: true });
    }

    /* ---------- humans ---------- */
    addHuman(pid, name, team) {
      const h = { pid, name: String(name || 'Player').slice(0, 16), team: team === 'C' ? 'C' : 'P', eid: 0, respawn: 0,
        input: { ax: 0, ay: 0, hold: false, aim: null }, cd: { naara: 0, dash: 0, lathi: 0, gas: 0, drag: 0, call: 0, rescue: 0, knock: 0, barrier: 0 }, dashT: 0, rescueT: 0, gasAmmo: GAS_START, gasHits: 0,
        score: 0, round: { rec: 0, arrests: 0, scat: 0, peak: 0, score: 0, called: 0 } };
      this.humans.set(pid, h);
      if (this.state === 'play') this.spawnHuman(h);
      return h;
    }
    removeHuman(pid) {
      const h = this.humans.get(pid); if (!h) return;
      const e = this.byId.get(h.eid);
      if (e) {
        if (e.kind === 'lead') { e.human = null; e.ai = true; e.name = h.name + ' 🤖'; e.state = 'gather'; e.gT = 0; } // hand the kafila to a bot
        else { this.dropHeld(e); this.remove(e); }
      }
      for (const c of this.ents) if (c.squad === pid) { this.dropHeld(c); this.remove(c); }
      {
      }
      this.humans.delete(pid);
    }
    setTeam(pid, team) { const h = this.humans.get(pid); if (!h) return; const e = this.byId.get(h.eid); if (e) { if (e.kind === 'lead') this.arrestSilently(e); else { this.dropHeld(e); this.remove(e); } } for (const c of this.ents) if (c.squad === pid) { this.dropHeld(c); this.remove(c); } h.team = team === 'C' ? 'C' : 'P'; h.eid = 0; this.spawnHuman(h); }
    spawnHuman(h) {
      if (h.team === 'P') {
        const p = this.spawnPoint();
        const L = this.makeLeader(p.x, p.y, { ai: false, human: h.pid, name: h.name, speed: 150 });
        h.eid = L.id;
      } else {
        const s2 = MAP.nodes.S2, p = this.nudge(s2.x + rnd(-10, 10), s2.y + rnd(-10, 10), 14);
        const c = this.add('cop', p.x, p.y, { human: h.pid, name: h.name, m: 4, r: 8 });
        h.eid = c.id;
      }
      h.dashT = 0; for (const k in h.cd) h.cd[k] = 0;
      if (h.round && !h.gasInit) { h.gasAmmo = GAS_START; h.gasHits = 0; h.gasInit = true; }
    }
    setInput(pid, inp) {
      const h = this.humans.get(pid); if (!h || !inp) return;
      let ax = +inp.ax || 0, ay = +inp.ay || 0; const m = hyp(ax, ay); if (m > 1) { ax /= m; ay /= m; }
      h.input.ax = ax; h.input.ay = ay; h.input.hold = !!inp.hold;
      h.input.aim = (typeof inp.aim === 'number' && isFinite(inp.aim)) ? inp.aim : null;
    }
    action(pid, k, arg) {
      const h = this.humans.get(pid); if (!h || this.state !== 'play') return;
      const e = this.byId.get(h.eid); if (!e || e.stun > 0 || e.held) return;
      if (k === 'dash' && h.cd.dash <= 0) { h.dashT = .5; h.cd.dash = 4; this.ev({ k: 'sfx', n: 'dash', x: e.x, y: e.y, to: pid }); return; }
      if (h.team === 'P' && e.kind === 'lead') {
        if (k === 'naara' && h.cd.naara <= 0) { this.naara(e); h.cd.naara = 3; }
        else if (k === 'rescue' && h.cd.rescue <= 0) { h.cd.rescue = .5; h.rescueT = 1.2; if (!this.rescueNear(e)) this.ev({ k: 'toast', to: pid, m: 'Get 5+ of your kafila next to a police van or a policeman who is dragging someone' }); }
      } else if (h.team === 'C' && e.kind === 'cop') {
        if (k === 'lathi' && h.cd.lathi <= 0) { h.cd.lathi = .45; this.lathi(e, h); }
        else if (k === 'gas' && h.cd.gas <= 0) {
          if (h.gasAmmo <= 0) { this.ev({ k: 'toast', to: pid, m: 'Out of tear gas. Lathi ' + (GAS_HITS - h.gasHits) + ' more people to earn 3 shells' }); h.cd.gas = .5; return; }
          let tx = arg && isFinite(arg.x) ? arg.x : e.x + Math.cos(e.aim) * 200, ty = arg && isFinite(arg.y) ? arg.y : e.y + Math.sin(e.aim) * 200;
          const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy); if (d > 340) { tx = e.x + dx / d * 340; ty = e.y + dy / d * 340; }
          this.throwGas(e.x, e.y, tx, ty); h.cd.gas = 1.5; h.gasAmmo--;
        } else if (k === 'drag' && h.cd.drag <= 0) { h.cd.drag = .4; this.dragAction(e, h); }
        else if (k === 'call' && h.cd.call <= 0) { h.cd.call = .3; this.callBackup(e, h); }
        else if (k === 'barrier' && h.cd.barrier <= 0) { h.cd.barrier = 1; this.buildAction(e, h); }
      }
    }
    buildAction(e, h) {
      let cops = 0; for (const c of this.ents) if (!c.dead && c.kind === 'cop' && c.stun <= 0 && hyp(c.x - e.x, c.y - e.y) < 90) cops++;
      if (cops < COPS_BUILD) { this.ev({ k: 'toast', to: h.pid, m: 'You need 5 police here to put up a barricade (' + cops + ' now). Call backup with W' }); return; }
      let near = null, nd = 90; for (const b of this.bars) if (b.broken) { const d = hyp(b.x - e.x, b.y - e.y); if (d < nd) { nd = d; near = b; } }
      if (near) { this.restoreBar(near); h.round.score += 10; return; }
      if (this.bars.filter(b => b.built).length >= MAX_BUILT) { this.ev({ k: 'toast', to: h.pid, m: 'Too many police barricades already. Rebuild a broken one instead' }); return; }
      const g = this.roadAt(e.x, e.y);
      if (!g) { this.ev({ k: 'toast', to: h.pid, m: 'Stand in the middle of a road to put up a barricade' }); return; }
      for (const b of this.bars) if (hyp(b.x - g.x, b.y - g.y) < 60) { this.ev({ k: 'toast', to: h.pid, m: 'There is already a barricade here' }); return; }
      const half = g.w * MAP.M / 2 + 6, ang = Math.atan2(g.dy, g.dx) + Math.PI / 2;
      const b = { i: this.bars.length, key: false, built: true, name: 'Police barricade', x: g.x, y: g.y, ang, x1: g.x - g.dy * half, y1: g.y + g.dx * half, x2: g.x + g.dy * half, y2: g.y - g.dx * half, thick: 7, dirx: g.dx, diry: g.dy, hp: 100, broken: false, shake: 0, half };
      // never trap anyone inside the barricade line
      for (const p of this.ents) if (!p.dead && p.kind !== 'cop' && segDist(p.x, p.y, b) < p.r + b.thick) { this.ev({ k: 'toast', to: h.pid, m: 'People are standing in the way' }); return; }
      this.bars.push(b); h.round.score += 10;
      this.txt(g.x, g.y - 30, 'बैरिकेड लगा!', '#cfe3ff', 16); this.ev({ k: 'sfx', n: 'push', x: g.x, y: g.y });
    }
    restoreBar(b) { b.broken = false; b.hp = 100; b.build = 0; this.txt(b.x, b.y - 30, 'बैरिकेड लगा!', '#cfe3ff', 16); this.ev({ k: 'sfx', n: 'push', x: b.x, y: b.y }); for (const c of this.ents) if (c.task && c.task.bar === b) c.task = null; }
    roadAt(x, y) {
      if (!MAP.isWalk(x, y)) return null;
      let best = null, bd = 1e9;
      for (const r of MAP.ROADS) {
        if (r.ring) continue;
        for (let i = 0; i < r.p.length - 1; i++) {
          const A = MAP.nodes[r.p[i]], B = MAP.nodes[r.p[i + 1]], vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy;
          let t = ((x - A.x) * vx + (y - A.y) * vy) / L2; t = clamp(t, 0, 1);
          const px = A.x + vx * t, py = A.y + vy * t, d = hyp(x - px, y - py);
          if (d < bd && t > .05 && t < .95) { bd = d; const L = Math.sqrt(L2); best = { x: px, y: py, dx: vx / L, dy: vy / L, w: r.w }; }
        }
      }
      return best && bd < best.w * MAP.M / 2 ? best : null;
    }
    planRebuilds() {
      for (const b of this.bars) {
        if (!b.broken || b.built) continue;
        if (this.leaders.some(L => !L.dead && L.count >= 5 && hyp(L.x - b.x, L.y - b.y) < 320)) continue;
        const crew = this.ents.filter(c => !c.dead && c.kind === 'cop' && c.bot && !c.drag && (!c.task || c.task.bar === b));
        crew.sort((a, c) => hyp(a.x - b.x, a.y - b.y) - hyp(c.x - b.x, c.y - b.y));
        for (const c of crew.slice(0, COPS_BUILD)) if (hyp(c.x - b.x, c.y - b.y) < 1200) c.task = { bar: b, x: b.x + rnd(-20, 20), y: b.y + rnd(-20, 20), until: this.t + 30 };
      }
    }
    callsLeft(h) { return Math.floor(h.round.scat / HITS_PER_CALL) - h.round.called; }
    squadOf(pid) { let n = 0; for (const c of this.ents) if (!c.dead && c.squad === pid) n++; return n; }
    callBackup(e, h) {
      const sq = this.squadOf(h.pid);
      if (sq >= SQUAD_MAX) { this.ev({ k: 'toast', to: h.pid, m: 'Your squad is full (5 constables)' }); return; }
      if (this.callsLeft(h) <= 0) { const need = HITS_PER_CALL - (h.round.scat % HITS_PER_CALL); this.ev({ k: 'toast', to: h.pid, m: 'Lathi ' + need + ' more people to call a constable' }); return; }
      h.round.called++;
      const a = Math.random() * 6.28, p = MAP.nearestWalk(e.x + Math.cos(a) * 140, e.y + Math.sin(a) * 140);
      this.add('cop', p.x, p.y, { squad: h.pid, cd: rnd(0, 1), post: { x: e.x, y: e.y }, aggro: 170, leash: 9999 });
      this.txt(e.x, e.y - 40, 'बैकअप आ रहा है!', '#cfe3ff', 15);
      this.ev({ k: 'sfx', n: 'arrest', x: e.x, y: e.y });
    }
    canGrab(t) { return !t.dead && !t.held && ((t.kind === 'fol') || (t.kind === 'lead' && t.count < 3)); }
    grab(c, t) {
      if (!this.canGrab(t)) return false;
      if (t.kind === 'lead') { for (const f of this.ents) if (f.kind === 'fol' && f.lead === t) this.scatter(f, t.x, t.y, null); }
      t.held = c.id; c.drag = t.id; t.heldFrom = t.kind === 'fol' ? t.lead : null;
      this.txt(t.x, t.y - 36, 'पकड़ा!', '#ffd27a', 14);
      this.ev({ k: 'sfx', n: 'push', x: c.x, y: c.y });
      return true;
    }
    dropHeld(c) { const t = c.drag && this.byId.get(c.drag); if (t) { t.held = 0; if (t.kind === 'fol') this.scatter(t, c.x, c.y, null); } c.drag = 0; }
    dragAction(c, h) {
      const held = c.drag && this.byId.get(c.drag);
      if (held) {
        const v = this.nearVan(c, 60);
        if (v && v.stopT > 0) { this.deposit(v, c, held, h); return; }
        if (this.nearThana(c)) { this.deposit(null, c, held, h); return; }
        if (v) { this.ev({ k: 'toast', to: h.pid, m: 'Wait for the van to stop, then press DRAG again' }); return; }
        this.ev({ k: 'toast', to: h.pid, m: 'Take them to a police van — it stops for 10 seconds when you get close' }); return;
      }
      let best = null, bd = 40;
      for (const t of this.ents) { if (!this.canGrab(t)) continue; const d = hyp(t.x - c.x, t.y - c.y); if (d < bd) { bd = d; best = t; } }
      if (best) { this.grab(c, best); if (h) h.round.score += 1; }
      else this.ev({ k: 'toast', to: h.pid, m: 'Stand next to a protester to drag them. Leaders need fewer than 3 people around' });
    }
    nearVan(c, r) { let best = null, bd = r; for (const v of this.vans) { const d = hyp(v.x - c.x, v.y - c.y); if (d < bd && !v.leaving && !v.flipped && v.prisoners.length < VAN_CAP) { bd = d; best = v; } } return best; }
    nearThana(c) { return hyp(c.x - MAP.BUS.x, c.y - MAP.BUS.y) < 70; }
    deposit(v, c, t, h) {
      c.drag = 0; t.held = 0;
      const rec = { col: t.col, look: t.look, kind: t.kind, human: t.human || null, name: t.name || '' };
      this.remove(t); this.arrests++;
      if (v) { v.prisoners.push(rec); if (v.prisoners.length >= VAN_CAP) { v.leaving = true; v.stopT = 0; this.ev({ k: 'toast', m: 'A police van is full and heading to the thana' }); } }
      this.txt(c.x, c.y - 36, v ? 'वैन में!' : 'थाने में!', '#ffd27a', 16);
      this.ev({ k: 'sfx', n: 'arrest', x: c.x, y: c.y });
      if (h && h.round) { h.round.arrests++; h.round.score += t.kind === 'lead' ? 20 : 8; }
      if (t.kind === 'lead') {
        this.ev({ k: 'toast', m: (t.name || 'Kafila').replace(' 🤖', '') + ' leader is in the police van' });
        if (t.human) { const hh = this.humans.get(t.human); if (hh) { hh.eid = 0; hh.respawn = 10; this.ev({ k: 'toast', to: hh.pid, m: 'You are in the police van! Your people can free you, or a new kafila starts in 10s' }); this.ev({ k: 'sfx', n: 'lose', to: hh.pid }); } }
      }
    }
    release(rec, x, y, L) {
      if (rec.kind === 'lead' && rec.human) { const hh = this.humans.get(rec.human); if (hh && !hh.eid) { const N = this.makeLeader(x, y, { ai: false, human: hh.pid, name: hh.name, speed: 150 }); hh.eid = N.id; hh.respawn = 0; this.ev({ k: 'toast', to: hh.pid, m: 'Your kafila freed you!' }); return; } }
      if (rec.kind === 'lead' && !rec.human) { this.makeLeader(x, y, { name: rec.name || 'Azaad Morcha 🤖' }); return; }
      const f = this.add('civ', x, y, { look: rec.look, immune: 0 });
      if (L && !L.dead) this.join(f, L); else { f.flee = 2; const a = Math.random() * 6.28; f.fx = Math.cos(a); f.fy = Math.sin(a); }
    }
    kafilaNear(x, y, r) {
      // largest single kafila within r: returns [leader, count]
      const m = new Map();
      for (const e of this.ents) if (!e.dead && !e.held && e.kind === 'fol' && e.lead && Math.abs(e.x - x) < r && Math.abs(e.y - y) < r && hyp(e.x - x, e.y - y) < r) m.set(e.lead, (m.get(e.lead) || 0) + 1);
      let best = null, bn = 0; for (const [L, n] of m) if (n > bn) { bn = n; best = L; }
      return [best, bn];
    }
    rescueNear(L) {
      for (const v of this.vans) if (v.prisoners.length && hyp(v.x - L.x, v.y - L.y) < 90) return true;
      for (const c of this.ents) if (!c.dead && c.kind === 'cop' && c.drag && hyp(c.x - L.x, c.y - L.y) < 90) return true;
      return false;
    }

    /* ---------- events ---------- */
    ev(o) { if (this.events.length < 400) this.events.push(o); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    txt(x, y, s, c, z) { this.ev({ k: 'txt', x, y, s, c: c || '#fff2c9', z: z || 15 }); }

    /* ---------- abilities ---------- */
    join(c, L) {
      if (L.dead || L.count >= 70 || c.kind !== 'civ') return false;
      c.kind = 'fol'; c.lead = L; c.col = L.col; c.flee = 0; L.count++;
      if (L.human) { const h = this.humans.get(L.human); if (h) { h.round.rec++; h.round.score += 1; if (Math.random() < .35) this.ev({ k: 'sfx', n: 'join', x: c.x, y: c.y, to: h.pid }); } }
      return true;
    }
    scatter(f, sx, sy, by) {
      if (f.kind !== 'fol') return;
      const a = Math.atan2(f.y - sy, f.x - sx) + rnd(-.5, .5);
      f.kind = 'civ'; f.lead = null; f.flee = rnd(1.8, 3); f.immune = 4; f.fx = Math.cos(a); f.fy = Math.sin(a); f.col = 255;
      if (by) { by.round.scat++; by.round.score += 1; by.gasHits = (by.gasHits || 0) + 1; if (by.gasHits >= GAS_HITS) { by.gasHits -= GAS_HITS; by.gasAmmo = (by.gasAmmo || 0) + GAS_EARN; this.ev({ k: 'toast', to: by.pid, m: '+3 tear gas shells' }); } }
    }
    naara(L) {
      this.txt(L.x, L.y - 34, SLOGANS[(Math.random() * SLOGANS.length) | 0], '#fff2c9', 16);
      this.ev({ k: 'ring', x: L.x, y: L.y, c: L.col });
      this.ev({ k: 'sfx', n: 'naara', x: L.x, y: L.y });
      for (const e of this.ents) {
        if (e.dead) continue;
        const d = hyp(e.x - L.x, e.y - L.y);
        if (e.kind === 'civ' && d < 160 && e.immune <= 0 && Math.random() < .72) this.join(e, L);
      }
      // every 10 people shouting together leave one policeman dizzy
      const n = Math.floor(L.count / 10);
      if (n > 0) {
        const cops = this.ents.filter(c => !c.dead && c.kind === 'cop' && hyp(c.x - L.x, c.y - L.y) < 140).sort((a, b) => hyp(a.x - L.x, a.y - L.y) - hyp(b.x - L.x, b.y - L.y)).slice(0, n);
        for (const c of cops) { c.stun = Math.max(c.stun, 2.5); c.dizzy = 2.5; if (c.drag) this.dropHeld(c); this.txt(c.x, c.y - 36, 'चक्कर!', '#ffe58a', 14); }
      }
    }
    lathi(c, h) {
      c.swing = .25; this.ev({ k: 'sfx', n: 'lathi', x: c.x, y: c.y });
      const arc = (aim) => {
        const hits = [];
        for (const e of this.ents) {
            if (e.dead || e === c || e.held || (e.kind !== 'fol' && e.kind !== 'lead' && e.kind !== 'civ')) continue;
          const dx = e.x - c.x, dy = e.y - c.y, d = hyp(dx, dy); if (d > 74) continue;
          let da = Math.atan2(dy, dx) - aim; da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) <= 1.0) hits.push(e);
        }
        return hits;
      };
      let hits = arc(c.aim);
      if (!hits.some(e => e.kind !== 'civ')) {
        let best = null, bd = 80;
        for (const e of this.ents) if (!e.dead && !e.held && (e.kind === 'fol' || e.kind === 'lead')) { const d = hyp(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; best = e; } }
        if (best) { c.aim = Math.atan2(best.y - c.y, best.x - c.x); hits = arc(c.aim); }
      }
      let n = 0;
      for (const e of hits) {
        if (e.kind === 'fol') { this.scatter(e, c.x, c.y, h); n++; }
        else if (e.kind === 'lead') { e.stun = 1; n++; }
        else if (e.kind === 'civ') { const d = hyp(e.x - c.x, e.y - c.y) || 1; e.flee = 1.4; e.fx = (e.x - c.x) / d; e.fy = (e.y - c.y) / d; }
      }
      if (n) this.txt(c.x + Math.cos(c.aim) * 36, c.y + Math.sin(c.aim) * 36 - 20, 'धड़ाम!', '#ffe1a8', 15);
    }
    gasHit(x, y, by) {
      const R = 85, people = [];
      for (const e of this.ents) if (!e.dead && !e.held && (e.kind === 'fol' || e.kind === 'lead')) { const d = hyp(e.x - x, e.y - y); if (d < R) people.push([d, e]); }
      if (people.length === 1) {
        const e = people[0][1]; e.stun = Math.max(e.stun, 10); e.dizzy = 10;
        this.txt(e.x, e.y - 40, 'चक्कर! 10s', '#e8f0c8', 15);
        return;
      }
      people.sort((a, b) => a[0] - b[0]);
      let n = 0;
      for (const [, e] of people) { if (e.kind !== 'fol') continue; this.scatter(e, x, y, null); if (++n >= GAS_SCATTER) break; }
      for (const [, e] of people) if (e.kind === 'lead') e.stun = Math.max(e.stun, 1.2);
      if (n) this.txt(x, y - 40, 'आँसू गैस! −' + n, '#e8f0c8', 15);
    }
    throwGas(x0, y0, x1, y1, by) { this.shells.push({ x0, y0, x1, y1, t: 0, dur: .6, x: x0, y: y0, by }); this.ev({ k: 'sfx', n: 'gas', x: x0, y: y0 }); }
    arrest(L, by) {
      if (L.dead) return;
      for (const e of this.ents) if (e.kind === 'fol' && e.lead === L) this.scatter(e, L.x, L.y, null);
      this.remove(L); this.arrests++;
      this.ev({ k: 'bus', x: L.x, y: L.y, c: L.col });
      this.ev({ k: 'sfx', n: 'arrest', x: L.x, y: L.y });
      this.txt(L.x, L.y - 34, 'बस में!', '#ffd27a', 18);
      if (by && by.round) { by.round.arrests++; by.round.score += 15; }
      if (L.human) {
        const h = this.humans.get(L.human);
        if (h) { h.eid = 0; h.respawn = 6; this.ev({ k: 'toast', to: h.pid, m: 'Lifted onto the bus! A new kafila starts in 6s' }); this.ev({ k: 'sfx', n: 'lose', to: h.pid }); }
      }
      this.ev({ k: 'toast', m: (L.name || 'Kafila').replace(' 🤖', '') + ' leader lifted onto the bus' });
    }
    arrestSilently(L) { for (const e of this.ents) if (e.kind === 'fol' && e.lead === L) this.scatter(e, L.x, L.y, null); this.remove(L); }
    pushBar(b, L, dt) {
      if (L.count < GROUP_BAR) {
        if (L.human && (L.barHintT || 0) <= this.t) { L.barHintT = this.t + 4; this.ev({ k: 'toast', to: L.human, m: 'You need 10+ people to break a barricade (you have ' + L.count + ')' }); }
        return;
      }
      b.hp -= dt * (L.count * 1.1); b.shake = .15;
      if (Math.random() < dt * 2.5) { this.txt(b.x + rnd(-20, 20), b.y - 26, 'धक्का!', '#ffd27a', 14); if (L.human) this.ev({ k: 'sfx', n: 'push', to: L.human }); }
      if (b.hp <= 0 && !b.broken) {
        b.broken = true; b.hp = 0;
        this.txt(b.x, b.y - 30, 'बैरिकेड टूटा!', '#ffb48a', 18);
        this.ev({ k: 'sfx', n: 'break', x: b.x, y: b.y });
        this.ev({ k: 'toast', m: 'Barricade down: ' + b.name });
        for (const l of this.leaders) if (!l.dead && l.human && segDist(l.x, l.y, b) < 80) { const h = this.humans.get(l.human); if (h) h.round.score += 20; }
      }
    }

    /* ---------- movement ---------- */
    blocked(e, x, y) {
      if (!MAP.isWalk(x, y)) return true;
      if (e.kind !== 'cop') for (const b of this.bars) if (!b.broken && segDist(x, y, b) < e.r + b.thick) return true;
      return false;
    }
    tryMove(e, nx, ny) {
      if (!MAP.isWalk(e.x, e.y)) { const q = MAP.nearestWalk(e.x, e.y); e.x = q.x; e.y = q.y; }
      if (!this.blocked(e, nx, ny)) { e.x = nx; e.y = ny; return true; }
      // slide along walls: try the move turned a little left/right, shortened by how far it turns
      const dx = nx - e.x, dy = ny - e.y;
      for (const a of SLIDE) {
        const c = Math.cos(a), s = Math.sin(a), k = c;
        const rx = (dx * c - dy * s) * k, ry = (dx * s + dy * c) * k;
        if (!this.blocked(e, e.x + rx, e.y + ry)) { e.x += rx; e.y += ry; return true; }
      }
      return false;
    }
    moveTo(e, tx, ty, sp, dt) {
      const dx = tx - e.x, dy = ty - e.y, d = hyp(dx, dy);
      if (d < 2) return d;
      const s = Math.min(d, sp * dt);
      if (!this.tryMove(e, e.x + dx / d * s, e.y + dy / d * s)) e.stuck = (e.stuck || 0) + dt; else e.stuck = 0;
      return d;
    }

    /* ---------- bots ---------- */
    balance(initial) {
      let hp = 0, hc = 0; for (const h of this.humans.values()) h.team === 'P' ? hp++ : hc++;
      const aiK = this.leaders.filter(l => !l.dead && !l.human).length;
      const wantK = clamp(5 - hp, 2, 5) + (hp === 0 ? 1 : 0);
      if (initial) { for (let k = aiK; k < Math.ceil(wantK * .6); k++) this.spawnAIKafila(); this.nextAI = this.t + rnd(10, 18); }
      else if (aiK < wantK && this.t >= this.nextAI && this.t < this.roundLen - 60) { this.spawnAIKafila(); this.nextAI = this.t + rnd(12, 22); }
      const bots = this.ents.filter(e => !e.dead && e.kind === 'cop' && e.bot);
      const wantC = clamp(15 - hc * 2, 6, 15);
      if (bots.length < wantC) {
        const used = new Map(); for (const b of bots) used.set(b.home, (used.get(b.home) || 0) + 1);
        const free = this.copPosts.filter(p => !used.get(p)).sort((a, b) => a.pri - b.pri);
        for (let k = bots.length; k < wantC; k++) this.spawnCopBot(free[k - bots.length] || null);
      } else if (bots.length > wantC + 2) {
        const extra = bots.sort((a, b) => b.home.pri - a.home.pri).slice(0, bots.length - wantC);
        for (const b of extra) this.remove(b);
      }
    }

    /* ---------- main step ---------- */
    step(dt) {
      dt = Math.min(dt, .1);
      if (this.state === 'inter') { if (!this.offline) { this.inter -= dt; if (this.inter <= 0) this.reset(); } return; }
      this.t += dt;
      const ents = this.ents;

      for (const h of this.humans.values()) {
        for (const k in h.cd) h.cd[k] = Math.max(0, h.cd[k] - dt);
        h.dashT = Math.max(0, h.dashT - dt);
        h.rescueT = Math.max(0, h.rescueT - dt);
        if (!h.eid) { h.respawn -= dt; if (h.respawn <= 0) this.spawnHuman(h); }
      }
      this.balT -= dt; if (this.balT <= 0) { this.balT = 2; this.balance(false); this.planRebuilds(); }
      // 5 police standing at a broken barricade put it back up
      for (const b of this.bars) {
        if (!b.broken) continue;
        let n = 0; for (const c of ents) if (!c.dead && c.kind === 'cop' && c.stun <= 0 && hyp(c.x - b.x, c.y - b.y) < 80) n++;
        if (n >= COPS_BUILD) { b.build = (b.build || 0) + dt; if (b.build > 3) this.restoreBar(b); } else b.build = 0;
      }

      // counts and ranks
      for (const L of this.leaders) L.count = 0;
      for (const e of ents) {
        if (e.dead || e.kind !== 'fol' || e.held) continue;
        if (!e.lead || e.lead.dead) { e.kind = 'civ'; e.lead = null; e.col = 255; continue; }
        e.rank = e.lead.count++;
      }
      for (const L of this.leaders) {
        if (L.dead) continue;
        L.slow = 1; for (const g of this.gas) if (hyp(L.x - g.x, L.y - g.y) < g.r) L.slow = .6;
        if (L.human) { const h = this.humans.get(L.human); if (h) h.round.peak = Math.max(h.round.peak, L.count); }
        const tl = L.trail[L.trail.length - 1];
        if (!tl || hyp(L.x - tl.x, L.y - tl.y) > 14) { L.trail.push({ x: L.x, y: L.y }); if (L.trail.length > 70) L.trail.shift(); }
      }

      // humans
      for (const h of this.humans.values()) {
        const e = this.byId.get(h.eid); if (!e) continue;
        if (e.stun > 0) { e.stun -= dt; continue; }
        if (e.held) continue;
        const { ax, ay } = h.input, mag = hyp(ax, ay);
        let sp = e.kind === 'lead' ? 150 * e.slow : (e.drag ? 125 : 172);
        if (h.dashT > 0) sp = 330;
        if (mag > .05) { this.tryMove(e, e.x + ax * sp * dt, e.y + ay * sp * dt); e.aim = Math.atan2(ay, ax); }
        if (h.input.aim !== null) e.aim = h.input.aim;
        if (e.kind === 'lead' && h.input.hold) for (const b of this.bars) if (!b.broken && segDist(e.x, e.y, b) < 36) this.pushBar(b, e, dt);
      }

      // AI leaders
      for (const L of this.leaders) {
        if (L.dead || !L.ai || L.held) continue;
        if (L.stun > 0) { L.stun -= dt; continue; }
        L.naaraT -= dt;
        let near = null, nd = 420, copD = 1e9;
        for (const e of ents) {
          if (e.dead) continue;
          if (e.kind === 'civ' && e.immune <= 0) { const d = hyp(e.x - L.x, e.y - L.y); if (d < nd) { nd = d; near = e; } }
          else if (e.kind === 'cop') { const d = hyp(e.x - L.x, e.y - L.y); if (d < copD) copD = d; }
        }
        if (L.naaraT <= 0 && ((near && nd < 150) || (copD < 100 && L.count >= 8))) { this.naara(L); L.naaraT = rnd(5, 8); }
        const sp = L.speed * L.slow;
        if (L.count >= GROUP_RESCUE + 1) {
          let goal = null, gd = 260;
          for (const v of this.vans) if (v.prisoners.length) { const d = hyp(v.x - L.x, v.y - L.y); if (d < gd) { gd = d; goal = v; } }
          for (const c of ents) if (!c.dead && c.kind === 'cop' && c.drag) { const d = hyp(c.x - L.x, c.y - L.y); if (d < gd) { gd = d; goal = c; } }
          if (goal) { this.moveTo(L, goal.x, goal.y, sp, dt); continue; }
        }
        if (L.state === 'gather') {
          L.gT += dt;
          if (near && (!L.stuck || L.stuck < 1)) this.moveTo(L, near.x, near.y, sp, dt);
          else {
            if (!L.wt || hyp(L.wt.x - L.x, L.wt.y - L.y) < 24 || L.stuck > 1) { const s = MAP.CIVSPOTS[(Math.random() * MAP.CIVSPOTS.length) | 0]; L.wt = { x: s.x, y: s.y }; L.stuck = 0; L.path = MAP.gridPath(L.x, L.y, s.x, s.y) || [{ x: s.x, y: s.y }]; L.pi = 0; }
            const tg = L.path && L.path[Math.min(L.pi, L.path.length - 1)];
            if (tg) { const d = this.moveTo(L, tg.x, tg.y, sp, dt); if (d < 14 && L.pi < L.path.length - 1) L.pi++; }
          }
          if (L.count >= L.goalSize || L.gT > 45) { L.state = 'march'; L.path = this.dzPath(L); L.pi = 0; }
        } else {
          if (L.count < 4 && copD < 260) { L.state = 'gather'; L.gT = 0; L.goalSize = Math.max(10, L.goalSize - 3); L.wt = null; L.path = null; continue; }
          const tg = L.path[Math.min(L.pi, L.path.length - 1)];
          const d = this.moveTo(L, tg.x, tg.y, sp, dt);
          if (d < 14 && L.pi < L.path.length - 1) L.pi++;
          for (const b of this.bars) if (!b.broken && segDist(L.x, L.y, b) < 36) { if (L.count < GROUP_BAR) { L.state = 'gather'; L.gT = 0; L.goalSize = Math.max(14, L.goalSize); L.wt = null; L.path = null; break; } this.pushBar(b, L, dt); }
          if (L.state === 'march' && L.stuck > 2) { L.path = this.dzPath(L); L.pi = 0; L.stuck = 0; }
        }
      }

      // crowd, civilians, bot police
      for (const e of ents) {
        if (e.dead || e.held) continue;
        if (e.immune > 0) e.immune -= dt;
        if (e.kind === 'civ') {
          if (e.flee > 0) { e.flee -= dt; if (!this.tryMove(e, e.x + e.fx * 190 * dt, e.y + e.fy * 190 * dt)) { const a = Math.random() * 6.28; e.fx = Math.cos(a); e.fy = Math.sin(a); } }
          else {
            if (!e.wt || hyp(e.wt.x - e.x, e.wt.y - e.y) < 8 || e.stuck > .5 || Math.random() < dt * .12) { e.wt = { x: e.x + rnd(-150, 150), y: e.y + rnd(-150, 150) }; e.stuck = 0; }
            this.moveTo(e, e.wt.x, e.wt.y, 38, dt);
          }
        } else if (e.kind === 'fol') {
          const L = e.lead, tr = L.trail, idx = Math.max(0, tr.length - 1 - Math.floor(e.rank / 2.5));
          const t = tr[idx] || L, tx = t.x + e.ox, ty = t.y + e.oy;
          const d = hyp(tx - e.x, ty - e.y);
          let sp = Math.min(300, 150 + d * 1.2);
          if (L.human) { const h = this.humans.get(L.human); if (h && h.dashT > 0) sp = 340; }
          e.gasd = 0;
          for (const g of this.gas) if (hyp(e.x - g.x, e.y - g.y) < g.r) { sp *= .6; e.gasd = 1; }
          if (e.stun > 0) { e.stun -= dt; continue; }
          if (e.kind === 'fol') { this.moveTo(e, tx, ty, sp, dt); if (e.stuck > 1.5 && d > 60) { const q = this.nudge(t.x, t.y, 10); e.x = q.x; e.y = q.y; e.stuck = 0; } }
        } else if (e.kind === 'cop' && (e.bot || e.squad)) this.copAI(e, dt);
        if (e.swing > 0) e.swing -= dt;
      }

      // 10 andolankari around a policeman: bots/constables are pushed out of the game, players are knocked down
      for (const c of ents) {
        if (c.dead || c.kind !== 'cop') continue;
        const [L, n] = this.kafilaNear(c.x, c.y, 70);
        if (n >= GROUP_REMOVE) {
          c.surround = (c.surround || 0) + dt;
          if (c.surround > 2.2) {
            c.surround = 0;
            if (c.human) {
              const h = this.humans.get(c.human);
              if (h && h.cd.knock <= 0) { c.stun = 2; h.cd.knock = 4; this.dropHeld(c); const a = Math.atan2(c.y - L.y, c.x - L.x); this.tryMove(c, c.x + Math.cos(a) * 34, c.y + Math.sin(a) * 34); this.txt(c.x, c.y - 34, 'भीड़ ने धकेला!', '#ffd0b0', 15); this.ev({ k: 'sfx', n: 'push', to: h.pid }); }
            } else {
              this.dropHeld(c); this.remove(c);
              this.txt(c.x, c.y - 34, 'पुलिस हटाओ!', '#ffd0b0', 15); this.ev({ k: 'sfx', n: 'push', x: c.x, y: c.y });
              if (c.squad) this.ev({ k: 'toast', to: c.squad, m: 'The crowd pushed one of your constables out' });
            }
          }
        } else c.surround = Math.max(0, (c.surround || 0) - dt * .5);
        // 5 andolankari around a policeman who is dragging someone free the prisoner
        if (!c.dead && c.drag && n >= GROUP_RESCUE) {
          let k = 1; if (L && L.human) { const h = this.humans.get(L.human); if (h && h.rescueT > 0) k = 2; }
          c.rescue = (c.rescue || 0) + dt * k;
          if (c.rescue > 1.5) {
            c.rescue = 0; const t = this.byId.get(c.drag); c.drag = 0;
            if (t) { t.held = 0; if (t.kind === 'fol') { t.kind = 'civ'; t.lead = null; this.join(t, L); } }
            c.stun = Math.max(c.stun, 1.2); this.txt(c.x, c.y - 36, 'छुड़ा लिया!', '#c8ffb0', 16); this.ev({ k: 'sfx', n: 'break', x: c.x, y: c.y });
          }
        } else if (c.rescue) c.rescue = Math.max(0, c.rescue - dt);
      }
      // keep dragged people attached to their policeman
      for (const c of ents) {
        if (c.dead || !c.drag) continue;
        const t = this.byId.get(c.drag);
        if (!t || t.dead) { c.drag = 0; continue; }
        const a = c.aim + Math.PI; t.x = c.x + Math.cos(a) * 13; t.y = c.y + Math.sin(a) * 13 + 2; t.px = t.x; t.py = t.y;
      }
      this.updateVans(dt);

      this.separate(dt);

      // dharna meters
      const dz = MAP.DZ;
      for (const L of this.leaders) {
        if (L.dead) continue;
        const inZone = !L.held && hyp(L.x - dz.x, L.y - dz.y) < dz.r;
        if (inZone && L.count >= 5) {
          let cops = 0; for (const e of ents) if (!e.dead && e.kind === 'cop' && e.stun <= 0 && hyp(e.x - dz.x, e.y - dz.y) < dz.r) cops++;
          const inc = Math.max(.25, .6 + L.count * .12 - cops * .4) * dt;
          L.meter = Math.min(100, L.meter + inc);
          if (L.human) { const h = this.humans.get(L.human); if (h) h.round.score += inc * .5; }
          if (Math.random() < dt * .8) this.txt(L.x + rnd(-30, 30), L.y - 40, SLOGANS[(Math.random() * SLOGANS.length) | 0], '#fff2c9', 13);
        } else L.meter = Math.max(0, L.meter - (inZone ? 1 : 2) * dt);
        if (L.meter >= 100) { this.end('P', L.name.replace(' 🤖', '')); return; }
      }

      // bot tear gas
      this.gasT -= dt;
      if (this.gasT <= 0) {
        this.gasT = rnd(9, 12);
        let best = null, bc = 5;
        for (const L of this.leaders) if (!L.dead && hyp(L.x - dz.x, L.y - dz.y) < 1100 && L.count > bc) { bc = L.count; best = L; }
        if (best) {
          let from = null, fd = 1e9;
          for (const e of ents) if (!e.dead && e.kind === 'cop' && e.bot) { const d = hyp(e.x - best.x, e.y - best.y); if (d < fd) { fd = d; from = e; } }
          if (from && fd < 460) { this.throwGas(from.x, from.y, best.x + rnd(-30, 30), best.y + rnd(-30, 30)); if (best.human) this.ev({ k: 'toast', to: best.human, m: 'Tear gas! Get your kafila out of the cloud' }); }
        }
      }
      for (const s of this.shells) { s.t += dt; const k = Math.min(1, s.t / s.dur); s.x = s.x0 + (s.x1 - s.x0) * k; s.y = s.y0 + (s.y1 - s.y0) * k; if (s.t >= s.dur) { this.gas.push({ x: s.x1, y: s.y1, r: 10, maxr: 85, t: 0, life: 5.5 }); s.done = true; this.gasHit(s.x1, s.y1, s.by); } }
      this.shells = this.shells.filter(s => !s.done);
      for (const g of this.gas) { g.t += dt; g.r = Math.min(g.maxr, g.r + dt * 160); }
      this.gas = this.gas.filter(g => g.t < g.life);
      if (this.gas.length) for (const e of ents) if (!e.dead && e.kind === 'civ' && e.flee <= 0) for (const g of this.gas) if (hyp(e.x - g.x, e.y - g.y) < g.r) { const a = Math.atan2(e.y - g.y, e.x - g.x); e.flee = 1.2; e.fx = Math.cos(a); e.fy = Math.sin(a); }
      for (const b of this.bars) b.shake = Math.max(0, b.shake - dt);

      // cleanup + civilians
      if (ents.some(e => e.dead)) { this.ents = ents.filter(e => !e.dead); this.leaders = this.leaders.filter(l => !l.dead); }
      let civs = 0; for (const e of this.ents) if (e.kind === 'civ') civs++;
      if (civs < this.maxCiv * .8 && Math.random() < dt * 5) { const p = this.civPoint(); this.add('civ', p.x, p.y); }

      if (this.t >= this.roundLen) this.end('C', '');
    }
    navTo(c, tx, ty, sp, dt) {
      c.navT = (c.navT || 0) - dt;
      if (!c.nav || c.navT <= 0 || hyp(c.navGoalX - tx, c.navGoalY - ty) > 50) {
        c.nav = MAP.gridPath(c.x, c.y, tx, ty, 40000) || [{ x: tx, y: ty }]; c.navI = 0; c.navT = 1.5; c.navGoalX = tx; c.navGoalY = ty;
      }
      const w = c.nav[Math.min(c.navI, c.nav.length - 1)];
      const d = this.moveTo(c, w.x, w.y, sp, dt);
      if (d < 12 && c.navI < c.nav.length - 1) c.navI++;
      c.aim = Math.atan2(w.y - c.y, w.x - c.x);
    }
    copAI(c, dt) {
      c.cd -= dt;
      if (c.stun > 0) { c.stun -= dt; return; }
      let owner = null;
      if (c.squad) { const h = this.humans.get(c.squad); if (!h || h.team !== 'C') { this.dropHeld(c); this.remove(c); return; } owner = this.byId.get(h.eid) || null; }
      // taking a prisoner to the nearest van (or the thana)
      if (c.drag) {
        const t = this.byId.get(c.drag);
        if (!t) { c.drag = 0; return; }
        let v = null, bd = 1e9;
        for (const vv of this.vans) if (!vv.leaving && !vv.flipped && vv.prisoners.length < VAN_CAP) { const d = hyp(vv.x - c.x, vv.y - c.y); if (d < bd) { bd = d; v = vv; } }
        const dth = hyp(MAP.BUS.x - c.x, MAP.BUS.y - c.y);
        const useVan = v && bd < dth;
        if (useVan && bd < 50) { if (v.stopT > 0) this.deposit(v, c, t, null); return; }
        if (!useVan && dth < 70) { this.deposit(null, c, t, null); return; }
        this.navTo(c, useVan ? v.x : MAP.BUS.x, useVan ? v.y : MAP.BUS.y, 118, dt);
        c.dragT = (c.dragT || 0) + dt; if (c.dragT > 45) { this.dropHeld(c); c.dragT = 0; }
        return;
      }
      c.dragT = 0;
      const ax = owner ? owner.x : c.post.x, ay = owner ? owner.y : c.post.y, leash = owner ? 240 : c.leash;
      let target = null, td = 1e9;
      for (const L of this.leaders) {
        if (L.dead || L.held) continue;
        const d = hyp(c.x - L.x, c.y - L.y);
        if (d < c.aggro && hyp(L.x - ax, L.y - ay) < leash && d < td) { td = d; target = L; }
      }
      if (target) {
        this.moveTo(c, target.x, target.y, 130, dt);
        c.aim = Math.atan2(target.y - c.y, target.x - c.x);
        if (td < 28 && target.count < 3) { this.grab(c, target); return; }
        if (c.cd <= 0) {
          const vanClose = this.vans.some(v => !v.leaving && v.prisoners.length < VAN_CAP && hyp(v.x - c.x, v.y - c.y) < 300);
          let hits = 0, near = null;
          for (const e of this.ents) if (!e.dead && !e.held && e.kind === 'fol' && e.lead === target && hyp(e.x - c.x, e.y - c.y) < 40) { near = near || e; if (!vanClose || Math.random() < .5) { this.scatter(e, c.x, c.y, null); if (++hits >= 2) break; } }
          if (vanClose && near && near.kind === 'fol' && Math.random() < .25) { this.grab(c, near); c.cd = 1.5; return; }
          if (hits) { c.cd = 1.5; c.swing = .25; this.ev({ k: 'sfx', n: 'lathi', x: c.x, y: c.y }); if (Math.random() < .35) this.txt(c.x, c.y - 30, 'धड़ाम!', '#ffe1a8', 13); }
          else c.cd = .3;
        }
      } else if (c.task && !owner) {
        if (this.t > c.task.until || !c.task.bar.broken) c.task = null;
        else { const d = hyp(c.task.x - c.x, c.task.y - c.y); if (d > 150) this.navTo(c, c.task.x, c.task.y, 130, dt); else if (d > 10) this.moveTo(c, c.task.x, c.task.y, 130, dt); }
      } else if (owner) {
        const tx = owner.x + c.ox * 2.5, ty = owner.y + c.oy * 2.5, d = hyp(tx - c.x, ty - c.y);
        if (d > 160) this.navTo(c, tx, ty, 200, dt); else if (d > 18) { this.moveTo(c, tx, ty, d > 70 ? 190 : 150, dt); c.aim = owner.aim; }
      } else {
        const d = hyp(c.post.x - c.x, c.post.y - c.y);
        if (d > 160) this.navTo(c, c.post.x, c.post.y, 110, dt);
        else if (d > 14) { this.moveTo(c, c.post.x, c.post.y, 110, dt); c.aim = Math.atan2(c.post.y - c.y, c.post.x - c.x); }
        else if (c.roam) {
          c.wander -= dt;
          if (c.wander <= 0) {
            c.wander = rnd(5, 9);
            const n = MAP.nearestNode(c.home.x, c.home.y), nb = MAP.adj[n] || [];
            if (Math.random() < .5 && nb.length) { const m = MAP.nodes[nb[(Math.random() * nb.length) | 0][0]]; const mid = { x: (c.home.x + m.x) / 2, y: (c.home.y + m.y) / 2 }; c.post = MAP.isWalk(mid.x, mid.y) ? mid : { x: c.home.x, y: c.home.y }; }
            else c.post = { x: c.home.x, y: c.home.y };
          }
        }
      }
    }
    updateVans(dt) {
      for (const v of this.vans) {
        // stopping for a policeman who is bringing someone in
        if (v.stopT > 0) { v.stopT -= dt; if (v.stopT <= 0) { v.stopT = 0; v.cool = 6; } }
        else {
          v.cool = Math.max(0, v.cool - dt);
          if (!v.leaving && !v.flipped && v.cool <= 0) for (const c of this.ents) if (!c.dead && c.kind === 'cop' && c.drag && hyp(c.x - v.x, c.y - v.y) < 260) {
            v.stopT = VAN_STOP; this.txt(v.x, v.y - 44, 'वैन रुकी · 10s', '#cfe3ff', 15); this.ev({ k: 'sfx', n: 'arrest', x: v.x, y: v.y });
            if (c.human) this.ev({ k: 'toast', to: c.human, m: 'The van stopped: get your prisoner to it within 10 seconds and press DRAG' });
            break;
          }
        }
        // 5 andolankari at the van unlock it and free one prisoner
        if (v.prisoners.length) {
          const [L, n] = this.kafilaNear(v.x, v.y, 62);
          if (n >= GROUP_RESCUE) {
            let k = 1; if (L.human) { const h = this.humans.get(L.human); if (h && h.rescueT > 0) k = 2; }
            v.unlock += dt * k / 2.5;
            if (v.unlock >= 1) {
              v.unlock = 0; const rec = v.prisoners.shift();
              this.release(rec, v.x + rnd(-16, 16), v.y + rnd(-16, 16), L); this.arrests = Math.max(0, this.arrests - 1);
              this.txt(v.x, v.y - 46, 'ताला टूटा! आज़ाद!', '#c8ffb0', 17); this.ev({ k: 'sfx', n: 'break', x: v.x, y: v.y });
              if (v.leaving && v.prisoners.length < VAN_CAP) { v.leaving = false; v.route = null; }
            }
          } else v.unlock = Math.max(0, v.unlock - dt * .3);
        } else v.unlock = 0;
        // 10 andolankari around a van tip it over: every prisoner walks free
        if (v.flipped > 0) { v.flipped -= dt; if (v.flipped <= 0) { const n = MAP.nodes.S2; Object.assign(v, { x: n.x, y: n.y, from: 'S2', to: 'S2', prev: null, flipped: 0, tip: 0, stopT: 0, cool: 4, prisoners: [], unlock: 0, leaving: false, route: null }); } continue; }
        let crowd = 0;
        {
          const [L, n] = this.kafilaNear(v.x, v.y, 72); crowd = n;
          if (n >= GROUP_FLIP) {
            v.tip = (v.tip || 0) + dt;
            if (v.tip > 2) {
              v.flipped = 25; v.tip = 0; v.stopT = 0; v.unlock = 0;
              for (const rec of v.prisoners) this.release(rec, v.x + rnd(-20, 20), v.y + rnd(-20, 20), L);
              this.arrests = Math.max(0, this.arrests - v.prisoners.length); v.prisoners = [];
              this.txt(v.x, v.y - 46, 'वैन पलट दी!', '#ffb48a', 18); this.ev({ k: 'sfx', n: 'break', x: v.x, y: v.y });
              this.ev({ k: 'toast', m: 'A crowd tipped over a police van!' });
              if (L && L.human) { const h = this.humans.get(L.human); if (h) h.round.score += 25; }
              continue;
            }
          } else v.tip = Math.max(0, (v.tip || 0) - dt);
        }
        if (v.stopT > 0 || crowd >= GROUP_RESCUE) continue; // a crowd around the van blocks it
        // driving along the roads
        const tn = MAP.nodes[v.to], d = hyp(tn.x - v.x, tn.y - v.y);
        if (d < 4) {
          if (v.leaving && v.to === 'S2') { v.wait += dt; if (v.wait > 3) { v.prisoners = []; v.leaving = false; v.wait = 0; v.route = null; v.cool = 4; } continue; }
          v.prev = v.from; v.from = v.to;
          if (v.leaving) {
            if (!v.route || !v.route.length) v.route = MAP.path(v.x, v.y, 'S2').map(q => q.id).slice(1);
            v.to = v.route.length ? v.route.shift() : 'S2';
          } else {
            const nb = (MAP.adj[v.from] || []).map(a => a[0]).filter(id => id !== v.prev && hyp(MAP.nodes[id].x - MAP.JM.x, MAP.nodes[id].y - MAP.JM.y) < 1150 * MAP.M);
            v.to = nb.length ? nb[(Math.random() * nb.length) | 0] : (v.prev || v.from);
          }
        } else {
          const st = Math.min(d, VAN_SPEED * dt);
          v.ang = Math.atan2(tn.y - v.y, tn.x - v.x);
          v.x += (tn.x - v.x) / d * st; v.y += (tn.y - v.y) / d * st;
        }
      }
    }
    separate(dt) {
      const grid = new Map(), ents = this.ents;
      for (const e of ents) { if (e.dead || e.held) continue; e.px = e.x; e.py = e.y; const k = ((e.x / 24) | 0) + ((e.y / 24) | 0) * 4096; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(e); }
      for (const e of ents) {
        if (e.dead) continue;
        const gx = (e.x / 24) | 0, gy = (e.y / 24) | 0;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const c = grid.get(gx + ox + (gy + oy) * 4096); if (!c) continue;
          for (const o of c) {
            if (o.id <= e.id || o.dead || o.held || e.held) continue;
            const dx = o.x - e.x, dy = o.y - e.y, rr = e.r + o.r, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            if ((e.kind === 'civ') !== (o.kind === 'civ')) {
              const cv = e.kind === 'civ' ? e : o, k = cv === e ? o : e;
              if (cv.immune <= 0 && cv.flee <= 0) {
                if (k.kind === 'lead') this.join(cv, k);
                else if (k.kind === 'fol' && k.lead && Math.random() < dt * 1.6) this.join(cv, k.lead);
              }
            }
            const d = Math.sqrt(d2) || .01, p = rr - d, tm = e.m + o.m, nx = dx / d, ny = dy / d;
            e.x -= nx * p * (o.m / tm); e.y -= ny * p * (o.m / tm); o.x += nx * p * (e.m / tm); o.y += ny * p * (e.m / tm);
          }
        }
      }
      for (const e of ents) if (!e.dead && (e.x !== e.px || e.y !== e.py) && this.blocked(e, e.x, e.y)) {
        if (!this.blocked(e, e.x, e.py)) e.y = e.py; else if (!this.blocked(e, e.px, e.y)) e.x = e.px; else { e.x = e.px; e.y = e.py; }
      }
    }
    end(w, by) {
      if (this.state !== 'play') return;
      this.state = 'inter'; this.inter = this.interLen; this.winner = w; this.winBy = by;
      for (const h of this.humans.values()) { if (h.team === w) h.round.score += 50; h.score += Math.round(h.round.score); }
      this.ev({ k: 'end', w, by });
      this.ev({ k: 'sfx', n: w === 'P' ? 'winP' : 'winC' });
    }
    dzPath(L) {
      const a = Math.random() * 6.28, r = Math.random() * MAP.DZ.r * .5;
      return MAP.gridPath(L.x, L.y, MAP.DZ.x + Math.cos(a) * r, MAP.DZ.y + Math.sin(a) * r) || [{ x: MAP.DZ.x, y: MAP.DZ.y }];
    }
    timeLeft() { return Math.max(0, this.roundLen - this.t); }
    board() {
      return [...this.humans.values()].map(h => [h.name, Math.round(h.round.score), h.team, h.pid]).sort((a, b) => b[1] - a[1]);
    }
  }

  const API = { World, AI_NAMES, NCOL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else G.DCSIM = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
