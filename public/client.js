/* Dharna Chowk Chalo — browser client: rendering, input, offline practice and online play. */
(() => {
  'use strict';
  const MAP = window.DCMAP, SIM = window.DCSIM;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false });
  const mini = $('mini'), mctx = mini.getContext('2d');
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hyp = Math.hypot, M = MAP.M;
  const KCOL = ['#8a8a8a', '#0f8a7e', '#7b45b8', '#d0306b', '#2f63c4', '#e07a12', '#5b8f1f', '#9c2fd0', '#b8322a', '#127ca8', '#b38600', '#c2417f'];
  const SLOG_COL = '#fff2c9';

  /* ---------- settings ---------- */
  const store = { get(k, d) { try { const v = localStorage.getItem('dcc_' + k); return v === null ? d : v; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('dcc_' + k, v); } catch (_) { } } };
  const S = { mode: null, team: 'P', name: store.get('name', ''), hq: store.get('hq', '1') === '1', muted: store.get('muted', '0') === '1',
    touch: matchMedia('(pointer: coarse)').matches, zoom: 1, dpr: 1, vw: 0, vh: 0, camX: MAP.DZ.x, camY: MAP.DZ.y, frameAvg: 16, lowT: 0 };
  document.body.classList.toggle('touch', S.touch);

  /* ---------- seeded random for map decor ---------- */
  let seed = 20240607; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sr = (a, b) => a + srnd() * (b - a);

  /* ================= BACKGROUND MAP ================= */
  const BGS = (S.touch ? .45 : .55);
  let bg = null;
  const landmarkZone = (x, y) => {
    const R = { jantar: 115, gurudwara: 120, hanuman: 40, metro: 0, parliament: 150, thana: 48, rbi: 55, hotel: 55, baoli: 45, akashvani: 60, stadium: 80, statue: 0, palika: 0 };
    for (const l of MAP.LANDMARKS) { const r = R[l.k] || 0; if (!r) continue; const p = MAP.U(l.e, l.n); if (hyp(x - p.x, y - p.y) < r * M) return true; }
    return false;
  };
  const CPc = MAP.U(MAP.CP.e, MAP.CP.n);
  const cpDist = (x, y) => hyp(x - CPc.x, y - CPc.y) / M;
  function freeArea(x, y, w, h) {
    for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) if (MAP.isWalk(x + w * i / 3, y + h * j / 3)) return false;
    return true;
  }
  function buildBG() {
    const SZ = MAP.SIZE, c = document.createElement('canvas');
    c.width = c.height = Math.ceil(SZ * BGS);
    const g = c.getContext('2d');
    g.scale(BGS, BGS);
    seed = 20240607;
    // lawns
    g.fillStyle = '#a7c47a'; g.fillRect(0, 0, SZ, SZ);
    for (let k = 0; k < 1400; k++) { g.fillStyle = srnd() < .5 ? 'rgba(80,120,50,.10)' : 'rgba(220,235,170,.12)'; g.beginPath(); g.arc(sr(0, SZ), sr(0, SZ), sr(20, 90), 0, 7); g.fill(); }
    // 1 km circle
    g.strokeStyle = 'rgba(181,83,44,.55)'; g.lineWidth = 6; g.setLineDash([30, 22]);
    g.beginPath(); g.arc(MAP.JM.x, MAP.JM.y, 1000 * M, 0, 7); g.stroke(); g.setLineDash([]);
    // plots: bungalows & offices
    const step = 66;
    for (let y = 0; y < SZ; y += step) for (let x = 0; x < SZ; x += step) {
      const w = sr(44, 62), h = sr(40, 58), px = x + sr(0, step - w), py = y + sr(0, step - h);
      const cx = px + w / 2, cy = py + h / 2, cd = cpDist(cx, cy);
      if (cd > 176 && cd < 322) continue;
      if (!freeArea(px - 8, py - 8, w + 16, h + 16) || landmarkZone(cx, cy)) { if (srnd() < .5 && !MAP.isWalk(cx, cy) && !landmarkZone(cx, cy) && !(cd > 176 && cd < 322)) tree(g, cx, cy, sr(9, 13)); continue; }
      if (cd < 640 && srnd() < .85) office(g, px, py, w, h); else bungalow(g, px, py, w, h);
    }
    cpBlocks(g);
    roads(g);
    plazas(g);
    avenueTrees(g);
    landmarks(g);
    return c;
  }
  function tree(g, x, y, r) {
    g.fillStyle = 'rgba(30,45,20,.28)'; g.beginPath(); g.ellipse(x + r * .35, y + r * .45, r, r * .8, 0, 0, 7); g.fill();
    const cols = ['#3f7a35', '#4b8a3b', '#2f6b2e', '#5a9440'];
    g.fillStyle = cols[(srnd() * cols.length) | 0]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(190,230,140,.35)'; g.beginPath(); g.arc(x - r * .3, y - r * .35, r * .45, 0, 7); g.fill();
  }
  function bungalow(g, x, y, w, h) {
    g.fillStyle = '#b9d38c'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#5f8f3e'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    const hw = w * sr(.45, .6), hh = h * sr(.4, .55), hx = x + (w - hw) / 2 + sr(-4, 4), hy = y + (h - hh) / 2 + sr(-4, 4);
    g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(hx + 4, hy + 5, hw, hh);
    g.fillStyle = srnd() < .7 ? '#f3ecdc' : '#efe2c4'; g.fillRect(hx, hy, hw, hh);
    g.strokeStyle = '#cdbf9f'; g.lineWidth = 2; g.strokeRect(hx + 2, hy + 2, hw - 4, hh - 4);
    g.fillStyle = '#d9cfb8'; g.fillRect(hx + hw / 2 - 4, hy + hh, 8, y + h - hy - hh);
    g.fillStyle = '#4a4844'; g.beginPath(); g.arc(hx + hw - 7, hy + 7, 3.5, 0, 7); g.fill();
    for (let k = 0; k < 3; k++) tree(g, x + sr(6, w - 6), y + (srnd() < .5 ? sr(5, 10) : h - sr(5, 10)), sr(5, 8));
  }
  function office(g, x, y, w, h) {
    const cols = ['#e7dcc8', '#cfd8dc', '#d8c3a5', '#b8c7d6', '#e2cfb6', '#c9d2c3'];
    g.fillStyle = 'rgba(30,25,20,.3)'; g.fillRect(x + 7, y + 8, w, h);
    g.fillStyle = cols[(srnd() * cols.length) | 0]; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(70,60,50,.35)'; g.lineWidth = 2.5; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = 'rgba(80,110,140,.35)';
    for (let r = y + 8; r < y + h - 8; r += 9) for (let q = x + 7; q < x + w - 7; q += 9) g.fillRect(q, r, 4, 4);
    g.fillStyle = '#4a4844'; g.beginPath(); g.arc(x + w - 9, y + 9, 4, 0, 7); g.fill();
  }
  function cpBlocks(g) {
    const c = CPc, gap = .06;
    for (let k = 0; k < 12; k += 2) {
      const a1 = -(k + 2) * Math.PI / 6 + gap, a2 = -k * Math.PI / 6 - gap;
      for (const [r0, r1] of [[184, 240], [262, 316]]) {
        g.fillStyle = 'rgba(40,30,20,.25)'; g.beginPath(); g.arc(c.x + 5, c.y + 6, r1 * M, a1, a2); g.arc(c.x + 5, c.y + 6, r0 * M, a2, a1, true); g.closePath(); g.fill();
        g.fillStyle = '#f6f2e7'; g.beginPath(); g.arc(c.x, c.y, r1 * M, a1, a2); g.arc(c.x, c.y, r0 * M, a2, a1, true); g.closePath(); g.fill();
        g.strokeStyle = '#d6ccb6'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#e4dccb'; g.lineWidth = 5; g.beginPath(); g.arc(c.x, c.y, (r0 + r1) / 2 * M, a1 + .02, a2 - .02); g.stroke();
        // colonnade
        g.fillStyle = '#cfc5ae';
        for (let a = a1 + .01; a < a2; a += 5 / (r0 * M)) { g.beginPath(); g.arc(c.x + Math.cos(a) * (r0 * M + 4), c.y + Math.sin(a) * (r0 * M + 4), 1.8, 0, 7); g.fill(); }
        // shop awnings
        const aw = ['#c0392b', '#2471a3', '#d4ac0d', '#17a589', '#884ea0'];
        for (let a = a1 + .03; a < a2 - .03; a += 22 / (r1 * M)) { g.strokeStyle = aw[(srnd() * aw.length) | 0]; g.lineWidth = 4; g.beginPath(); g.arc(c.x, c.y, r1 * M - 3, a, a + 10 / (r1 * M)); g.stroke(); }
        for (let t = 0; t < 4; t++) { const a = sr(a1, a2), r = sr(r0 + 8, r1 - 8) * M; g.fillStyle = '#4a4844'; g.beginPath(); g.arc(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 4, 0, 7); g.fill(); }
      }
    }
  }
  function roadPath(g, r) {
    g.beginPath();
    if (r.ring) { const c = MAP.U(r.ring.e, r.ring.n); g.arc(c.x, c.y, r.ring.r * M, 0, Math.PI * 2); return; }
    r.p.forEach((id, i) => { const n = MAP.nodes[id]; i ? g.lineTo(n.x, n.y) : g.moveTo(n.x, n.y); });
  }
  function roads(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const r of MAP.ROADS) { g.strokeStyle = '#d6c9ad'; g.lineWidth = (r.w + 9) * M; roadPath(g, r); g.stroke(); }
    for (const r of MAP.ROADS) {
      g.strokeStyle = '#f0c23a'; g.lineWidth = (r.w + 2.5) * M; roadPath(g, r); g.stroke();
      g.strokeStyle = '#1f1f1f'; g.setLineDash([4 * M, 4 * M]); roadPath(g, r); g.stroke(); g.setLineDash([]);
    }
    for (const r of MAP.ROADS) { g.strokeStyle = '#5c5b58'; g.lineWidth = r.w * M; roadPath(g, r); g.stroke(); }
    for (const r of MAP.ROADS) {
      if (r.radial) continue;
      g.strokeStyle = 'rgba(244,241,232,.7)'; g.lineWidth = 1.6 * M; g.setLineDash([9 * M, 9 * M]); roadPath(g, r); g.stroke(); g.setLineDash([]);
      if (r.w >= 28 && !r.ring) { g.strokeStyle = 'rgba(244,241,232,.35)'; g.lineWidth = M; for (const off of [-r.w / 4, r.w / 4]) { g.save(); g.beginPath(); offsetPath(g, r, off * M); g.setLineDash([5 * M, 7 * M]); g.stroke(); g.restore(); } }
    }
    // zebra crossings at junctions
    g.fillStyle = 'rgba(245,242,232,.75)';
    for (const id in MAP.adj) {
      const nb = MAP.adj[id]; if (nb.length < 3 || id[0] === 'I' || id[0] === 'O') continue;
      const n = MAP.nodes[id];
      for (const [o] of nb) { const m = MAP.nodes[o], d = hyp(m.x - n.x, m.y - n.y), ux = (m.x - n.x) / d, uy = (m.y - n.y) / d, px = -uy, py = ux;
        const cx = n.x + ux * 30 * M, cy = n.y + uy * 30 * M;
        for (let s = -10; s <= 10; s += 3.2) { g.save(); g.translate(cx + px * s * M, cy + py * s * M); g.rotate(Math.atan2(uy, ux)); g.fillRect(-4 * M, -.8 * M, 8 * M, 1.6 * M); g.restore(); } }
    }
  }
  function offsetPath(g, r, off) {
    for (let i = 0; i < r.p.length; i++) {
      const a = MAP.nodes[r.p[Math.max(0, i - 1)]], b = MAP.nodes[r.p[Math.min(r.p.length - 1, i + 1)]], n = MAP.nodes[r.p[i]];
      const d = hyp(b.x - a.x, b.y - a.y) || 1, px = -(b.y - a.y) / d, py = (b.x - a.x) / d;
      i ? g.lineTo(n.x + px * off, n.y + py * off) : g.moveTo(n.x + px * off, n.y + py * off);
    }
  }
  function plazas(g) {
    for (const p of MAP.PLAZAS) {
      const c = MAP.U(p.e, p.n), r = p.r * M;
      if (p.kind === 'park') {
        g.fillStyle = '#8cbd5a'; g.beginPath(); g.arc(c.x, c.y, r, 0, 7); g.fill();
        g.strokeStyle = '#e8dcc0'; g.lineWidth = 6 * M;
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.beginPath(); g.moveTo(c.x + Math.cos(a) * 30 * M, c.y + Math.sin(a) * 30 * M); g.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); g.stroke(); }
        g.beginPath(); g.arc(c.x, c.y, r * .78, 0, 7); g.lineWidth = 4 * M; g.stroke();
        // Palika Bazaar mound + fountain
        g.fillStyle = '#7aae4c'; g.beginPath(); g.ellipse(c.x, c.y, 36 * M, 26 * M, 0, 0, 7); g.fill();
        g.strokeStyle = '#5f8f3a'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(c.x, c.y, 9 * M, 0, 7); g.fill();
        g.fillStyle = '#6fb2d6'; g.beginPath(); g.arc(c.x, c.y, 6 * M, 0, 7); g.fill();
        for (let k = 0; k < 24; k++) { const a = srnd() * 6.28, rr = sr(.82, .96) * r; tree(g, c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, sr(6, 9)); }
      } else if (p.kind === 'dharna') {
        g.fillStyle = '#e6d3ad'; g.beginPath(); g.arc(c.x, c.y, r, 0, 7); g.fill();
        g.strokeStyle = 'rgba(140,100,60,.25)'; g.lineWidth = 2;
        for (let rr = 12; rr < r; rr += 14) { g.beginPath(); g.arc(c.x, c.y, rr, 0, 7); g.stroke(); }
        // shamiana (tent) strips along the edge
        const cols = ['#d9534f', '#f0ad4e', '#ffffff', '#5bc0de'];
        for (let k = 0; k < 7; k++) { const a = Math.PI * .15 + k * .2; g.fillStyle = cols[k % 4]; g.globalAlpha = .7; g.fillRect(c.x + Math.cos(a) * (r - 14) - 5, c.y + Math.sin(a) * (r - 14) - 5, 10, 10); g.globalAlpha = 1; }
      } else {
        g.fillStyle = '#5c5b58'; g.beginPath(); g.arc(c.x, c.y, r, 0, 7); g.fill();
        g.fillStyle = '#f0c23a'; g.beginPath(); g.arc(c.x, c.y, 17 * M, 0, 7); g.fill();
        g.fillStyle = '#86b957'; g.beginPath(); g.arc(c.x, c.y, 15.5 * M, 0, 7); g.fill();
      }
    }
  }
  function avenueTrees(g) {
    for (const r of MAP.ROADS) {
      if (r.ring) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const A = MAP.nodes[r.p[i]], B = MAP.nodes[r.p[i + 1]], L = hyp(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
        for (let s = 12 * M; s < L - 12 * M; s += 17 * M) for (const side of [-1, 1]) {
          const off = (r.w / 2 + 8) * M * side, x = A.x + ux * s - uy * off, y = A.y + uy * s + ux * off;
          if (MAP.isWalk(x, y) || landmarkZone(x, y)) continue;
          const cd = cpDist(x, y); if (cd > 176 && cd < 322) continue;
          tree(g, x, y, sr(7, 10));
        }
      }
    }
    // trees around the outer circle
    for (let a = 0; a < 6.28; a += .045) { const r = (330 + 22) * M, x = CPc.x + Math.cos(a) * r, y = CPc.y + Math.sin(a) * r; if (!MAP.isWalk(x, y) && !landmarkZone(x, y)) tree(g, x, y, sr(7, 10)); }
  }
  function lmPos(k) { const l = MAP.LANDMARKS.find(l => l.k === k); return MAP.U(l.e, l.n); }
  function landmarks(g) {
    // Jantar Mantar observatory
    { const p = lmPos('jantar');
      g.fillStyle = '#c6d896'; g.fillRect(p.x - 48 * M, p.y - 72 * M, 104 * M, 160 * M);
      g.strokeStyle = '#9c6a4d'; g.lineWidth = 4; g.strokeRect(p.x - 48 * M, p.y - 72 * M, 104 * M, 160 * M);
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 4 * M; g.beginPath(); g.moveTo(p.x - 40 * M, p.y + 70 * M); g.lineTo(p.x + 45 * M, p.y - 60 * M); g.stroke();
      // Samrat Yantra: long ramp with quadrants
      const sx = p.x - 8 * M, sy = p.y - 10 * M;
      g.fillStyle = 'rgba(80,30,20,.3)'; g.fillRect(sx - 5 * M + 6, sy - 30 * M + 8, 10 * M, 62 * M);
      g.fillStyle = '#d9826b'; g.fillRect(sx - 5 * M, sy - 30 * M, 10 * M, 62 * M);
      g.strokeStyle = '#f2e6d5'; g.lineWidth = 1.5; for (let k = 0; k < 20; k++) { g.beginPath(); g.moveTo(sx - 5 * M, sy - 30 * M + k * 3.1 * M); g.lineTo(sx + 5 * M, sy - 30 * M + k * 3.1 * M); g.stroke(); }
      for (const s of [-1, 1]) { g.fillStyle = '#c96b52'; g.beginPath(); g.ellipse(sx + s * 13 * M, sy + 6 * M, 7 * M, 20 * M, 0, 0, 7); g.fill(); g.fillStyle = '#e9a48f'; g.beginPath(); g.ellipse(sx + s * 13 * M, sy + 6 * M, 4 * M, 16 * M, 0, 0, 7); g.fill(); }
      // Ram Yantra pair
      for (const [ox, oy] of [[26, -50], [26, -26]]) { const cx = p.x + ox * M, cy = p.y + oy * M; g.fillStyle = 'rgba(80,30,20,.3)'; g.beginPath(); g.arc(cx + 5, cy + 6, 11 * M, 0, 7); g.fill(); g.fillStyle = '#d9826b'; g.beginPath(); g.arc(cx, cy, 11 * M, 0, 7); g.fill(); g.fillStyle = '#f1d3c2'; g.beginPath(); g.arc(cx, cy, 7 * M, 0, 7); g.fill(); g.strokeStyle = '#c96b52'; g.lineWidth = 2; for (let a = 0; a < 6.28; a += .52) { g.beginPath(); g.moveTo(cx + Math.cos(a) * 7 * M, cy + Math.sin(a) * 7 * M); g.lineTo(cx + Math.cos(a) * 11 * M, cy + Math.sin(a) * 11 * M); g.stroke(); } g.fillStyle = '#c96b52'; g.beginPath(); g.arc(cx, cy, 2 * M, 0, 7); g.fill(); }
      // Jai Prakash bowls
      for (const [ox, oy] of [[-30, 30], [-30, 52]]) { const cx = p.x + ox * M, cy = p.y + oy * M; g.fillStyle = '#e7c3a8'; g.beginPath(); g.arc(cx, cy, 9 * M, 0, 7); g.fill(); g.strokeStyle = '#c96b52'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 6 * M, 0, 7); g.stroke(); g.beginPath(); g.moveTo(cx - 9 * M, cy); g.lineTo(cx + 9 * M, cy); g.moveTo(cx, cy - 9 * M); g.lineTo(cx, cy + 9 * M); g.stroke(); }
      // Misra Yantra
      { const cx = p.x + 30 * M, cy = p.y + 45 * M; g.fillStyle = '#d9826b'; g.beginPath(); g.moveTo(cx - 10 * M, cy + 6 * M); g.lineTo(cx + 10 * M, cy + 6 * M); g.lineTo(cx + 4 * M, cy - 10 * M); g.lineTo(cx - 4 * M, cy - 10 * M); g.closePath(); g.fill(); }
    }
    // Gurudwara Bangla Sahib
    { const p = lmPos('gurudwara');
      g.fillStyle = '#e9e4d6'; g.fillRect(p.x - 70 * M, p.y - 60 * M, 140 * M, 125 * M);
      g.fillStyle = '#7fb6d9'; g.fillRect(p.x - 45 * M, p.y + 5 * M, 90 * M, 45 * M); g.strokeStyle = '#ffffff'; g.lineWidth = 3 * M; g.strokeRect(p.x - 45 * M, p.y + 5 * M, 90 * M, 45 * M);
      g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(p.x - 26 * M + 6, p.y - 45 * M + 7, 52 * M, 36 * M);
      g.fillStyle = '#fbfaf5'; g.fillRect(p.x - 26 * M, p.y - 45 * M, 52 * M, 36 * M);
      for (const [ox, oy, r] of [[0, -27, 11], [-20, -40, 5], [20, -40, 5], [-20, -14, 5], [20, -14, 5]]) { g.fillStyle = '#d4a017'; g.beginPath(); g.arc(p.x + ox * M, p.y + oy * M, r * M, 0, 7); g.fill(); g.fillStyle = '#f7d774'; g.beginPath(); g.arc(p.x + (ox - r * .3) * M, p.y + (oy - r * .3) * M, r * .45 * M, 0, 7); g.fill(); }
      g.fillStyle = '#e07a12'; g.fillRect(p.x + 32 * M, p.y - 58 * M, 2 * M, 18 * M); g.beginPath(); g.moveTo(p.x + 34 * M, p.y - 58 * M); g.lineTo(p.x + 44 * M, p.y - 54 * M); g.lineTo(p.x + 34 * M, p.y - 50 * M); g.fill();
    }
    // Hanuman Mandir
    { const p = lmPos('hanuman'); g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(p.x - 16 * M + 5, p.y - 16 * M + 6, 32 * M, 32 * M); g.fillStyle = '#f3b24a'; g.fillRect(p.x - 16 * M, p.y - 16 * M, 32 * M, 32 * M); g.fillStyle = '#d9541e'; g.beginPath(); g.moveTo(p.x - 10 * M, p.y + 8 * M); g.lineTo(p.x, p.y - 16 * M); g.lineTo(p.x + 10 * M, p.y + 8 * M); g.closePath(); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(p.x, p.y - 16 * M); g.lineTo(p.x + 9 * M, p.y - 13 * M); g.lineTo(p.x, p.y - 10 * M); g.fill(); }
    // Parliament
    { const p = lmPos('parliament'), r = 120 * M;
      g.fillStyle = 'rgba(40,30,20,.3)'; g.beginPath(); g.arc(p.x + 8, p.y + 10, r, 0, 7); g.fill();
      g.fillStyle = '#c98f6b'; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
      g.fillStyle = '#efe2c4'; g.beginPath(); g.arc(p.x, p.y, r - 7 * M, 0, 7); g.fill();
      g.fillStyle = '#d9c7a1'; for (let a = 0; a < 6.28; a += .045) { g.beginPath(); g.arc(p.x + Math.cos(a) * (r - 4 * M), p.y + Math.sin(a) * (r - 4 * M), 1.2 * M, 0, 7); g.fill(); }
      g.fillStyle = '#9fc77a'; g.beginPath(); g.arc(p.x, p.y, r - 40 * M, 0, 7); g.fill();
      g.fillStyle = '#efe2c4'; for (const a of [0, 2.09, 4.19]) { g.save(); g.translate(p.x, p.y); g.rotate(a); g.fillRect(-6 * M, -(r - 8 * M), 12 * M, r - 26 * M); g.restore(); }
      g.fillStyle = '#e8d6ad'; g.beginPath(); g.arc(p.x, p.y, 22 * M, 0, 7); g.fill(); g.strokeStyle = '#c98f6b'; g.lineWidth = 3; g.stroke();
    }
    // Thana
    { const p = lmPos('thana'); g.fillStyle = 'rgba(40,30,20,.3)'; g.fillRect(p.x - 34 * M + 6, p.y - 24 * M + 7, 68 * M, 48 * M); g.fillStyle = '#e4d3b0'; g.fillRect(p.x - 34 * M, p.y - 24 * M, 68 * M, 48 * M); g.fillStyle = '#c0392b'; g.fillRect(p.x - 34 * M, p.y - 24 * M, 68 * M, 5 * M); g.fillStyle = '#21407a'; g.fillRect(p.x - 18 * M, p.y - 6 * M, 36 * M, 10 * M); g.fillStyle = '#fff'; g.font = `700 ${7 * M}px Hind, sans-serif`; g.textAlign = 'center'; g.fillText('POLICE', p.x, p.y + 2.5 * M); }
    // RBI tower
    { const p = lmPos('rbi'); g.fillStyle = 'rgba(30,25,20,.35)'; g.fillRect(p.x - 22 * M + 12, p.y - 30 * M + 14, 44 * M, 60 * M); g.fillStyle = '#efe6d2'; g.fillRect(p.x - 22 * M, p.y - 30 * M, 44 * M, 60 * M); g.strokeStyle = '#b7a989'; g.lineWidth = 3; g.strokeRect(p.x - 22 * M, p.y - 30 * M, 44 * M, 60 * M); g.fillStyle = 'rgba(80,110,140,.35)'; for (let r = 0; r < 9; r++) g.fillRect(p.x - 18 * M, p.y - 26 * M + r * 6 * M, 36 * M, 2 * M); }
    // Imperial Hotel
    { const p = lmPos('hotel'); g.fillStyle = 'rgba(30,25,20,.3)'; g.fillRect(p.x - 26 * M + 6, p.y - 30 * M + 7, 52 * M, 60 * M); g.fillStyle = '#fbf8f0'; g.fillRect(p.x - 26 * M, p.y - 30 * M, 52 * M, 60 * M); g.strokeStyle = '#c9bea4'; g.lineWidth = 3; g.strokeRect(p.x - 26 * M, p.y - 30 * M, 52 * M, 60 * M); g.fillStyle = '#9cc46e'; g.fillRect(p.x - 18 * M, p.y - 8 * M, 36 * M, 18 * M); }
    // Agrasen ki Baoli
    { const p = lmPos('baoli'); for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#b98a64' : '#c99a72'; const w = (16 - k * 2.2) * M, h = (40 - k * 5) * M; g.fillRect(p.x - w / 2, p.y - h / 2, w, h); } g.fillStyle = '#4f7d8a'; g.fillRect(p.x - 2.5 * M, p.y - 4 * M, 5 * M, 8 * M); }
    // Akashvani
    { const p = lmPos('akashvani'); g.fillStyle = 'rgba(30,25,20,.3)'; g.fillRect(p.x - 36 * M + 7, p.y - 22 * M + 8, 72 * M, 44 * M); g.fillStyle = '#d9c3a0'; g.fillRect(p.x - 36 * M, p.y - 22 * M, 72 * M, 44 * M); g.strokeStyle = '#8f7a58'; g.lineWidth = 3; g.strokeRect(p.x - 36 * M, p.y - 22 * M, 72 * M, 44 * M); g.strokeStyle = '#c0392b'; g.lineWidth = 2 * M; g.beginPath(); g.moveTo(p.x + 22 * M, p.y - 14 * M); g.lineTo(p.x + 22 * M, p.y - 50 * M); g.stroke(); }
    // Shivaji Stadium
    { const p = lmPos('stadium'); g.fillStyle = '#c96b52'; g.beginPath(); g.ellipse(p.x, p.y, 60 * M, 42 * M, 0, 0, 7); g.fill(); g.fillStyle = '#7fb24f'; g.beginPath(); g.ellipse(p.x, p.y, 48 * M, 31 * M, 0, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(p.x - 30 * M, p.y - 18 * M, 60 * M, 36 * M); }
    // statues in roundabouts
    for (const l of MAP.LANDMARKS) if (l.k === 'statue') { const p = MAP.U(l.e, l.n); g.fillStyle = '#cfc6b3'; g.beginPath(); g.arc(p.x, p.y, 6 * M, 0, 7); g.fill(); g.fillStyle = '#5f6670'; g.beginPath(); g.arc(p.x, p.y - 2, 3 * M, 0, 7); g.fill(); }
    // metro markers
    for (const l of MAP.LANDMARKS) if (l.k === 'metro') { const p = MAP.U(l.e, l.n); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 9 * M, 0, 7); g.fill(); g.fillStyle = '#c62f3a'; g.beginPath(); g.arc(p.x, p.y, 7.5 * M, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `800 ${10 * M}px Hind, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', p.x, p.y + M); g.textBaseline = 'alphabetic'; }
  }

  /* minimap base */
  let miniBase = null;
  function buildMini() {
    const w = mini.width, h = mini.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), sc = Math.min(w, h) / MAP.SIZE;
    g.fillStyle = '#2a3322'; g.fillRect(0, 0, w, h);
    g.save(); g.translate((w - MAP.SIZE * sc) / 2, (h - MAP.SIZE * sc) / 2); g.scale(sc, sc);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of MAP.ROADS) { g.strokeStyle = r.n === 'Jantar Mantar Road' ? '#f0c23a' : 'rgba(230,220,195,.8)'; g.lineWidth = Math.max(r.w * M, 26 / sc / 40); roadPath(g, r); g.stroke(); }
    g.strokeStyle = 'rgba(240,120,80,.8)'; g.lineWidth = 2 / sc; g.setLineDash([6 / sc, 5 / sc]); g.beginPath(); g.arc(MAP.JM.x, MAP.JM.y, 1000 * M, 0, 7); g.stroke(); g.setLineDash([]);
    g.restore();
    miniBase = { c, sc, ox: (w - MAP.SIZE * sc) / 2, oy: (h - MAP.SIZE * sc) / 2 };
  }

  /* ================= PEOPLE SPRITES ================= */
  const SS = 2, SPR_W = 30, SPR_H = 52, AX = 15, AY = 49;
  const SKIN = ['#f1c9a0', '#dfac7f', '#c98d5f', '#a96e45', '#8a5634'];
  const SHIRT = ['#e8d6b0', '#7aa6c2', '#c9675a', '#e0b44c', '#6d8f5e', '#f2efe6', '#a07cc5', '#5b6c8a', '#d98f6a', '#9ab36b', '#e78fb3', '#5fb3a1'];
  const PANTS = ['#3d4250', '#6b5b4b', '#2f3b52', '#8a8070', '#f0ebe0', '#4a3a3a'];
  const LOOKS = []; { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 16; i++) { const fem = i % 3 === 1 || i % 7 === 4; LOOKS.push({ fem, skin: SKIN[(r() * 5) | 0], shirt: SHIRT[i % SHIRT.length], pants: fem ? SHIRT[(i * 5 + 3) % SHIRT.length] : PANTS[(r() * PANTS.length) | 0],
      hair: fem ? (i % 2 ? 'bun' : 'dupatta') : ['short', 'short', 'turban', 'grey', 'cap', 'short', 'bald'][i % 7], hairCol: ['#1b1715', '#2b211c', '#141414'][i % 3],
      acc: ['#1f4e8c', '#8c1f3a', '#e07a12', '#e85d9a', '#2e7d32', '#f2efe6'][i % 6], tache: !fem && i % 2 === 0 }); } }
  const sprCache = new Map();
  function getSprite(kind, look, col, frame, swing) {
    const key = kind + look + '|' + col + '|' + frame + '|' + (swing ? 1 : 0);
    let c = sprCache.get(key); if (c) return c;
    if (sprCache.size > 1400) sprCache.clear();
    c = document.createElement('canvas'); c.width = SPR_W * SS; c.height = SPR_H * SS;
    const g = c.getContext('2d'); g.setTransform(SS, 0, 0, SS, AX * SS, AY * SS);
    drawPerson(g, kind, LOOKS[look & 15], col, frame, swing);
    sprCache.set(key, c); return c;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function limb(g, x1, y1, x2, y2, w, c) { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function drawPerson(g, kind, L, col, frame, swing) {
    const kc = KCOL[col] || '#888', cop = kind === 'cop', lead = kind === 'lead', fol = kind === 'fol';
    const st = [0, 1, 0, -1][frame], ink = 'rgba(30,22,15,.85)';
    const sc = lead ? 1.12 : 1; g.scale(sc, sc);
    const shirt = cop ? '#b79d5f' : lead ? kc : L.shirt, pants = cop ? '#a98e55' : L.pants;
    const pose = fol ? (L.hair === 'cap' || L.skin === SKIN[0] ? 'placard' : (L.fem ? 'walk' : 'fist')) : 'walk';
    // flag pole for leaders
    if (lead) { limb(g, 7, -12, 7, -46, 1.4, '#5a3d24'); g.fillStyle = kc; g.beginPath(); g.moveTo(7, -46); g.quadraticCurveTo(14, -44, 20, -41 + st); g.lineTo(7, -36); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = .7; g.stroke(); }
    // legs
    limb(g, -2.4, -10, -2.4 + st * 2.6, -1.6, 3.6, cop ? '#8f7845' : pants);
    limb(g, 2.4, -10, 2.4 - st * 2.6, -1.6, 3.6, cop ? '#8f7845' : pants);
    g.fillStyle = cop ? '#1a1a1a' : '#3a2a20';
    g.beginPath(); g.ellipse(-2.4 + st * 2.6, -.9, 2.5, 1.4, 0, 0, 7); g.ellipse(2.4 - st * 2.6, -.9, 2.5, 1.4, 0, 0, 7); g.fill();
    // back arm
    const sw = st * 2.2;
    if (!(fol && pose === 'placard')) limb(g, -5, -19.5, -6.5 - sw, -12, 3, shade(shirt, -.15));
    // torso
    g.fillStyle = shirt; rr(g, -6, -22.5, 12, L.fem && !cop ? 17 : 13.5, 3.8); g.fill(); g.strokeStyle = ink; g.lineWidth = .8; g.stroke();
    if (L.fem && !cop && !lead) { g.fillStyle = L.pants; rr(g, -6, -8, 12, 3, 1.5); g.fill(); }
    if (cop) { g.fillStyle = '#5a3b1d'; g.fillRect(-6, -11.5, 12, 1.8); g.fillStyle = '#d4af37'; g.fillRect(-.8, -11.5, 1.6, 1.8); g.fillStyle = '#8a1c1c'; g.fillRect(2, -20, 2.4, 1.2); }
    if (fol) { g.strokeStyle = kc; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-5.2, -21.5); g.lineTo(5.2, -11); g.stroke(); }
    if (lead) { g.strokeStyle = '#fff6e0'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-4, -22); g.lineTo(-3, -10); g.moveTo(4, -22); g.lineTo(3, -10); g.stroke(); }
    if (L.hair === 'dupatta' && !cop && !lead) { g.strokeStyle = L.acc; g.lineWidth = 2.4; g.beginPath(); g.moveTo(5.5, -21.5); g.quadraticCurveTo(0, -15, -6, -9); g.stroke(); }
    // front arm / props
    if (cop) {
      if (swing) { limb(g, 4.5, -19.5, 7, -27, 3, shade(shirt, -.05)); limb(g, 7, -27, 3, -40, 1.6, '#7a4a20'); }
      else { limb(g, 4.5, -19.5, 6.5 + sw, -12, 3, shade(shirt, -.05)); limb(g, 6.5 + sw, -12, 11 + sw, -24, 1.6, '#7a4a20'); }
    } else if (lead) {
      limb(g, 4.5, -19.5, 7.5, -23, 3, shade(shirt, -.05));
      g.fillStyle = '#d8d8d8'; g.beginPath(); g.moveTo(6, -26); g.lineTo(12.5, -29.5); g.lineTo(12.5, -22.5); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = .7; g.stroke();
      g.fillStyle = '#c0392b'; g.fillRect(5.2, -26.6, 2, 2.4);
    } else if (fol && pose === 'placard') {
      limb(g, -4.5, -19.5, -3.5, -28, 2.8, shade(shirt, -.05)); limb(g, 4.5, -19.5, 3.5, -28, 2.8, shade(shirt, -.05));
      limb(g, 0, -27, 0, -34, 1.3, '#6b4a2a');
      g.fillStyle = '#fbf7ec'; rr(g, -8, -44 + st * .5, 16, 10, 1.2); g.fill(); g.strokeStyle = kc; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = kc; g.fillRect(-5.5, -41 + st * .5, 11, 1.4); g.fillRect(-4, -38 + st * .5, 8, 1.4);
    } else if (fol && pose === 'fist') {
      const up = frame % 2 === 0;
      limb(g, 4.5, -19.5, 6.5, up ? -31 : -27, 3, shade(shirt, -.05)); g.fillStyle = L.skin; g.beginPath(); g.arc(6.5, up ? -32 : -28, 1.9, 0, 7); g.fill();
    } else {
      limb(g, 4.5, -19.5, 6 + sw, -12, 3, shade(shirt, -.05));
      g.fillStyle = L.skin; g.beginPath(); g.arc(6 + sw, -11.6, 1.5, 0, 7); g.fill();
    }
    // head
    g.fillStyle = L.skin; g.fillRect(-1.3, -24.5, 2.6, 2.6);
    g.beginPath(); g.arc(0, -28, 5.2, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = .8; g.stroke();
    // hair / headgear
    const hc = L.hairCol;
    if (cop) {
      g.fillStyle = '#23345e'; g.beginPath(); g.ellipse(-.5, -32, 6, 2.6, -.15, 0, 7); g.fill(); g.fillStyle = '#d4af37'; g.beginPath(); g.arc(-2.6, -32.2, .9, 0, 7); g.fill();
    } else if (L.hair === 'turban') { g.fillStyle = L.acc; g.beginPath(); g.ellipse(0, -31.2, 5.8, 4, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(0, -33.4, 3.4, 0, 7); g.fill(); g.strokeStyle = shade(L.acc, -.25); g.lineWidth = .7; g.beginPath(); g.moveTo(-4.5, -31); g.lineTo(3.5, -35); g.stroke(); }
    else if (L.hair === 'cap') { g.fillStyle = hc; g.beginPath(); g.arc(0, -29, 5.2, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = fol ? kc : L.acc; g.beginPath(); g.arc(0, -30.5, 5, Math.PI, 0); g.fill(); g.fillRect(0, -31, 7, 1.6); }
    else if (L.hair === 'bun' || L.hair === 'dupatta') { g.fillStyle = hc; g.beginPath(); g.arc(0, -29.2, 5.4, Math.PI * .95, Math.PI * 2.05); g.fill(); g.beginPath(); g.arc(-4.2, -32.6, 2.6, 0, 7); g.fill(); g.fillRect(-5.4, -29, 1.8, 5); g.fillStyle = '#d23b3b'; g.fillRect(-.5, -33.2, 1, 1.6); }
    else if (L.hair === 'grey') { g.fillStyle = '#d9d6cf'; g.beginPath(); g.arc(0, -29.3, 5.3, Math.PI * 1.05, Math.PI * 1.95); g.fill(); }
    else if (L.hair === 'bald') { g.fillStyle = hc; g.fillRect(-5.2, -29.5, 1.6, 2.5); g.fillRect(3.6, -29.5, 1.6, 2.5); }
    else { g.fillStyle = hc; g.beginPath(); g.arc(0, -29.3, 5.4, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.fillRect(-5.3, -30, 2, 2.2); }
    if (fol && L.hair !== 'cap' && L.hair !== 'turban') { g.strokeStyle = kc; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -28.6, 5.1, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
    if (lead) { g.fillStyle = '#fbf7ec'; g.beginPath(); g.ellipse(0, -32.4, 4.6, 2, 0, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = .6; g.stroke(); }
    // face
    g.fillStyle = '#1b1410'; g.beginPath(); g.arc(1.4, -28, .7, 0, 7); g.arc(3.6, -28, .7, 0, 7); g.fill();
    if (L.tache || cop) { g.strokeStyle = '#1b1410'; g.lineWidth = .9; g.beginPath(); g.moveTo(1, -25.6); g.quadraticCurveTo(2.6, -26.6, 4.4, -25.6); g.stroke(); }
    else { g.strokeStyle = 'rgba(80,30,20,.7)'; g.lineWidth = .6; g.beginPath(); g.arc(2.6, -26, 1.2, .2, Math.PI - .2); g.stroke(); }
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  }
  let gasSpr = null;
  function buildGasSprite() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(232,238,214,.75)'); gr.addColorStop(.6, 'rgba(225,232,205,.4)'); gr.addColorStop(1, 'rgba(225,232,205,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); gasSpr = c; }

  /* ================= AUDIO ================= */
  let AC = null;
  function au() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { AC = null; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, d, type, v, slide, delay) { if (S.muted) return; const a = au(); if (!a) return; const t = a.currentTime + (delay || 0); const o = a.createOscillator(), gn = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(gn).connect(a.destination); o.start(t); o.stop(t + d + .02); }
  let noiseBuf = null;
  function noise(d, v, freq) { if (S.muted) return; const a = au(); if (!a) return; if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; } const s = a.createBufferSource(); s.buffer = noiseBuf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8; const gn = a.createGain(); gn.gain.setValueAtTime(v, a.currentTime); gn.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); s.connect(f).connect(gn).connect(a.destination); s.start(); s.stop(a.currentTime + d); }
  const SFX = {
    naara: v => { noise(.4, .12 * v, 650); tone(196, .35, 'sawtooth', .035 * v, 40); tone(247, .35, 'sawtooth', .03 * v, 40, .05); },
    lathi: v => { noise(.07, .18 * v, 2600); tone(110, .08, 'square', .05 * v, -40); },
    gas: v => noise(.7, .07 * v, 4200),
    join: v => tone(620 + Math.random() * 80, .06, 'triangle', .035 * v, 220),
    arrest: v => { tone(740, .14, 'square', .04 * v); tone(560, .14, 'square', .04 * v, 0, .15); tone(740, .14, 'square', .04 * v, 0, .3); },
    push: v => tone(90, .1, 'square', .04 * v, -20),
    break: v => { noise(.35, .2 * v, 500); tone(80, .3, 'sawtooth', .06 * v, -40); },
    dash: v => tone(300, .12, 'triangle', .04 * v, 400),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, .3, 'sawtooth', .05, 0, i * .18)),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .22, 'triangle', .06, 0, i * .12))
  };
  function sfx(n, x, y) {
    let v = 1; if (x !== undefined) { const d = hyp(x - S.camX, y - S.camY); if (d > 900) return; v = clamp(1 - d / 900, .15, 1); }
    if (n === 'winP' || n === 'winC') n = (n === 'winP') === (V.team === 'P') ? 'win' : 'lose';
    if (SFX[n]) SFX[n](v);
  }

  /* ================= VIEW STATE ================= */
  const V = { vans: [], ents: [], meId: 0, bars: MAP.BARS.map(b => Object.assign({}, b, { hp: 100, broken: false })), gas: [], shells: [], timeLeft: 0, state: 'play', leaders: [], arrests: 0, board: [], me: null, team: 'P', room: '', players: null, win: null, winBy: '' };
  const fx = { texts: [], rings: [], bus: [] };
  const anim = new Map();
  let MODE = null, world = null, ws = null;

  /* ---------- offline ---------- */
  function startOffline(team) {
    closeNet();
    MODE = 'off'; S.team = team;
    world = new SIM.World({ offline: true, roundLen: 240 });
    world.addHuman('me', S.name || 'You', team);
    V.team = team; V.room = 'Practice';
    resetFx(); enterGame();
    toast(team === 'P' ? 'Build a kafila and march to Jantar Mantar' : 'Stop every kafila reaching Jantar Mantar');
  }
  function syncFromWorld() {
    const w = world, h = w.humans.get('me'), me = h && w.byId.get(h.eid);
    V.ents = w.ents; V.meId = me ? me.id : 0; V.bars = w.bars; V.gas = w.gas; V.shells = w.shells;
    V.vans = w.vans.map(v => ({ x: v.x, y: v.y, ang: v.ang, stop: v.stopT > 0, leaving: v.leaving, flipped: v.flipped > 0, n: v.prisoners.length, stopT: v.stopT, unlock: v.unlock }));
    V.timeLeft = w.timeLeft(); V.state = w.state; V.leaders = w.leaders.filter(l => !l.dead); V.arrests = w.arrests;
    V.board = w.board().map(r => [r[0], r[1], r[2], r[3] === 'me' ? 1 : 0]);
    V.me = h ? { score: Math.round(h.round.score), rec: h.round.rec, arrests: h.round.arrests, peak: h.round.peak, respawn: h.eid ? 0 : Math.max(0, h.respawn), scat: h.round.scat, calls: Math.max(0, w.callsLeft(h)), squad: w.squadOf('me'), gas: h.gasAmmo, gasHits: h.gasHits } : null;
    V.win = w.winner; V.winBy = w.winBy;
    for (const e of w.drainEvents()) if (e.to === undefined || e.to === 'me') handleEv(e);
  }

  /* ---------- online ---------- */
  const SNAPS = []; let INTERP = 160, pid = null, netState = 'idle', lastPong = 0, rtt = 0;
  const KINDS = ['civ', 'fol', 'lead', 'cop'];
  function serverURL() {
    if (window.DCC_SERVER === 'offline') return null;
    if (window.DCC_SERVER) return window.DCC_SERVER;
    if (!/^https?:$/.test(location.protocol)) return null;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  function closeNet() { if (ws) { try { ws.onclose = null; ws.close(); } catch (_) { } ws = null; } netState = 'idle'; }
  function startOnline(team, room) {
    const url = serverURL(); if (!url) { menuStatus('Online play needs the game server. Open this game from your server address.', true); return; }
    closeNet(); world = null; MODE = 'on'; S.team = team; SNAPS.length = 0; pred.ok = false; resetFx();
    menuStatus('Connecting…');
    try { ws = new WebSocket(url + (url.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(room || '')); } catch (e) { menuStatus('Could not reach the game server.', true); MODE = null; return; }
    ws.binaryType = 'arraybuffer'; netState = 'connecting';
    ws.onopen = () => { netState = 'open'; ws.send(JSON.stringify({ t: 'join', name: S.name, team, room })); };
    ws.onmessage = ev => {
      if (typeof ev.data !== 'string') { decodeSnap(ev.data); return; }
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.t === 'hello') { pid = m.pid; V.team = m.team; S.team = m.team; V.room = m.room; enterGame(); toast((m.team === 'P' ? 'Andolankari' : 'Police') + ' · room ' + m.room.replace(/^r-/, '')); buildActs(); }
      else if (m.t === 'st') applyState(m);
      else if (m.t === 'ev') for (const e of m.l) handleEv(e);
      else if (m.t === 'pong') rtt = performance.now() - m.c;
      else if (m.t === 'err') { menuStatus(m.m, true); closeNet(); MODE = null; }
    };
    ws.onclose = () => { netState = 'closed'; if (MODE === 'on') { toast('Disconnected from server'); showMenu(); menuStatus('Disconnected. Press Play online to rejoin.', true); MODE = null; } };
    ws.onerror = () => { menuStatus('Could not reach the game server.', true); };
  }
  function decodeSnap(buf) {
    const dv = new DataView(buf); let o = 0;
    if (dv.getUint8(o++) !== 1) return;
    const st = dv.getUint8(o++); o += 2; const tl = dv.getFloat32(o, true); o += 4;
    const n = dv.getUint16(o, true); o += 2; const me = dv.getUint16(o, true); o += 2;
    const ents = new Map();
    for (let i = 0; i < n; i++) {
      const id = dv.getUint16(o, true); o += 2; const kb = dv.getUint8(o++); const col = dv.getUint8(o++);
      const x = dv.getUint16(o, true) / 10; o += 2; const y = dv.getUint16(o, true) / 10; o += 2;
      const fl = dv.getUint8(o++); const aim = dv.getUint8(o++) / 255 * Math.PI * 2 - Math.PI;
      ents.set(id, { id, kind: KINDS[kb & 3], look: (kb >> 2) & 15, human: !!(kb & 64), col, x, y, stun: fl & 1, swing: fl & 2, gasd: fl & 4, held: fl & 8, drag: fl & 16, squad: fl & 32, aim });
    }
    const nb = dv.getUint8(o++), bars = [];
    for (let i = 0; i < nb; i++) {
      const hp = dv.getUint8(o++);
      if (i < MAP.BARS.length) bars.push(Object.assign({}, MAP.BARS[i], { hp, broken: hp === 0 }));
      else { const x = dv.getUint16(o, true); o += 2; const y = dv.getUint16(o, true); o += 2; const ang = dv.getUint8(o++) / 255 * Math.PI * 2 - Math.PI; const half = dv.getUint8(o++); const c = Math.cos(ang), sn = Math.sin(ang);
        bars.push({ i, built: true, key: false, x, y, ang, x1: x - c * half, y1: y - sn * half, x2: x + c * half, y2: y + sn * half, thick: 7, hp, broken: hp === 0 }); }
    }
    const ng = dv.getUint8(o++), gas = [];
    for (let i = 0; i < ng; i++) { const x = dv.getUint16(o, true); o += 2; const y = dv.getUint16(o, true); o += 2; gas.push({ x, y, r: dv.getUint8(o++) * 2 }); }
    const ns = dv.getUint8(o++), shells = [];
    for (let i = 0; i < ns; i++) { const x = dv.getUint16(o, true); o += 2; const y = dv.getUint16(o, true); o += 2; shells.push({ x, y }); }
    const vans = [];
    if (o < dv.byteLength) { const nv = dv.getUint8(o++); for (let i = 0; i < nv; i++) { const x = dv.getUint16(o, true); o += 2; const y = dv.getUint16(o, true); o += 2; const ang = dv.getUint8(o++) / 255 * Math.PI * 2 - Math.PI; const f = dv.getUint8(o++); const n = dv.getUint8(o++); const stopT = dv.getUint8(o++) / 10; const unlock = dv.getUint8(o++) / 255; vans.push({ x, y, ang, stop: !!(f & 1), leaving: !!(f & 2), flipped: !!(f & 4), n, stopT, unlock }); } }
    SNAPS.push({ t: performance.now(), state: st ? 'inter' : 'play', timeLeft: tl, me, ents, bars, gas, shells, vans });
    if (SNAPS.length > 8) SNAPS.shift();
  }
  function applyState(m) {
    V.leaders = m.lead.map(a => ({ id: a[0], name: a[1], col: a[2], count: a[3], meter: a[4], x: a[5], y: a[6], human: !!a[7] }));
    V.arrests = m.arrests; V.board = m.board; V.me = m.me; V.team = m.team; V.room = m.room; V.players = m.players; V.win = m.win; V.winBy = m.winBy;
    if (m.state === 'play' && $('round').hidden === false && MODE === 'on') $('round').hidden = true;
  }
  const pred = { ok: false, id: 0, x: 0, y: 0, dashT: 0, idleT: 0 };
  function syncFromNet(dt) {
    if (!SNAPS.length) return;
    const now = performance.now(), rt = now - INTERP, last = SNAPS[SNAPS.length - 1];
    let a = SNAPS[0], b = null;
    for (let i = 0; i < SNAPS.length; i++) { if (SNAPS[i].t <= rt) a = SNAPS[i]; else { b = SNAPS[i]; break; } }
    if (!b) b = a;
    const al = b === a ? 1 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
    const out = [];
    for (const [id, eb] of b.ents) {
      const ea = a.ents.get(id);
      if (ea && al < 1) out.push(Object.assign({}, eb, { x: ea.x + (eb.x - ea.x) * al, y: ea.y + (eb.y - ea.y) * al }));
      else out.push(eb);
    }
    V.ents = out; V.meId = last.me; V.bars = last.bars; V.gas = b.gas; V.shells = b.shells;
    V.vans = (b.vans || []).map((vb, i) => { const va = a.vans && a.vans[i]; if (!va || al >= 1 || hyp(vb.x - va.x, vb.y - va.y) > 200) return vb; let da = vb.ang - va.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Object.assign({}, vb, { x: va.x + (vb.x - va.x) * al, y: va.y + (vb.y - va.y) * al, ang: va.ang + da * al }); }); V.timeLeft = last.timeLeft; V.state = last.state;
    // own prediction
    const sm = last.ents.get(last.me);
    if (sm) {
      if (!pred.ok || pred.id !== last.me) { pred.x = sm.x; pred.y = sm.y; pred.ok = true; pred.id = last.me; }
      if (!sm.stun && !sm.held && V.state === 'play') {
        const base = sm.kind === 'cop' ? (sm.drag ? 125 : 172) : 150 * (sm.gasd ? .6 : 1), sp = pred.dashT > 0 ? 330 : base;
        if (hyp(INPUT.ax, INPUT.ay) > .05) predMove(sm.kind, pred.x + INPUT.ax * sp * dt, pred.y + INPUT.ay * sp * dt);
      }
      pred.dashT = Math.max(0, pred.dashT - dt);
      const moving = hyp(INPUT.ax, INPUT.ay) > .05; pred.idleT = moving ? 0 : pred.idleT + dt;
      const err = hyp(sm.x - pred.x, sm.y - pred.y);
      if (err > 110 || sm.stun) { pred.x += (sm.x - pred.x) * Math.min(1, dt * 10); pred.y += (sm.y - pred.y) * Math.min(1, dt * 10); }
      else if (pred.idleT > .15 || err > 40) { const k = Math.min(1, dt * (pred.idleT > .15 ? 5 : 2)); pred.x += (sm.x - pred.x) * k; pred.y += (sm.y - pred.y) * k; }
      for (const e of out) if (e.id === last.me) { e.x = pred.x; e.y = pred.y; }
    } else pred.ok = false;
  }
  function predMove(kind, nx, ny) {
    const blocked = (x, y) => { if (!MAP.isWalk(x, y)) return true; if (kind !== 'cop') for (const b of V.bars) { if (!b.broken && segD(x, y, b) < 8 + 7) return true; } return false; };
    if (!blocked(nx, ny)) { pred.x = nx; pred.y = ny; return; }
    const dx = nx - pred.x, dy = ny - pred.y;
    for (const a of [.35, -.35, .7, -.7, 1.05, -1.05, 1.35, -1.35]) { const c = Math.cos(a), s = Math.sin(a), rx = (dx * c - dy * s) * c, ry = (dx * s + dy * c) * c; if (!blocked(pred.x + rx, pred.y + ry)) { pred.x += rx; pred.y += ry; return; } }
  }
  function segD(px, py, b) { const vx = b.x2 - b.x1, vy = b.y2 - b.y1, L2 = vx * vx + vy * vy; let t = ((px - b.x1) * vx + (py - b.y1) * vy) / L2; t = clamp(t, 0, 1); return hyp(px - (b.x1 + vx * t), py - (b.y1 + vy * t)); }

  /* ---------- events ---------- */
  function resetFx() { fx.texts.length = 0; fx.rings.length = 0; fx.bus.length = 0; anim.clear(); }
  function handleEv(e) {
    if (e.k === 'txt') { if (fx.texts.length > 50) fx.texts.shift(); fx.texts.push({ x: e.x, y: e.y, s: e.s, c: e.c, z: e.z, t: 0 }); }
    else if (e.k === 'ring') fx.rings.push({ x: e.x, y: e.y, c: KCOL[e.c] || '#fff', t: 0 });
    else if (e.k === 'bus') fx.bus.push({ x: e.x, y: e.y, c: KCOL[e.c] || '#fff', t: 0 });
    else if (e.k === 'sfx') sfx(e.n, e.x, e.y);
    else if (e.k === 'toast') toast(e.m);
    else if (e.k === 'end') roundEnd(e.w, e.by);
  }

  /* ================= INPUT ================= */
  const INPUT = { ax: 0, ay: 0, hold: false, aim: null };
  const keys = new Set();
  const mouse = { x: 0, y: 0, in: false, down: false };
  const joy = { id: null, bx: 0, by: 0, x: 0, y: 0 };
  const CD = { naara: 3, dash: 4, lathi: .45, gas: 1.5, drag: .4, call: .3, rescue: .5, barrier: 1 }, cds = { naara: 0, dash: 0, lathi: 0, gas: 0, drag: 0, call: 0, rescue: 0, barrier: 0 };
  let pushHeld = false, keyPush = false;
  function meEnt() { if (!V.meId) return null; if (MODE === 'off') return world.byId.get(V.meId); for (const e of V.ents) if (e.id === V.meId) return e; return null; }
  function computeInput() {
    let ax = 0, ay = 0;
    if (keys.has('arrowup')) ay -= 1; if (keys.has('arrowdown')) ay += 1;
    if (keys.has('arrowleft')) ax -= 1; if (keys.has('arrowright')) ax += 1;
    const me = meEnt();
    let aim = null;
    if (joy.id !== null) { const dx = joy.x - joy.bx, dy = joy.y - joy.by, d = hyp(dx, dy), R = 56; if (d > 6) { ax = dx / Math.max(d, R); ay = dy / Math.max(d, R); } }
    else if (!ax && !ay && mouse.in && !S.touch && me) {
      const sx = (me.x - S.camX) * S.zoom + S.vw / 2, sy = (me.y - S.camY) * S.zoom + S.vh / 2;
      const dx = mouse.x - sx, dy = mouse.y - sy, d = hyp(dx, dy);
      if (d > 14) { const m = Math.min(1, (d - 14) / 110); ax = dx / d * m; ay = dy / d * m; }
    }
    if (me && mouse.in && !S.touch) { aim = Math.atan2(mouse.y - ((me.y - S.camY) * S.zoom + S.vh / 2), mouse.x - ((me.x - S.camX) * S.zoom + S.vw / 2)); }
    const m = hyp(ax, ay); if (m > 1) { ax /= m; ay /= m; }
    INPUT.ax = ax; INPUT.ay = ay; INPUT.hold = (V.team === 'P' && mouse.down && !S.touch) || pushHeld || keyPush; INPUT.aim = aim;
  }
  let lastSend = 0, lastSent = '';
  function pushInput(now) {
    if (MODE === 'off') world.setInput('me', INPUT);
    else if (MODE === 'on' && ws && ws.readyState === 1) {
      const msg = { t: 'in', ax: +INPUT.ax.toFixed(2), ay: +INPUT.ay.toFixed(2), h: INPUT.hold ? 1 : 0 };
      if (INPUT.aim !== null) msg.aim = +INPUT.aim.toFixed(2);
      const s = JSON.stringify(msg);
      if ((s !== lastSent && now - lastSend > 60) || now - lastSend > 400) { ws.send(s); lastSent = s; lastSend = now; }
    }
  }
  function act(k) {
    au();
    if (!MODE || V.state !== 'play' || cds[k] > 0) return;
    cds[k] = CD[k];
    let arg;
    if (k === 'gas') {
      const me = meEnt(); if (!me) return;
      if (!S.touch && mouse.in) arg = { x: (mouse.x - S.vw / 2) / S.zoom + S.camX, y: (mouse.y - S.vh / 2) / S.zoom + S.camY };
      else { let best = null, bd = 340; for (const e of V.ents) if (e.kind === 'lead' || e.kind === 'fol') { const d = hyp(e.x - me.x, e.y - me.y); if (d < bd && d > 40) { bd = d; best = e; } } arg = best ? { x: best.x, y: best.y } : { x: me.x + Math.cos(me.aim || 0) * 200, y: me.y + Math.sin(me.aim || 0) * 200 }; }
    }
    if (k === 'dash') pred.dashT = .5;
    if (MODE === 'off') world.action('me', k, arg);
    else if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ t: 'act', k }, arg ? { x: Math.round(arg.x), y: Math.round(arg.y) } : {})));
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; } else if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; showJoy(); } });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse.in = false; });
  cv.addEventListener('pointerdown', e => {
    au();
    if (e.pointerType === 'mouse') {
      if (S.touch) { S.touch = false; document.body.classList.remove('touch'); buildActs(); }
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true;
      if (e.button === 0) { mouse.down = true; act(V.team === 'P' ? 'naara' : 'lathi'); } else if (e.button === 2 && V.team === 'C') act('gas');
      return;
    }
    if (!S.touch) { S.touch = true; document.body.classList.add('touch'); buildActs(); showJoy(); }
    if (joy.id === null && e.clientX < S.vw * .6) { joy.id = e.pointerId; joy.bx = joy.x = e.clientX; joy.by = joy.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (_) { } showJoy(); }
  });
  const endJoy = e => { if (e.pointerType === 'mouse') { if (e.button === 0) mouse.down = false; return; } if (e.pointerId === joy.id) { joy.id = null; showJoy(); } };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  addEventListener('blur', () => { mouse.down = false; pushHeld = false; keyPush = false; keys.clear(); joy.id = null; showJoy(); });
  function showJoy() {
    const j = $('joy');
    if (!S.touch || !MODE) { j.hidden = true; return; }
    j.hidden = false;
    let bx = joy.bx, by = joy.by;
    if (joy.id === null) { bx = 96 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slpx')) || 0); by = S.vh - 120; }
    j.classList.toggle('rest', joy.id === null);
    j.style.left = bx + 'px'; j.style.top = by + 'px';
    const dx = joy.id === null ? 0 : clamp(joy.x - joy.bx, -56, 56), dy = joy.id === null ? 0 : clamp(joy.y - joy.by, -56, 56);
    $('knob').style.transform = `translate(${dx}px,${dy}px)`;
  }
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (MODE) toggleMenu(); return; }
    if (!MODE) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); return; }
    if (e.repeat && k !== 'a') return;
    const P = V.team === 'P';
    if (k === 'w') act(P ? 'naara' : 'call');
    else if (k === 'a') { if (P) keyPush = true; else act('gas'); }
    else if (k === 's') act(P ? 'rescue' : 'drag');
    else if (k === 'd' || k === ' ') { e.preventDefault(); act('dash'); }
    else if (k === 'e') act(P ? 'rescue' : 'barrier');
    else if (k === 'j') act(P ? 'naara' : 'lathi');
    else if (k === 'm') setMute(!S.muted);
    else if (k === 'q') { S.hq = !S.hq; store.set('hq', S.hq ? '1' : '0'); resize(); toast(S.hq ? 'Graphics: high' : 'Graphics: low'); }
    else if (k === 'tab') { e.preventDefault(); $('board').hidden = !$('board').hidden; }
    else if (k === 't') switchTeam();
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k === 'a') keyPush = false; });

  /* ================= RENDER ================= */
  function resize() {
    S.dpr = Math.min(S.hq ? 2 : 1.25, window.devicePixelRatio || 1);
    S.vw = innerWidth; S.vh = innerHeight;
    cv.width = Math.round(S.vw * S.dpr); cv.height = Math.round(S.vh * S.dpr);
    S.zoom = clamp(Math.min(S.vw, S.vh) / 470, .7, 1.35);
    const ms = S.vw < 600 ? 104 : 150; mini.style.width = mini.style.height = ms + 'px';
    mini.width = mini.height = Math.round(ms * S.dpr); buildMini();
  }
  addEventListener('resize', () => { resize(); showJoy(); });
  addEventListener('orientationchange', () => setTimeout(resize, 200));

  function updateAnim(e, dt) {
    let a = anim.get(e.id);
    if (!a) { a = { x: e.x, y: e.y, ph: Math.random() * 4, face: 1, seen: 0, mv: 0 }; anim.set(e.id, a); }
    const dx = e.x - a.x, dy = e.y - a.y, d = hyp(dx, dy);
    a.mv = a.mv * .8 + (d / Math.max(dt, .001)) * .2;
    a.ph += d * .11;
    if (e.kind === 'cop' && e.swing) a.face = Math.cos(e.aim) >= 0 ? 1 : -1;
    else if (dx > .25) a.face = 1; else if (dx < -.25) a.face = -1;
    a.x = e.x; a.y = e.y; a.seen = performance.now();
    return a;
  }
  let frameNo = 0;
  function render(dt, now) {
    const g = ctx, Z = S.zoom, dpr = S.dpr;
    const me = meEnt();
    if (me) { S.camX += (me.x - S.camX) * Math.min(1, dt * 8); S.camY += (me.y - S.camY) * Math.min(1, dt * 8); }
    const hw = S.vw / 2 / Z, hh = S.vh / 2 / Z;
    S.camX = clamp(S.camX, hw, MAP.SIZE - hw); S.camY = clamp(S.camY, hh, MAP.SIZE - hh);
    const A = dpr * Z, E = dpr * (S.vw / 2 - S.camX * Z), F = dpr * (S.vh / 2 - S.camY * Z);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#a7c47a'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(A, 0, 0, A, E, F);
    // background (visible part only)
    if (bg) {
      const x0 = Math.max(0, S.camX - hw), y0 = Math.max(0, S.camY - hh), x1 = Math.min(MAP.SIZE, S.camX + hw), y1 = Math.min(MAP.SIZE, S.camY + hh);
      g.imageSmoothingEnabled = true;
      g.drawImage(bg, x0 * BGS, y0 * BGS, (x1 - x0) * BGS, (y1 - y0) * BGS, x0, y0, x1 - x0, y1 - y0);
    }
    const t = now / 1000;
    // dharna zone
    const dz = MAP.DZ, topMeter = V.leaders.reduce((m, l) => Math.max(m, l.meter), 0);
    g.strokeStyle = 'rgba(181,83,44,.9)'; g.lineWidth = 4; g.setLineDash([14, 10]); g.lineDashOffset = -t * 20;
    g.beginPath(); g.arc(dz.x, dz.y, dz.r + Math.sin(t * 3) * 3, 0, 7); g.stroke(); g.setLineDash([]);
    if (topMeter > 0) { g.strokeStyle = '#ffcf6b'; g.lineWidth = 7; g.beginPath(); g.arc(dz.x, dz.y, dz.r - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * topMeter / 100); g.stroke(); }
    // police bus
    drawBus(g, MAP.BUS.x, MAP.BUS.y, V.arrests);
    // barricades
    for (const b of V.bars) drawBar(g, b, b, t);
    // map labels sit under the people
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const toS = (x, y) => [(x - S.camX) * Z + S.vw / 2, (y - S.camY) * Z + S.vh / 2];
    drawMapLabels(g, toS);
    g.setTransform(A, 0, 0, A, E, F);
    // people
    const vis = [];
    for (const e of V.ents) { if (e.dead) continue; if (Math.abs(e.x - S.camX) > hw + 40 || Math.abs(e.y - S.camY) > hh + 60) { if (e.kind === 'lead') updateAnim(e, dt); continue; } vis.push(e); }
    vis.sort((a, b) => a.y - b.y);
    g.strokeStyle = '#6b4a22'; g.lineWidth = 1.6;
    for (const e of vis) if (e.held) { let c = null, bd = 34; for (const o of vis) if (o.kind === 'cop' && o.drag) { const d = hyp(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; c = o; } } if (c) { g.beginPath(); g.moveTo(c.x, c.y - 16); g.lineTo(e.x, e.y - 14); g.stroke(); } }
    if (S.hq) { g.fillStyle = 'rgba(25,30,15,.28)'; g.beginPath(); for (const e of vis) { g.moveTo(e.x + 8, e.y); g.ellipse(e.x, e.y, 8, 3.5, 0, 0, 7); } g.fill(); }
    for (const e of vis) {
      const a = updateAnim(e, dt);
      const moving = a.mv > 12, frame = moving ? (Math.floor(a.ph) & 3) : 0;
      const spr = getSprite(e.kind, e.look, e.kind === 'fol' || e.kind === 'lead' ? e.col : 0, frame, !!e.swing && e.kind === 'cop');
      const w = SPR_W, h = SPR_H;
      if (a.face < 0) { g.setTransform(-A, 0, 0, A, A * e.x + E, A * e.y + F); g.drawImage(spr, -AX, -AY, w, h); g.setTransform(A, 0, 0, A, E, F); }
      else g.drawImage(spr, e.x - AX, e.y - AY, w, h);
      if (e.stun) { g.fillStyle = '#ffe58a'; for (let k = 0; k < 3; k++) { const an = t * 6 + k * 2.1; g.beginPath(); g.arc(e.x + Math.cos(an) * 8, e.y - 40 + Math.sin(an) * 2.5, 1.8, 0, 7); g.fill(); } }
      if (e.held) { g.fillStyle = '#ffd27a'; g.font = '700 9px Hind, sans-serif'; g.textAlign = 'center'; g.fillText('✋', e.x, e.y - 40); }
      if (e.squad && e.kind === 'cop') { g.fillStyle = '#4da3ff'; g.beginPath(); g.moveTo(e.x - 4, e.y - 42); g.lineTo(e.x, e.y - 38); g.lineTo(e.x + 4, e.y - 42); g.lineTo(e.x + 4, e.y - 40); g.lineTo(e.x, e.y - 36); g.lineTo(e.x - 4, e.y - 40); g.fill(); }
      if (e.id === V.meId) { g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.ellipse(e.x, e.y, 15, 6, 0, 0, 7); g.stroke(); g.setLineDash([]); }
    }
    for (const v of V.vans || []) if (Math.abs(v.x - S.camX) < hw + 60 && Math.abs(v.y - S.camY) < hh + 60) drawVan(g, v, t);
    // gas
    for (const c of V.gas) { const r = c.r * 1.25; if (r < 2) continue; const n = S.hq ? 4 : 2; for (let k = 0; k < n; k++) { const an = k * 1.57 + t * .4, ox = Math.cos(an) * c.r * .3, oy = Math.sin(an) * c.r * .3; g.drawImage(gasSpr, c.x + ox - r, c.y + oy - r, r * 2, r * 2); } }
    for (const s of V.shells) { g.fillStyle = '#4c5650'; g.beginPath(); g.arc(s.x, s.y - 10, 4, 0, 7); g.fill(); }
    // fx
    for (const r of fx.rings) { r.t += dt; const k = r.t / .5; g.globalAlpha = Math.max(0, 1 - k); g.strokeStyle = r.c; g.lineWidth = 4; g.beginPath(); g.arc(r.x, r.y - 10, 20 + k * 140, 0, 7); g.stroke(); g.globalAlpha = 1; }
    fx.rings = fx.rings.filter(r => r.t < .5);
    for (const b of fx.bus) { b.t += dt; const k = Math.min(1, b.t / 1.2), x = b.x + (MAP.BUS.x - b.x) * k, y = b.y + (MAP.BUS.y - b.y) * k - Math.sin(k * Math.PI) * 120; g.fillStyle = b.c; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    fx.bus = fx.bus.filter(b => b.t < 1.2);
    // screen-space overlays (labels, texts, indicators)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const L of V.leaders) {
      const e = L; if (Math.abs(e.x - S.camX) > hw + 20 || Math.abs(e.y - S.camY) > hh + 60) continue;
      const a = anim.get(L.id), x = a ? a.x : L.x, y = a ? a.y : L.y;
      const [sx, sy] = toS(x, y); const isMe = L.id === V.meId;
      const label = (isMe ? 'You' : L.name) + ' · ' + L.count;
      g.font = '600 12px Hind, system-ui, sans-serif'; const tw = g.measureText(label).width + 12;
      const ly = sy - 58 * Z - 8;
      g.fillStyle = isMe ? 'rgba(255,248,230,.95)' : 'rgba(26,21,15,.75)'; rr(g, sx - tw / 2, ly - 13, tw, 18, 9); g.fill();
      g.fillStyle = isMe ? '#1f1a14' : (L.count < 3 ? '#ffb48a' : '#f3e9d6'); g.fillText(label, sx, ly);
      g.fillStyle = KCOL[L.col] || '#888'; g.beginPath(); g.arc(sx - tw / 2 + 7, ly - 4, 3.2, 0, 7); g.fill();
      if (L.meter > 0) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(sx - 24, ly + 8, 48, 4); g.fillStyle = '#ffcf6b'; g.fillRect(sx - 24, ly + 8, 48 * L.meter / 100, 4); }
    }
    for (const x of fx.texts) {
      x.t += dt; const k = x.t / 1.3; const [sx, sy] = toS(x.x, x.y);
      g.globalAlpha = Math.max(0, 1 - k * k); g.font = `700 ${Math.round(x.z * clamp(Z, .85, 1.2))}px Hind, system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = 'rgba(26,21,15,.85)'; g.strokeText(x.s, sx, sy - k * 28); g.fillStyle = x.c; g.fillText(x.s, sx, sy - k * 28); g.globalAlpha = 1;
    }
    fx.texts = fx.texts.filter(x => x.t < 1.3);
    drawIndicators(g, toS);
    if (++frameNo % 300 === 0) { const cut = performance.now() - 3000; for (const [id, a] of anim) if (a.seen < cut) anim.delete(id); }
  }
  function drawVan(g, v, t) {
    if (v.flipped) {
      g.save(); g.translate(v.x, v.y); g.rotate(v.ang + .5);
      g.fillStyle = 'rgba(20,15,10,.3)'; g.fillRect(-22, -11, 48, 24);
      g.fillStyle = '#5c5c58'; rr(g, -24, -12, 48, 24, 4); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#1a1a1a'; for (const [wx, wy] of [[-15, -12], [15, -12], [-15, 12], [15, 12]]) { g.beginPath(); g.ellipse(wx, wy, 5, 3.4, 0, 0, 7); g.fill(); }
      g.fillStyle = '#2f5fb3'; g.fillRect(-24, -2, 48, 4);
      g.restore();
      g.fillStyle = 'rgba(120,120,120,.35)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(v.x - 8 + k * 9, v.y - 24 - ((t * 20 + k * 7) % 18), 5 + k, 0, 7); g.fill(); }
      return;
    }
    g.save(); g.translate(v.x, v.y);
    if (v.stop) { g.strokeStyle = 'rgba(77,163,255,.9)'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.arc(0, 0, 50, 0, 7); g.stroke(); g.setLineDash([]); g.strokeStyle = '#ffcf6b'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.stopT / 10)); g.stroke(); }
    g.rotate(v.ang);
    g.fillStyle = 'rgba(20,15,10,.3)'; g.fillRect(-24 + 4, -12 + 5, 48, 24);
    g.fillStyle = '#f4f4f0'; rr(g, -24, -12, 48, 24, 4); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#2f5fb3'; g.fillRect(-24, -3, 48, 6);
    g.fillStyle = '#9fc3e6'; g.fillRect(12, -10, 9, 20);
    const on = Math.sin(t * 12) > 0; g.fillStyle = on ? '#e33' : '#36f'; g.fillRect(2, -9, 4, 8); g.fillStyle = on ? '#36f' : '#e33'; g.fillRect(2, 1, 4, 8);
    for (let k = 0; k < 5; k++) { g.fillStyle = k < v.n ? '#ffcf6b' : '#1b2b45'; g.fillRect(-20 + k * 6, -10, 4, 5); }
    g.restore();
    if (v.unlock > 0) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(v.x - 26, v.y - 34, 52, 6); g.fillStyle = '#8be36b'; g.fillRect(v.x - 26, v.y - 34, 52 * v.unlock, 6); }
    if (v.stop) { g.fillStyle = '#fff'; g.font = '700 11px Hind, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(20,30,60,.85)'; const s = 'VAN ' + Math.ceil(v.stopT) + 's · ' + v.n + '/5'; g.strokeText(s, v.x, v.y + 30); g.fillText(s, v.x, v.y + 30); }
    else if (v.leaving) { g.fillStyle = '#fff'; g.font = '700 10px Hind, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(20,30,60,.85)'; g.strokeText('FULL → THANA', v.x, v.y + 28); g.fillText('FULL → THANA', v.x, v.y + 28); }
  }
  function drawBus(g, x, y, n) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(20,15,10,.3)'; g.fillRect(-36 + 5, -16 + 6, 72, 32);
    g.fillStyle = '#2f4f86'; rr(g, -36, -16, 72, 32, 5); g.fill();
    g.fillStyle = '#e9edf3'; g.fillRect(-36, 6, 72, 4);
    for (let k = 0; k < 8; k++) { g.fillStyle = k < n ? '#ffcf6b' : '#182b4d'; g.fillRect(-32 + k * 8.4, -12, 6.4, 9); }
    g.fillStyle = '#c0392b'; g.fillRect(-6, -19, 12, 3);
    g.restore();
  }
  function drawBar(g, b, s, t) {
    const L = hyp(b.x2 - b.x1, b.y2 - b.y1), ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
    g.save(); g.translate(b.x, b.y); g.rotate(ang);
    if (s.broken) {
      g.globalAlpha = .8;
      for (let k = 0; k < 4; k++) { g.save(); g.translate((k - 1.5) * L / 4, (k % 2 ? 14 : -12)); g.rotate((k % 2 ? .6 : -.5)); g.fillStyle = '#f2ece0'; g.fillRect(-L / 10, -3, L / 5, 6); g.fillStyle = '#c8392b'; g.fillRect(-L / 10, -3, L / 20, 6); g.fillRect(0, -3, L / 20, 6); g.restore(); }
      g.restore(); return;
    }
    const sh = s.hp < 100 && Math.sin(t * 40) > 0 ? 1 : 0;
    g.translate(sh, 0);
    g.fillStyle = 'rgba(20,15,10,.3)'; g.fillRect(-L / 2 + 3, -4, L, 11);
    const seg = 4, sw = L / seg;
    for (let k = 0; k < seg; k++) {
      const x0 = -L / 2 + k * sw + 1;
      g.fillStyle = '#f2ece0'; g.fillRect(x0, -6, sw - 2, 11);
      g.save(); g.beginPath(); g.rect(x0, -6, sw - 2, 11); g.clip(); g.fillStyle = '#c8392b';
      for (let q = -20; q < sw + 20; q += 8) { g.beginPath(); g.moveTo(x0 + q, -6); g.lineTo(x0 + q + 4, -6); g.lineTo(x0 + q - 7, 5); g.lineTo(x0 + q - 11, 5); g.closePath(); g.fill(); }
      g.restore(); g.strokeStyle = '#2a2018'; g.lineWidth = 1.2; g.strokeRect(x0, -6, sw - 2, 11);
      g.fillStyle = '#2a2018'; g.fillRect(x0 + 2, 5, 2, 4); g.fillRect(x0 + sw - 6, 5, 2, 4);
    }
    g.restore();
    if (s.hp < 100) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x - 26, b.y - 30, 52, 6); g.fillStyle = '#ffcf6b'; g.fillRect(b.x - 26, b.y - 30, 52 * s.hp / 100, 6); }
  }
  const ROAD_LABELS = (() => { const out = []; for (const r of MAP.ROADS) { if (!r.n || r.ring) continue; let best = null, bl = 0; for (let i = 0; i < r.p.length - 1; i++) { const A = MAP.nodes[r.p[i]], B = MAP.nodes[r.p[i + 1]], l = hyp(B.x - A.x, B.y - A.y); if (l > bl && !(r.n === 'Jantar Mantar Road' && r.p[i] !== 'JR2')) { bl = l; best = [A, B]; } } if (!best) { const A = MAP.nodes[r.p[0]], B = MAP.nodes[r.p[1]]; best = [A, B]; } let a = Math.atan2(best[1].y - best[0].y, best[1].x - best[0].x); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; out.push({ s: r.n, x: (best[0].x + best[1].x) / 2, y: (best[0].y + best[1].y) / 2, a }); } out.push({ s: 'Connaught Circus', x: CPc.x, y: CPc.y + 330 * M, a: 0 }); return out; })();
  function drawMapLabels(g, toS) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 11px Hind, system-ui, sans-serif';
    for (const l of ROAD_LABELS) { const [sx, sy] = toS(l.x, l.y); if (sx < -100 || sy < -30 || sx > S.vw + 100 || sy > S.vh + 30) continue; g.save(); g.translate(sx, sy); g.rotate(l.a); g.lineWidth = 3; g.strokeStyle = 'rgba(40,40,38,.85)'; g.strokeText(l.s, 0, 0); g.fillStyle = '#f4efe2'; g.fillText(l.s, 0, 0); g.restore(); }
    g.font = '700 11px Hind, system-ui, sans-serif';
    for (const l of MAP.LANDMARKS) {
      if (!l.label) continue; const p = MAP.U(l.e, l.n), [sx, sy0] = toS(p.x, p.y), sy = sy0 + (l.k === 'metro' ? -20 : l.k === 'jantar' ? -78 * S.zoom : -14);
      if (sx < -120 || sy < -20 || sx > S.vw + 120 || sy > S.vh + 20) continue;
      const tw = g.measureText(l.label).width + 12; g.fillStyle = l.k === 'jantar' ? 'rgba(181,83,44,.92)' : 'rgba(255,250,238,.88)'; rr(g, sx - tw / 2, sy - 9, tw, 18, 9); g.fill();
      g.fillStyle = l.k === 'jantar' ? '#fff6e6' : '#3a2c1e'; g.fillText(l.label, sx, sy + 1);
    }
    const [dx, dy] = toS(MAP.DZ.x, MAP.DZ.y + MAP.DZ.r + 14);
    if (dx > -60 && dx < S.vw + 60 && dy > -20 && dy < S.vh + 20) { g.font = '700 13px Hind, system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(60,30,10,.85)'; g.strokeText('धरना स्थल', dx, dy); g.fillStyle = '#ffe2b8'; g.fillText('धरना स्थल', dx, dy); }
    g.textBaseline = 'alphabetic';
  }
  function drawIndicators(g, toS) {
    const marks = [];
    if (V.team === 'P') marks.push({ x: MAP.DZ.x, y: MAP.DZ.y, c: '#b5532c', l: 'Jantar Mantar ' + Math.round(distToDZ() / M) + 'm' });
    else for (const L of V.leaders.slice().sort((a, b) => (b.meter * 3 + b.count) - (a.meter * 3 + a.count)).slice(0, 3)) marks.push({ x: L.x, y: L.y, c: KCOL[L.col] || '#888', l: String(L.count) });
    for (const m of marks) {
      const [sx, sy] = toS(m.x, m.y);
      if (sx > 0 && sx < S.vw && sy > 0 && sy < S.vh) continue;
      const cx = S.vw / 2, cy = S.vh / 2, a = Math.atan2(sy - cy, sx - cx);
      const pad = 34, mx = clamp(cx + Math.cos(a) * S.vw, pad, S.vw - pad), my = clamp(cy + Math.sin(a) * S.vh, pad + 60, S.vh - pad - (S.touch ? 140 : 70));
      g.save(); g.translate(mx, my); g.rotate(a); g.fillStyle = m.c; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(15, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
      g.font = '700 12px Hind, system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(26,21,15,.85)';
      g.font = '700 12px Hind, system-ui, sans-serif'; const tw2 = g.measureText(m.l).width / 2 + 4; const lx = clamp(mx - Math.cos(a) * 30, tw2, S.vw - tw2), ly = my - Math.sin(a) * 22 + 4; g.strokeText(m.l, lx, ly); g.fillStyle = '#fff'; g.fillText(m.l, lx, ly);
    }
  }
  function nearRescue(me) {
    for (const v of V.vans || []) if (v.n > 0 && hyp(v.x - me.x, v.y - me.y) < 110) return true;
    for (const e of V.ents) if (e.kind === 'cop' && e.drag && hyp(e.x - me.x, e.y - me.y) < 110) return true;
    return false;
  }
  function distToDZ() { const me = meEnt(); return me ? hyp(me.x - MAP.DZ.x, me.y - MAP.DZ.y) : 0; }
  function drawMini() {
    if (!miniBase) return;
    const g = mctx, b = miniBase, s = b.sc;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b.c, 0, 0);
    g.setTransform(s, 0, 0, s, b.ox, b.oy);
    g.fillStyle = '#e0613a'; g.beginPath(); g.arc(MAP.DZ.x, MAP.DZ.y, 70, 0, 7); g.fill();
    for (const br of V.bars) if (!br.broken) { g.fillStyle = br.built ? '#7fb2ff' : '#ff5a3c'; g.fillRect(br.x - 22, br.y - 22, 44, 44); }
    for (const L of V.leaders) { g.fillStyle = KCOL[L.col] || '#888'; g.beginPath(); g.arc(L.x, L.y, 34 + Math.min(50, L.count * 2.4), 0, 7); g.fill(); }
    for (const v of V.vans || []) { g.fillStyle = v.stop ? '#ffcf6b' : '#4da3ff'; g.fillRect(v.x - 30, v.y - 30, 60, 60); }
    if (V.team === 'C') { g.fillStyle = '#d8c27a'; for (const e of V.ents) if (e.kind === 'cop') g.fillRect(e.x - 16, e.y - 16, 32, 32); }
    const me = meEnt();
    if (me) { g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 14; g.beginPath(); g.arc(me.x, me.y, 46, 0, 7); g.fill(); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 12; const vw = S.vw / S.zoom, vh = S.vh / S.zoom; g.strokeRect(S.camX - vw / 2, S.camY - vh / 2, vw, vh);
  }

  /* ================= HUD & UI ================= */
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let hudT = 0;
  function hud() {
    const me = meEnt();
    if (V.team === 'P') {
      const L = V.leaders.find(l => l.id === V.meId) || (me && me.kind === 'lead' ? me : null);
      const cnt = L ? L.count : 0, meter = L ? L.meter : 0;
      $('hRole').textContent = 'Andolankari · ' + (V.room || '');
      $('hBig').innerHTML = cnt + '<small>in your kafila</small>';
      const inZ = me && hyp(me.x - MAP.DZ.x, me.y - MAP.DZ.y) < MAP.DZ.r;
      $('hMeterL').textContent = inZ ? (cnt >= 5 ? 'धरना chal raha hai' : 'Need 5+ people to sit') : 'Dharna · ' + Math.round(distToDZ() / M) + ' m to go';
      $('hMeterV').textContent = Math.floor(meter) + '%'; $('hMeter').style.width = meter + '%';
      const up = V.bars.filter(b => b.key && !b.broken).length;
      $('hInfo').textContent = me && nearRescue(me) ? 'Prisoner nearby: bring 5+ people, press CHHUDAO' : (up ? up + ' JM Road barricade' + (up > 1 ? 's' : '') + ' up · need 10 to break' : 'JM Road is open');
    } else {
      const top = V.leaders.reduce((a, b) => !a || b.meter > a.meter ? b : a, null);
      $('hRole').textContent = 'Police · ' + (V.room || '');
      $('hBig').innerHTML = (V.me ? V.me.arrests : 0) + '<small>in van by you · ' + V.arrests + ' total</small>';
      $('hMeterL').textContent = top && top.meter > 0 ? 'Dharna: ' + top.name.replace(' 🤖', '') : 'Dharna meter';
      const mv = top ? top.meter : 0; $('hMeterV').textContent = Math.floor(mv) + '%'; $('hMeter').style.width = mv + '%';
      const m = V.me || {}; const need = 10 - ((m.scat || 0) % 10);
      $('hInfo').textContent = 'Squad ' + (m.squad || 0) + '/5 · ' + (m.calls > 0 ? m.calls + ' backup ready' : need + ' hits to next backup');
    }
    $('hTime').textContent = V.state === 'play' ? fmt(V.timeLeft) : 'Next ' + fmt(V.timeLeft);
    $('hScore').textContent = V.me ? V.me.score + ' pts' : '';
    const resp = V.me && V.me.respawn > 0 && V.state === 'play';
    $('respawn').hidden = !resp; if (resp) $('respawnT').textContent = Math.ceil(V.me.respawn);
    for (const b of document.querySelectorAll('.act')) {
      const k = b.dataset.k; if (CD[k]) b.style.setProperty('--cd', (cds[k] / CD[k]).toFixed(3));
      if (k === 'push') b.classList.toggle('on', INPUT.hold);
      if (k === 'drag') b.classList.toggle('on', !!me && !!me.drag);
      if (k === 'call') { b.classList.toggle('on', !!(V.me && V.me.calls > 0 && V.me.squad < 5)); const sm = b.querySelector('small'); if (sm) sm.textContent = S.touch ? '' : 'W · ' + (V.me ? V.me.calls : 0) + ' ready'; }
      if (k === 'rescue') b.classList.toggle('on', !!me && nearRescue(me));
      if (k === 'gas') { const n = V.me ? (V.me.gas || 0) : 0; const sp = b.querySelector('span'); if (sp) sp.textContent = 'GAS ' + n; b.classList.toggle('empty', n <= 0); const sm = b.querySelector('small'); if (sm && !S.touch) sm.textContent = n > 0 ? 'A · right-click' : 'A · lathi ' + (5 - ((V.me && V.me.gasHits) || 0)) + ' more'; }
      if (k === 'barrier') b.classList.toggle('on', !!me && V.ents.filter(c => c.kind === 'cop' && hyp(c.x - me.x, c.y - me.y) < 90).length >= 5);
    }
    if (!$('board').hidden) renderBoard();
  }
  function renderBoard() {
    const rows = (V.board || []).map((r, i) => `<li class="${r[3] ? 'me' : ''}"><span>${i + 1}. ${esc(r[0])} <i>${r[2] === 'P' ? '✊' : '👮'}</i></span><b>${r[1]}</b></li>`).join('');
    $('boardList').innerHTML = rows || '<li><span>No players yet</span></li>';
    $('boardTeams').textContent = V.players ? `✊ ${V.players.P} andolankari · 👮 ${V.players.C} police (+ bots)` : (MODE === 'off' ? 'Practice round with bots' : '');
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function buildActs() {
    const a = $('acts'); a.innerHTML = '';
    const P = V.team === 'P';
    const defs = P ? [['naara', 'NAARA', 'W · click'], ['push', 'PUSH', 'A · hold'], ['rescue', 'CHHUDAO', 'S'], ['dash', 'DASH', 'D']]
      : [['lathi', 'LATHI', 'Click'], ['call', 'CALL', 'W'], ['gas', 'GAS', 'A'], ['drag', 'DRAG', 'S'], ['barrier', 'BARRIER', 'E'], ['dash', 'DASH', 'D']];
    for (const [k, l, h] of defs) {
      const b = document.createElement('button'); b.className = 'act act-' + k; b.type = 'button'; b.dataset.k = k;
      b.innerHTML = '<span>' + l + '</span><small>' + h + '</small>';
      b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); if (k === 'push') pushHeld = true; else act(k); });
      const up = ev => { if (k === 'push') pushHeld = false; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      a.appendChild(b);
    }
  }
  let toastT = null;
  function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }
  function setMute(v) { S.muted = v; store.set('muted', v ? '1' : '0'); $('muteBtn').textContent = v ? '🔇' : '🔊'; $('muteBtn').setAttribute('aria-label', v ? 'Sound off' : 'Sound on'); }
  function roundEnd(w, by) {
    const mine = w === V.team;
    $('rTitle').textContent = w === 'P' ? 'धरना हो गया!' : 'चौक ख़ाली रहा';
    $('rTitle').style.color = mine ? 'var(--teal)' : 'var(--brick)';
    $('rText').textContent = w === 'P' ? (by ? by + ' held Jantar Mantar. Andolankari win this round.' : 'Andolankari win this round.') : 'The clock ran out before any dharna. Police win this round.';
    setTimeout(() => {
      renderBoard();
      $('rBoard').innerHTML = (V.board || []).slice(0, 5).map((r, i) => `<li class="${r[3] ? 'me' : ''}"><span>${i + 1}. ${esc(r[0])} ${r[2] === 'P' ? '✊' : '👮'}</span><b>${r[1]}</b></li>`).join('');
      const m = V.me; $('rStats').textContent = m ? (V.team === 'P' ? `Peak kafila ${m.peak} · recruited ${m.rec} · ${m.score} pts` : `Lifted ${m.arrests} · scattered ${m.scat || 0} · ${m.score} pts`) : '';
      $('rOffline').hidden = MODE !== 'off'; $('rNext').hidden = MODE === 'off';
      $('round').hidden = false;
    }, 700);
  }
  function enterGame() {
    $('menu').hidden = true; $('round').hidden = true;
    document.body.classList.add('playing');
    buildActs(); resize(); showJoy();
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => { }); } catch (_) { }
  }
  function showMenu() { $('menu').hidden = false; $('resume').hidden = !MODE; document.body.classList.remove('playing'); }
  function toggleMenu() { if ($('menu').hidden) showMenu(); else if (MODE) { $('menu').hidden = true; document.body.classList.add('playing'); } }
  function switchTeam() {
    const nt = V.team === 'P' ? 'C' : 'P';
    if (MODE === 'off') startOffline(nt);
    else if (MODE === 'on' && ws && ws.readyState === 1) { ws.send(JSON.stringify({ t: 'team', team: nt })); pred.ok = false; }
  }
  function menuStatus(m, bad) { const el = $('netStatus'); el.textContent = m; el.classList.toggle('bad', !!bad); }

  // menu wiring
  $('name').value = S.name;
  $('name').addEventListener('input', () => { S.name = $('name').value.slice(0, 16); store.set('name', S.name); });
  let pickTeam = store.get('team', 'P');
  function setPick(t) { pickTeam = t; store.set('team', t); for (const b of document.querySelectorAll('.pick')) b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false'); }
  for (const b of document.querySelectorAll('.pick')) b.addEventListener('click', () => setPick(b.dataset.t));
  setPick(pickTeam);
  const qs = new URLSearchParams(location.search);
  if (qs.get('room')) $('room').value = qs.get('room').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  $('playOn').addEventListener('click', () => { au(); startOnline(pickTeam === 'A' ? 'auto' : pickTeam, $('room').value.trim()); });
  $('playOff').addEventListener('click', () => { au(); startOffline(pickTeam === 'C' ? 'C' : 'P'); });
  $('resume').addEventListener('click', () => toggleMenu());
  $('invite').addEventListener('click', () => {
    let code = $('room').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!code) { code = Math.random().toString(36).slice(2, 8); $('room').value = code; }
    const url = location.origin + location.pathname + '?room=' + code;
    const done = () => menuStatus('Invite link copied: ' + url);
    try { navigator.clipboard.writeText(url).then(done, () => menuStatus('Share this link: ' + url)); } catch (_) { menuStatus('Share this link: ' + url); }
  });
  $('fullBtn').addEventListener('click', () => { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => { }); else if (document.exitFullscreen) document.exitFullscreen().catch(() => { }); });
  $('menuBtn').addEventListener('click', () => toggleMenu());
  $('muteBtn').addEventListener('click', () => setMute(!S.muted));
  $('boardBtn').addEventListener('click', () => { $('board').hidden = !$('board').hidden; if (!$('board').hidden) renderBoard(); });
  $('boardClose').addEventListener('click', () => { $('board').hidden = true; });
  $('rAgain').addEventListener('click', () => startOffline(V.team));
  $('rSwap').addEventListener('click', () => startOffline(V.team === 'P' ? 'C' : 'P'));
  $('rMenu').addEventListener('click', () => { $('round').hidden = true; MODE = null; showMenu(); });
  $('rHide').addEventListener('click', () => { $('round').hidden = true; });
  setMute(S.muted);

  // server status in menu
  (function probe() {
    const url = serverURL();
    if (!url) { $('playOn').disabled = true; menuStatus(window.DCC_SERVER === 'offline' ? 'This copy plays offline against bots. Online play runs from your own game server.' : 'Online play needs the game server. Practice offline works here.', true); return; }
    const base = window.DCC_SERVER ? window.DCC_SERVER.replace(/^ws/, 'http').replace(/\/ws$/, '') : '';
    fetch(base + '/stats', { cache: 'no-store' }).then(r => r.json()).then(j => { menuStatus('Server online · ' + j.players + ' playing now'); }).catch(() => { menuStatus('Server not reachable right now. Practice offline still works.', true); });
  })();

  /* ================= LOOP ================= */
  let last = performance.now(), pingT = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const k in cds) cds[k] = Math.max(0, cds[k] - dt);
    if (MODE) computeInput();
    if (MODE === 'off') { pushInput(now); if (!$('menu').hidden) { } else world.step(dt); syncFromWorld(); }
    else if (MODE === 'on') { pushInput(now); syncFromNet(dt); pingT -= dt; if (pingT <= 0 && ws && ws.readyState === 1) { ws.send(JSON.stringify({ t: 'ping', c: performance.now() })); pingT = 5; } }
    else { S.camX = MAP.DZ.x + Math.sin(now / 9000) * 600; S.camY = MAP.DZ.y - 200 + Math.cos(now / 11000) * 400; V.ents = []; V.leaders = []; }
    render(dt, now); drawMini();
    hudT -= dt; if (hudT <= 0 && MODE) { hud(); hudT = .12; }
    // adaptive quality
    S.frameAvg = S.frameAvg * .95 + (dt * 1000) * .05;
    if (S.hq && S.frameAvg > 26) { S.lowT += dt; if (S.lowT > 3) { S.hq = false; resize(); toast('Switched to low graphics for smoother play (Q to change)'); } } else S.lowT = 0;
    requestAnimationFrame(frame);
  }
  resize();
  buildGasSprite();
  menuStatusInit();
  function menuStatusInit() { $('loading').hidden = false; }
  requestAnimationFrame(() => setTimeout(() => { bg = buildBG(); $('loading').hidden = true; $('playOff').disabled = false; if (serverURL()) $('playOn').disabled = false; }, 30));
  if (/[?&]debug=1/.test(location.search)) window.__dcc = { S, V, get world() { return world; } };
  requestAnimationFrame(frame);
})();
