/* Dharna Chowk Chalo — cartoon map of central New Delhi around Jantar Mantar.
   Geometry is a simplified, hand-placed approximation (metres east/north of Jantar Mantar),
   good for a game, not for navigation. Shared by the browser client and the Node server. */
(function (G) {
  'use strict';
  const M = 1.5;            // world units per metre
  const OFF = 1300;         // map covers -1300..+1300 m around Jantar Mantar
  const SIZE = 2600 * M;    // 3900 world units
  const U = (e, n) => ({ x: (e + OFF) * M, y: (OFF - n) * M });
  const CP = { e: 205, n: 490 };

  const nodes = {};
  const N = (id, e, n) => { nodes[id] = U(e, n); nodes[id].id = id; };
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    N('I' + k, CP.e + 170 * Math.cos(a), CP.n + 170 * Math.sin(a));
    N('O' + k, CP.e + 330 * Math.cos(a), CP.n + 330 * Math.sin(a));
  }
  N('JW', -55, 60); N('JR1', 60, 40); N('DZ', 125, -12); N('JR2', 170, -50); N('JE', 285, -170);
  N('S2', -110, -150); N('PC', -225, -455); N('S3', -520, -850); N('PARL', -760, -1150); N('PARLS', -760, -1300);
  N('JP1', 300, 0); N('JT', 280, -260); N('WP', 380, -880); N('JS', 440, -1300);
  N('TM1', 560, -150); N('TM2', 900, 0); N('TME', 1300, 150);
  N('KG2', 610, -700); N('KGS', 650, -1300);
  N('HM', -185, 250); N('BS', -700, -40); N('GDK', -1050, -250); N('BKW', -1300, -350);
  N('RM', -640, -352); N('ASE', 1100, -1300);
  N('BKE', 1300, 950); N('MN', 230, 1300); N('PK', -1300, 1000); N('BV1', -600, 450); N('BVW', -1300, 420);

  const ring = (p, n) => { const a = []; for (let k = 0; k < 12; k++) a.push(p + k); a.push(p + '0'); return a; };
  const ROADS = [
    { n: 'Sansad Marg', w: 34, p: ['O8', 'JW', 'S2', 'PC', 'S3', 'PARL', 'PARLS'] },
    { n: 'Jantar Mantar Road', w: 24, p: ['JW', 'JR1', 'DZ', 'JR2', 'JE'] },
    { n: 'Janpath', w: 30, p: ['O10', 'JP1', 'JE', 'JT', 'WP', 'JS'] },
    { n: 'Tolstoy Marg', w: 24, p: ['JT', 'TM1', 'TM2', 'TME'] },
    { n: 'Kasturba Gandhi Marg', w: 28, p: ['O11', 'TM1', 'KG2', 'KGS'] },
    { n: 'Baba Kharak Singh Marg', w: 28, p: ['O7', 'HM', 'BS', 'GDK', 'BKW'] },
    { n: 'Ashoka Road', w: 30, p: ['GDK', 'RM', 'PC', 'WP', 'ASE'] },
    { n: 'Rafi Marg', w: 26, p: ['PARL', 'RM', 'BS'] },
    { n: 'Barakhamba Road', w: 26, p: ['O1', 'BKE'] },
    { n: 'Minto Road', w: 24, p: ['O3', 'MN'] },
    { n: 'Panchkuian Road', w: 26, p: ['O5', 'PK'] },
    { n: 'Bhai Vir Singh Marg', w: 24, p: ['O6', 'BV1', 'BVW'] },
    { n: 'Ferozshah Road', w: 22, p: ['WP', 'KG2'] },
    { n: 'Connaught Circus', w: 26, p: ring('O'), ring: { e: CP.e, n: CP.n, r: 330 } },
    { n: 'Connaught Place', w: 22, p: ring('I'), ring: { e: CP.e, n: CP.n, r: 170 } }
  ];
  for (let k = 0; k < 12; k += 2) ROADS.push({ n: '', w: 16, p: ['I' + k, 'O' + k], radial: true });

  const PLAZAS = [
    { id: 'cp', e: CP.e, n: CP.n, r: 152, kind: 'park' },
    { id: 'dz', e: 125, n: -12, r: 55, kind: 'dharna' },
    { id: 'pc', e: -225, n: -455, r: 44, kind: 'round' },
    { id: 'wp', e: 380, n: -880, r: 44, kind: 'round' },
    { id: 'gdk', e: -1050, n: -250, r: 44, kind: 'round' },
    { id: 'parl', e: -760, n: -1150, r: 56, kind: 'round' },
    { id: 'tm1', e: 560, n: -150, r: 34, kind: 'round' },
    { id: 'jt', e: 280, n: -260, r: 30, kind: 'round' }
  ];

  const LANDMARKS = [
    { k: 'jantar', e: 0, n: -65, label: 'Jantar Mantar' },
    { k: 'gurudwara', e: -760, n: 45, label: 'Gurudwara Bangla Sahib' },
    { k: 'hanuman', e: -235, n: 300, label: 'Hanuman Mandir' },
    { k: 'palika', e: CP.e, n: CP.n, label: 'Rajiv Chowk · Palika Bazaar' },
    { k: 'metro', e: -275, n: -415, label: 'Patel Chowk' },
    { k: 'metro', e: 330, n: -290, label: 'Janpath' },
    { k: 'metro', e: 115, n: 455, label: 'Rajiv Chowk' },
    { k: 'parliament', e: -985, n: -1110, label: 'Sansad Bhavan' },
    { k: 'thana', e: -185, n: -160, label: 'Parliament St. Thana' },
    { k: 'rbi', e: -95, n: 175, label: 'RBI' },
    { k: 'hotel', e: 375, n: -110, label: 'Imperial Hotel' },
    { k: 'baoli', e: 820, n: -95, label: 'Agrasen ki Baoli' },
    { k: 'akashvani', e: -360, n: -650, label: 'Akashvani Bhawan' },
    { k: 'stadium', e: -330, n: 560, label: 'Shivaji Stadium' },
    { k: 'statue', e: -225, n: -455, label: '' },
    { k: 'statue', e: 380, n: -880, label: 'Windsor Place' },
    { k: 'statue', e: -1050, n: -250, label: 'Gol Dak Khana' },
    { k: 'statue', e: -760, n: -1150, label: '' }
  ];

  // Police barricades: on a road segment between two nodes at fraction t.
  const BARDEFS = [
    { a: 'JW', b: 'JR1', t: .42, key: true, name: 'JM Road (west)' },
    { a: 'JR2', b: 'JE', t: .55, key: true, name: 'JM Road (east)' },
    { a: 'O8', b: 'JW', t: .5, name: 'Sansad Marg (CP side)' },
    { a: 'JW', b: 'S2', t: .45, name: 'Sansad Marg (thana)' },
    { a: 'JP1', b: 'JE', t: .45, name: 'Janpath (north)' },
    { a: 'JE', b: 'JT', t: .55, name: 'Janpath (south)' },
    { a: 'S2', b: 'PC', t: .62, name: 'Patel Chowk' },
    { a: 'JT', b: 'TM1', t: .25, name: 'Tolstoy Marg' }
  ];
  const roadOf = (a, b) => ROADS.find(r => { const i = r.p.indexOf(a); return i >= 0 && (r.p[i + 1] === b || r.p[i - 1] === b); });
  const BARS = BARDEFS.map((d, i) => {
    const A = nodes[d.a], B = nodes[d.b], r = roadOf(d.a, d.b);
    const cx = A.x + (B.x - A.x) * d.t, cy = A.y + (B.y - A.y) * d.t;
    const L = Math.hypot(B.x - A.x, B.y - A.y), dx = (B.x - A.x) / L, dy = (B.y - A.y) / L;
    const half = (r ? r.w : 26) * M / 2 + 6;
    return { i, key: !!d.key, name: d.name, x: cx, y: cy, ang: Math.atan2(dy, dx) + Math.PI / 2,
      x1: cx - dy * half, y1: cy + dx * half, x2: cx + dy * half, y2: cy - dx * half, thick: 7, dirx: dx, diry: dy };
  });

  /* ---------- walkability grid ---------- */
  const CELL = 6, GW = Math.ceil(SIZE / CELL);
  const walk = new Uint8Array(GW * GW);
  function markSeg(A, B, hw) {
    const x0 = Math.max(0, Math.floor((Math.min(A.x, B.x) - hw) / CELL)), x1 = Math.min(GW - 1, Math.ceil((Math.max(A.x, B.x) + hw) / CELL));
    const y0 = Math.max(0, Math.floor((Math.min(A.y, B.y) - hw) / CELL)), y1 = Math.min(GW - 1, Math.ceil((Math.max(A.y, B.y) + hw) / CELL));
    const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1;
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const px = gx * CELL + CELL / 2, py = gy * CELL + CELL / 2;
      let t = ((px - A.x) * vx + (py - A.y) * vy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - (A.x + vx * t), dy = py - (A.y + vy * t);
      if (dx * dx + dy * dy <= hw * hw) walk[gy * GW + gx] = 1;
    }
  }
  function markDisc(c, r, r0) {
    const x0 = Math.max(0, Math.floor((c.x - r) / CELL)), x1 = Math.min(GW - 1, Math.ceil((c.x + r) / CELL));
    const y0 = Math.max(0, Math.floor((c.y - r) / CELL)), y1 = Math.min(GW - 1, Math.ceil((c.y + r) / CELL));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const d = Math.hypot(gx * CELL + CELL / 2 - c.x, gy * CELL + CELL / 2 - c.y);
      if (d <= r && d >= (r0 || 0)) walk[gy * GW + gx] = 1;
    }
  }
  for (const r of ROADS) {
    const hw = r.w * M / 2;
    if (r.ring) { const c = U(r.ring.e, r.ring.n); markDisc(c, r.ring.r * M + hw, r.ring.r * M - hw); continue; }
    for (let i = 0; i < r.p.length - 1; i++) markSeg(nodes[r.p[i]], nodes[r.p[i + 1]], hw);
    // short stub into the circles so radial roads connect cleanly
  }
  for (const p of PLAZAS) markDisc(U(p.e, p.n), p.r * M);
  // keep roundabout statues solid
  for (const l of LANDMARKS) if (l.k === 'statue') { const c = U(l.e, l.n); const r = 12 * M;
    const x0 = Math.floor((c.x - r) / CELL), x1 = Math.ceil((c.x + r) / CELL), y0 = Math.floor((c.y - r) / CELL), y1 = Math.ceil((c.y + r) / CELL);
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) if (Math.hypot(gx * CELL + 3 - c.x, gy * CELL + 3 - c.y) < r) walk[gy * GW + gx] = 0; }

  function isWalk(x, y) {
    if (x < 2 || y < 2 || x > SIZE - 2 || y > SIZE - 2) return false;
    return walk[((y / CELL) | 0) * GW + ((x / CELL) | 0)] === 1;
  }

  /* ---------- road graph ---------- */
  const adj = {};
  const link = (a, b) => { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y); (adj[a] = adj[a] || []).push([b, d]); (adj[b] = adj[b] || []).push([a, d]); };
  for (const r of ROADS) for (let i = 0; i < r.p.length - 1; i++) link(r.p[i], r.p[i + 1]);
  const NODE_IDS = Object.keys(adj);
  function nearestNode(x, y) { let best = null, bd = 1e18; for (const id of NODE_IDS) { const n = nodes[id], d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = id; } } return best; }
  function path(x, y, goal, noise) {
    const start = nearestNode(x, y), dist = {}, prev = {}, done = new Set();
    for (const id of NODE_IDS) dist[id] = Infinity;
    dist[start] = 0;
    while (true) {
      let u = null, ud = Infinity;
      for (const id of NODE_IDS) if (!done.has(id) && dist[id] < ud) { ud = dist[id]; u = id; }
      if (!u || u === goal) break;
      done.add(u);
      for (const [v, w] of adj[u]) { const nd = ud + w * (1 + (noise ? Math.random() * noise : 0)); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } }
    }
    const out = []; let c = goal;
    while (c && c !== start) { out.unshift({ x: nodes[c].x, y: nodes[c].y, id: c }); c = prev[c]; }
    out.unshift({ x: nodes[start].x, y: nodes[start].y, id: start });
    return out;
  }

  function nearestWalk(x, y) {
    if (isWalk(x, y)) return { x, y };
    const c = snapCell(x, y);
    if (c >= 0) return { x: (c % GW) * CELL + CELL / 2, y: ((c / GW) | 0) * CELL + CELL / 2 };
    for (let r = 12; r < 400; r += 6) for (let a = 0; a < 6.28; a += .2) { const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (isWalk(px, py)) return { x: px, y: py }; }
    return { x, y };
  }

  /* ---------- grid pathfinding (BFS, 8-way) ---------- */
  const prevArr = new Int32Array(GW * GW), seenArr = new Uint32Array(GW * GW); let stamp = 0;
  const queue = new Int32Array(GW * GW);
  function snapCell(x, y) {
    let cx = clamp((x / CELL) | 0, 0, GW - 1), cy = clamp((y / CELL) | 0, 0, GW - 1);
    if (walk[cy * GW + cx]) return cy * GW + cx;
    for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GW) continue;
      if (walk[ny * GW + nx]) return ny * GW + nx;
    }
    return -1;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function gridPath(x0, y0, x1, y1, maxExp) {
    const s = snapCell(x0, y0), g = snapCell(x1, y1);
    if (s < 0 || g < 0) return null;
    stamp++; if (stamp > 4e9) { seenArr.fill(0); stamp = 1; }
    let qh = 0, qt = 0; queue[qt++] = s; seenArr[s] = stamp; prevArr[s] = -1;
    let found = false, exp = 0; const lim = maxExp || 60000;
    while (qh < qt && exp < lim) {
      const c = queue[qh++]; exp++;
      if (c === g) { found = true; break; }
      const cx = c % GW, cy = (c / GW) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GW) continue;
        const n = ny * GW + nx;
        if (seenArr[n] === stamp || !walk[n]) continue;
        if (d >= 4 && (!walk[cy * GW + nx] || !walk[ny * GW + cx])) continue;
        seenArr[n] = stamp; prevArr[n] = c; queue[qt++] = n;
      }
    }
    if (!found) return null;
    const cells = []; let c = g; while (c !== -1) { cells.push(c); c = prevArr[c]; }
    cells.reverse();
    const out = [];
    for (let i = 4; i < cells.length; i += 5) out.push({ x: (cells[i] % GW) * CELL + CELL / 2, y: ((cells[i] / GW) | 0) * CELL + CELL / 2 });
    out.push({ x: (g % GW) * CELL + CELL / 2, y: ((g / GW) | 0) * CELL + CELL / 2 });
    return out;
  }

  /* ---------- spawn spots ---------- */
  const JM = U(0, 0), DZ = Object.assign(U(125, -12), { r: 55 * M });
  const SPAWNS = [], CIVSPOTS = [];
  for (const r of ROADS) {
    if (r.ring) { const c = U(r.ring.e, r.ring.n); for (let a = 0; a < Math.PI * 2; a += .05) { const p = { x: c.x + Math.cos(a) * r.ring.r * M, y: c.y + Math.sin(a) * r.ring.r * M }; addSpot(p); } continue; }
    for (let i = 0; i < r.p.length - 1; i++) {
      const A = nodes[r.p[i]], B = nodes[r.p[i + 1]], L = Math.hypot(B.x - A.x, B.y - A.y);
      for (let s = 0; s < L; s += 22) { const t = s / L; addSpot({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }); }
    }
  }
  function addSpot(p) {
    if (!isWalk(p.x, p.y)) return;
    const dm = Math.hypot(p.x - JM.x, p.y - JM.y) / M;
    const dz = Math.hypot(p.x - DZ.x, p.y - DZ.y) / M;
    if (dm >= 480 && dm <= 1000) SPAWNS.push(p);
    if (dm <= 1150 && dz > 140) CIVSPOTS.push(p);
  }

  const MAP = { M, OFF, SIZE, U, CP, nodes, ROADS, PLAZAS, LANDMARKS, BARS, CELL, GW, walk, isWalk, nearestWalk, adj, path, gridPath, nearestNode, JM, DZ, SPAWNS, CIVSPOTS,
    BUS: U(-150, -95), THANA: U(-185, -160) };
  if (typeof module !== 'undefined' && module.exports) module.exports = MAP; else G.DCMAP = MAP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
