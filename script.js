// ============================================================
//  Circular World Cup Bracket 2026 — Interactive
// ============================================================

const canvas = document.getElementById('bracketCanvas');
const ctx    = canvas.getContext('2d');

let SIZE, CX, CY;
function resize() {
  SIZE = Math.min(window.innerWidth, window.innerHeight) * 0.98;
  canvas.width  = SIZE;
  canvas.height = SIZE;
  CX = SIZE / 2;
  CY = SIZE / 2;
}
resize();

// ── Polares ───────────────────────────────────────────────────
const DEG = Math.PI / 180;
function toRad(a)  { return a * DEG; }
function px(r, a)  { return CX + r * Math.cos(toRad(a - 90)); }
function py(r, a)  { return CY + r * Math.sin(toRad(a - 90)); }

// ── Raios ─────────────────────────────────────────────────────
function R() {
  const r = SIZE / 2;
  return {
    innerGlow: r * 0.14,
    finalRing: r * 0.20,
    semiRing : r * 0.28,
    qfRing   : r * 0.36,
    r16Ring  : r * 0.44,
    r32Ring  : r * 0.53,
    grpInner : r * 0.62,
    grpFlag  : r * 0.72,
    grpOuter : r * 0.83,
    grpLabel : r * 0.90,
    outer    : r * 0.99,
  };
}

// ── Paleta ────────────────────────────────────────────────────
const C = {
  bg        : '#071428',
  stroke    : '#1e3a6e',
  gold      : '#d4a017',
  goldBrt   : '#f5c540',
  white     : '#ffffff',
  dim       : 'rgba(255,255,255,0.50)',
  nodeFill  : '#1a2e55',
  nodeStroke: 'rgba(255,255,255,0.30)',
  nodeHover : '#2a4070',
  winBg     : 'rgba(30,50,90,0.97)',
  loseBg    : 'rgba(10,18,40,0.90)',
  empty     : 'rgba(255,255,255,0.08)',
};

// ── Mapa ISO ──────────────────────────────────────────────────
const ISO = {
  MEX:'mx', KSA:'sa', KOR:'kr', CZE:'cz',
  SUI:'ch', CAN:'ca', BIH:'ba', QAT:'qa',
  BRA:'br', MAR:'ma', SCO:'gb-sct', HAI:'ht',
  USA:'us', AUS:'au', PAR:'py', TUR:'tr',
  GER:'de', CIV:'ci', ECU:'ec', CUW:'cw',
  NED:'nl', JPN:'jp', SWE:'se', TUN:'tn',
  BEL:'be', EGY:'eg', IRN:'ir', NZL:'nz',
  ESP:'es', CPV:'cv', URU:'uy',
  FRA:'fr', NOR:'no', SEN:'sn', IRQ:'iq',
  ARG:'ar', ALG:'dz', TGA:'to', JOR:'jo',
  COL:'co', POR:'pt', COD:'cd', UZB:'uz',
  ENG:'gb-eng', CRO:'hr', GHA:'gh', PAN:'pa',
};

// ── Cache de imagens ──────────────────────────────────────────
const imgCache = {};
let pending = 0, renderQueued = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function getImg(abbr) {
  if (!abbr) return null;
  if (imgCache[abbr]) return imgCache[abbr];
  const iso = ISO[abbr]; if (!iso) return null;
  const im = new Image();
  im.crossOrigin = 'anonymous';
  pending++;
  im.onload  = () => { pending--; scheduleRender(); };
  im.onerror = () => { pending--; scheduleRender(); };
  im.src = `https://flagcdn.com/w40/${iso}.png`;
  return (imgCache[abbr] = im);
}

function preload() { Object.keys(ISO).forEach(getImg); }

// ── Grupos ────────────────────────────────────────────────────
const NGROUPS = 12;
const DEG_PER_GROUP = 360 / NGROUPS;

const GROUPS = [
  { name:'A', color:'#f5c540', teams:['MEX','KSA','KOR','CZE'] },
  { name:'B', color:'#e05050', teams:['SUI','CAN','BIH','QAT'] },
  { name:'C', color:'#3ab0e8', teams:['BRA','MAR','SCO','HAI'] },
  { name:'D', color:'#6bc85a', teams:['USA','AUS','PAR','TUR'] },
  { name:'E', color:'#f5c540', teams:['GER','CIV','ECU','CUW'] },
  { name:'F', color:'#e05050', teams:['NED','JPN','SWE','TUN'] },
  { name:'G', color:'#b87cd4', teams:['BEL','EGY','IRN','NZL'] },
  { name:'H', color:'#3ab0e8', teams:['ESP','CPV','URU','KSA'] },
  { name:'I', color:'#6bc85a', teams:['FRA','NOR','SEN','IRQ'] },
  { name:'J', color:'#f5c540', teams:['ARG','ALG','TGA','JOR'] },
  { name:'K', color:'#e05050', teams:['COL','POR','COD','UZB'] },
  { name:'L', color:'#3ab0e8', teams:['ENG','CRO','GHA','PAN'] },
];

// ── Estrutura do Bracket ──────────────────────────────────────
// 32 partidas nos 32-avos, distribuídas em 32 setores de 11.25°
// Cada partida tem: { t1, t2, winner, score, ang }
// Hierarquia: R32[i] → R16[i>>1] → QF[i>>2] → SF[i>>3] → FINAL

// ângulo central de cada slot por fase
// R32: 32 slots × 11.25° = 360°
// R16: 16 slots × 22.5°
// QF:   8 slots × 45°
// SF:   4 slots × 90°
// FINAL: 1 slot

const PHASE_SLOTS = { R32: 32, R16: 16, QF: 8, SF: 4, FINAL: 1 };

function slotAngle(phase, idx) {
  const n    = PHASE_SLOTS[phase];
  const step = 360 / n;
  return idx * step + step / 2;
}

// ── Estado do Bracket ─────────────────────────────────────────
// bracket[phase][idx] = { t1, t2, score1, score2, winner (1|2|null) }
let bracket = {};

function emptyBracket() {
  const b = {};
  for (const phase of Object.keys(PHASE_SLOTS)) {
    b[phase] = Array.from({ length: PHASE_SLOTS[phase] }, () => ({
      t1: null, t2: null, score1: '', score2: '', winner: null,
    }));
  }
  return b;
}

function saveBracket() {
  localStorage.setItem('wc2026_bracket', JSON.stringify(bracket));
}

function loadBracket() {
  try {
    const raw = localStorage.getItem('wc2026_bracket');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Garante que todas as fases existam (migração)
      bracket = emptyBracket();
      for (const phase of Object.keys(PHASE_SLOTS)) {
        if (parsed[phase]) {
          parsed[phase].forEach((m, i) => {
            if (bracket[phase][i]) Object.assign(bracket[phase][i], m);
          });
        }
      }
    } else {
      bracket = emptyBracket();
    }
  } catch { bracket = emptyBracket(); }
}

// Propaga vencedor de [phase][idx] para a fase seguinte
function propagate(phase, idx) {
  const m = bracket[phase][idx];
  if (!m.winner) return;
  const winner = m.winner === 1 ? m.t1 : m.t2;

  const nextPhase = { R32:'R16', R16:'QF', QF:'SF', SF:'FINAL' }[phase];
  if (!nextPhase) return;

  const nextIdx  = Math.floor(idx / 2);
  const slot     = idx % 2 === 0 ? 't1' : 't2'; // par → t1, ímpar → t2
  const next     = bracket[nextPhase][nextIdx];

  // Se o slot mudou de time, limpa o progresso daquele ramo
  if (next[slot] !== winner) {
    next[slot] = winner;
    next.score1 = ''; next.score2 = ''; next.winner = null;
    // Limpa propagação em cascata
    clearForward(nextPhase, nextIdx);
  }
  saveBracket();
}

function clearForward(phase, idx) {
  const nextPhase = { R32:'R16', R16:'QF', QF:'SF', SF:'FINAL' }[phase];
  if (!nextPhase) return;
  const nextIdx = Math.floor(idx / 2);
  const slot    = idx % 2 === 0 ? 't1' : 't2';
  const next    = bracket[nextPhase][nextIdx];
  if (next[slot]) {
    next[slot] = null;
    next.score1 = ''; next.score2 = ''; next.winner = null;
    clearForward(nextPhase, nextIdx);
  }
}

// ── Hit-test: lista de nós clicáveis ─────────────────────────
// Cada nó: { phase, idx, x, y, r }
let hitNodes = [];

function registerNode(phase, idx, x, y, r) {
  hitNodes.push({ phase, idx, x, y, r });
}

function findNode(mx, my) {
  for (let i = hitNodes.length - 1; i >= 0; i--) {
    const n = hitNodes[i];
    const d = Math.hypot(mx - n.x, my - n.y);
    if (d <= n.r * 1.8) return n;
  }
  return null;
}

// ── Helpers de desenho ────────────────────────────────────────
function ringCircle(r2, fill, strokeCol, sw = 1) {
  ctx.beginPath();
  ctx.arc(CX, CY, r2, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = strokeCol; ctx.lineWidth = sw; ctx.stroke();
}

function arcStroke(r2, a1, a2, color, lw) {
  ctx.beginPath();
  ctx.arc(CX, CY, r2, toRad(a1 - 90), toRad(a2 - 90));
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
}

function radLine(r1, r2, ang, color, lw) {
  ctx.beginPath();
  ctx.moveTo(px(r1, ang), py(r1, ang));
  ctx.lineTo(px(r2, ang), py(r2, ang));
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
}

// Nó de junção (pode ter bandeira, pode estar vazio)
// nodeSize: 'sm' = R32/R16, 'md' = QF/SF, 'lg' = FINAL
function drawNode(phase, idx, r2, ang, abbr, highlight, hoverPhase, hoverIdx, nodeSize) {
  const x = px(r2, ang), y = py(r2, ang);
  const radius = nodeSize === 'sm' ? SIZE * 0.009
               : nodeSize === 'lg' ? SIZE * 0.024
               : SIZE * 0.017;
  const isHover = hoverPhase === phase && hoverIdx === idx;

  // Registra hit-test
  registerNode(phase, idx, x, y, radius);

  ctx.save();
  ctx.translate(x, y);

  // Glow se hover
  if (isHover) {
    ctx.shadowColor = '#4af'; ctx.shadowBlur = 14;
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);

  if (abbr) {
    ctx.fillStyle = highlight ? C.winBg : C.loseBg;
  } else {
    ctx.fillStyle = isHover ? C.nodeHover : C.nodeFill;
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Bandeira ou ícone de +
  const im = abbr ? getImg(abbr) : null;
  if (im && im.complete && im.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    const bh = radius * 2;
    const bw = bh * (im.naturalWidth / im.naturalHeight);
    ctx.drawImage(im, -bw / 2, -radius, bw, bh);
    ctx.restore();
  } else if (!abbr) {
    // Ícone "+"
    ctx.strokeStyle = isHover ? '#4af' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    const s = radius * 0.45;
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
  }

  // Borda
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = highlight ? C.goldBrt
                  : isHover   ? '#4af'
                  : abbr      ? 'rgba(255,255,255,0.3)'
                  :              C.nodeStroke;
  ctx.lineWidth = highlight ? 2.5 : isHover ? 2 : 1;
  ctx.stroke();

  ctx.restore();
}

// Caixa de placar
function scoreBox(r2, ang, s1, s2, color) {
  if (!s1 && !s2) return;
  const score = s2 ? `${s1}-${s2}` : s1;
  const fs = SIZE * 0.0060;
  const bw = SIZE * 0.028;
  const bh = fs * 2.0;
  const x = px(r2, ang), y = py(r2, ang);

  ctx.save();
  ctx.translate(x, y);
  let rot = toRad(ang);
  if (ang > 90 && ang < 270) rot += Math.PI;
  ctx.rotate(rot);

  ctx.fillStyle = 'rgba(4,12,30,0.92)';
  ctx.strokeStyle = color; ctx.lineWidth = 1.4;
  rRect(ctx, -bw / 2, -bh / 2, bw, bh, 4);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = C.white;
  ctx.font = `bold ${fs}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(score, 0, 0);
  ctx.restore();
}

function rRect(c, x, y, w, h, r2) {
  c.beginPath();
  c.moveTo(x + r2, y); c.lineTo(x + w - r2, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r2);
  c.lineTo(x + w, y + h - r2);
  c.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
  c.lineTo(x + r2, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r2);
  c.lineTo(x, y + r2);
  c.quadraticCurveTo(x, y, x + r2, y);
  c.closePath();
}

// Bandeira nos grupos
function flagGroup(r2, ang, abbr, highlight, small) {
  const radius = small ? SIZE * 0.014 : SIZE * 0.018;
  const x = px(r2, ang), y = py(r2, ang);
  const im = getImg(abbr);
  ctx.save(); ctx.translate(x, y);
  if (highlight) { ctx.shadowColor = '#f5c540'; ctx.shadowBlur = 8; }
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = highlight ? C.winBg : C.loseBg; ctx.fill();
  ctx.shadowBlur = 0;
  if (im && im.complete && im.naturalWidth > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius - 1, 0, Math.PI * 2); ctx.clip();
    const bh = radius * 2, bw = bh * (im.naturalWidth / im.naturalHeight);
    ctx.drawImage(im, -bw / 2, -radius, bw, bh); ctx.restore();
  } else {
    ctx.font = `bold ${radius * 0.9}px Arial`; ctx.fillStyle = C.white;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(abbr.slice(0, 2), 0, 0);
  }
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = highlight ? C.goldBrt : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = highlight ? 2.5 : 1; ctx.stroke();
  ctx.restore();
}

function flagLabel(r2, ang, text, color) {
  const labelR = r2 + SIZE * 0.022;
  ctx.save();
  ctx.font = `bold ${SIZE * 0.011}px Arial`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, px(labelR, ang), py(labelR, ang));
  ctx.restore();
}

// ── FUNDO ─────────────────────────────────────────────────────
function drawBg(rd) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, SIZE, SIZE);
  const layers = [
    { r: rd.outer,     f: '#0f2040' },
    { r: rd.grpOuter,  f: '#0d1c38' },
    { r: rd.grpInner,  f: '#0b1a32' },
    { r: rd.r32Ring,   f: '#0d1c38' },
    { r: rd.r16Ring,   f: '#0a1830' },
    { r: rd.qfRing,    f: '#0d1c38' },
    { r: rd.semiRing,  f: '#0a1628' },
    { r: rd.finalRing, f: '#0d1c38' },
    { r: rd.innerGlow, f: '#0a1628' },
  ];
  layers.forEach(l => ringCircle(l.r, l.f, C.stroke, 1));

  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, rd.innerGlow);
  g.addColorStop(0,   'rgba(200,150,0,0.45)');
  g.addColorStop(0.6, 'rgba(180,120,0,0.12)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(CX, CY, rd.innerGlow, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
}

// ── DIVISORES ─────────────────────────────────────────────────
function drawDividers(rd) {
  for (let i = 0; i < NGROUPS; i++) {
    const a = i * DEG_PER_GROUP;
    ctx.save(); ctx.beginPath();
    ctx.moveTo(px(rd.grpInner, a), py(rd.grpInner, a));
    ctx.lineTo(px(rd.outer, a),    py(rd.outer, a));
    ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
}

// ── LABELS DOS GRUPOS ─────────────────────────────────────────
function drawGroupLabels(rd) {
  GROUPS.forEach((g, gi) => {
    const mid = gi * DEG_PER_GROUP + DEG_PER_GROUP / 2;
    const x = px(rd.grpLabel, mid), y = py(rd.grpLabel, mid);
    ctx.save(); ctx.translate(x, y);
    let rot = toRad(mid);
    if (mid > 90 && mid < 270) rot += Math.PI;
    ctx.rotate(rot);
    ctx.font = `bold ${SIZE * 0.014}px Arial`;
    ctx.fillStyle = g.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`GRUPO ${g.name}`, 0, 0);
    ctx.restore();
  });
}

// ── TIMES DOS GRUPOS ──────────────────────────────────────────
function drawGroupTeams(rd) {
  const nTimes = 4;
  const step   = DEG_PER_GROUP / (nTimes + 1);
  GROUPS.forEach((g, gi) => {
    const base = gi * DEG_PER_GROUP;
    g.teams.forEach((abbr, ti) => {
      const ang = base + step * (ti + 1);
      flagGroup(rd.grpFlag, ang, abbr, false, true);
      flagLabel(rd.grpFlag, ang, abbr, C.dim);
    });
  });
}

// ── TROFÉU ────────────────────────────────────────────────────
function drawTrophy(rd) {
  const s = rd.innerGlow * 0.52;
  ctx.save(); ctx.translate(CX, CY - s * 0.08);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
  g.addColorStop(0,   'rgba(255,200,0,0.55)');
  g.addColorStop(0.5, 'rgba(200,140,0,0.18)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  ctx.lineWidth = 2; ctx.fillStyle = C.gold; ctx.strokeStyle = C.goldBrt;
  ctx.beginPath(); rRect(ctx, -s * .38, s * .58, s * .76, s * .13, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); rRect(ctx, -s * .12, s * .26, s * .24, s * .34, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * .42, -s * .58); ctx.lineTo(-s * .42, s * .04);
  ctx.quadraticCurveTo(-s * .42, s * .28, 0, s * .28);
  ctx.quadraticCurveTo(s * .42, s * .28, s * .42, s * .04);
  ctx.lineTo(s * .42, -s * .58); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = s * .09; ctx.strokeStyle = C.goldBrt;
  [-1, 1].forEach(d => {
    ctx.beginPath();
    ctx.moveTo(d * s * .42, -s * .32);
    ctx.bezierCurveTo(d * s * .78, -s * .44, d * s * .78, s * .02, d * s * .42, s * .02);
    ctx.stroke();
  });
  ctx.fillStyle = C.goldBrt;
  (function star(x, y, ro, ri, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n - Math.PI / 2, r2 = i % 2 === 0 ? ro : ri;
      i === 0 ? ctx.moveTo(x + r2 * Math.cos(a), y + r2 * Math.sin(a))
              : ctx.lineTo(x + r2 * Math.cos(a), y + r2 * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
  })(0, -s * .72, s * .10, s * .05, 5);
  ctx.restore();

  // Campeão ou título
  const finalM = bracket.FINAL && bracket.FINAL[0];
  const champion = finalM && finalM.winner
    ? (finalM.winner === 1 ? finalM.t1 : finalM.t2) : null;

  ctx.font = `bold ${SIZE * .016}px Arial`;
  ctx.fillStyle = C.goldBrt;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(champion ? `🏆 CAMPEÃO: ${champion}` : 'FIFA WORLD CUP 2026',
    CX, CY + rd.innerGlow * 0.70);
}

// ── BRACKET INTERATIVO ────────────────────────────────────────
// Fases: R32(32) → R16(16) → QF(8) → SF(4) → FINAL(1)
// Ângulo de cada slot:  slotAngle(phase, idx)
// Raios por fase:       rFor[phase]
// Cotovelo: radLine + arcStroke entre dois raios

let hoveredNode = { phase: null, idx: null };

function renderBracket(rd) {
  hitNodes = []; // limpa a cada frame

  const rFor = {
    R32  : rd.r32Ring,
    R16  : rd.r16Ring,
    QF   : rd.qfRing,
    SF   : rd.semiRing,
    FINAL: rd.finalRing,
  };

  // Cor de cada "chave" — 8 cores para os 8 pares do R16
  // Chave = Math.floor(idx / 4) para R32, idx/2 para R16, etc.
  const keyColor = [
    '#f5c540','#3ab0e8','#6bc85a','#e05050',
    '#b87cd4','#e08020','#20c0a0','#e05080',
  ];
  function matchColor(phase, idx) {
    const depth = { R32: 2, R16: 1, QF: 0, SF: 0, FINAL: 0 }[phase] ?? 0;
    return keyColor[Math.floor(idx / Math.pow(2, depth)) % keyColor.length];
  }

  // ── R32 (32-avos) ─────────────────────────────────────────
  // 32 slots de 11.25° — 2 por grupo + 8 melhores 3os
  // Cada slot tem 2 times: angC ± 3.5°
  // Cotovelo de grpInner → r32Ring
  const rElbR32 = rd.grpInner - (rd.grpInner - rd.r32Ring) * 0.50;
  const nodeR32 = rd.grpInner - SIZE * 0.001;

  for (let i = 0; i < 32; i++) {
    const angC  = slotAngle('R32', i);
    const ang1  = angC - 3.5;
    const ang2  = angC + 3.5;
    const m     = bracket.R32[i];
    const col   = matchColor('R32', i);

    // Linhas de cotovelo
    radLine(rd.grpInner, rElbR32, ang1, col, 1.2);
    radLine(rd.grpInner, rElbR32, ang2, col, 1.2);
    arcStroke(rElbR32, ang1, ang2, col, 1.2);
    radLine(rElbR32, rd.r32Ring, angC, col, 1.2);

    // Nós dos dois times — fases exclusivas 'R32t1'/'R32t2' por partida
    const hp = hoveredNode.phase, hi = hoveredNode.idx;
    drawNode('R32t1', i, nodeR32, ang1, m.t1, m.winner === 1, hp, hi, 'sm');
    drawNode('R32t2', i, nodeR32, ang2, m.t2, m.winner === 2, hp, hi, 'sm');

    // Placar
    if (m.score1 || m.score2) scoreBox(rElbR32, angC, m.score1, m.score2, col);

    // Nó de convergência
    const winner = m.winner === 1 ? m.t1 : m.winner === 2 ? m.t2 : null;
    drawNode('R32_out', i, rd.r32Ring, angC, winner, !!winner, hp, hi, 'sm');
  }

  // ── R16 (oitavas) ─────────────────────────────────────────
  const rElbR16 = rd.r32Ring - (rd.r32Ring - rd.r16Ring) * 0.55;
  const nodeR16 = rd.r32Ring + SIZE * 0.002;

  for (let i = 0; i < 16; i++) {
    const angA = slotAngle('R32', i * 2);
    const angB = slotAngle('R32', i * 2 + 1);
    const angC = (angA + angB) / 2;
    const m    = bracket.R16[i];
    const col  = matchColor('R16', i);

    radLine(rd.r32Ring, rElbR16, angA, col, 1.6);
    radLine(rd.r32Ring, rElbR16, angB, col, 1.6);
    arcStroke(rElbR16, angA, angB, col, 1.6);
    radLine(rElbR16, rd.r16Ring, angC, col, 1.6);

    const hp = hoveredNode.phase, hi = hoveredNode.idx;
    drawNode('R16t1', i, nodeR16, angA, m.t1, m.winner === 1, hp, hi, 'sm');
    drawNode('R16t2', i, nodeR16, angB, m.t2, m.winner === 2, hp, hi, 'sm');

    if (m.score1 || m.score2) scoreBox(rElbR16, angC, m.score1, m.score2, col);

    const winner = m.winner === 1 ? m.t1 : m.winner === 2 ? m.t2 : null;
    drawNode('R16_out', i, rd.r16Ring, angC, winner, !!winner, hp, hi, 'sm');
  }

  // ── QF (quartas) ──────────────────────────────────────────
  const rElbQF = rd.r16Ring - (rd.r16Ring - rd.qfRing) * 0.55;

  for (let i = 0; i < 8; i++) {
    const angA = slotAngle('R16', i * 2);
    const angB = slotAngle('R16', i * 2 + 1);
    const angC = (angA + angB) / 2;
    const m    = bracket.QF[i];
    const col  = matchColor('QF', i);

    radLine(rd.r16Ring, rElbQF, angA, col, 2);
    radLine(rd.r16Ring, rElbQF, angB, col, 2);
    arcStroke(rElbQF, angA, angB, col, 2);
    radLine(rElbQF, rd.qfRing, angC, col, 2);

    const hp = hoveredNode.phase, hi = hoveredNode.idx;
    drawNode('QFt1', i, rd.r16Ring + SIZE * 0.002, angA, m.t1, m.winner === 1, hp, hi);
    drawNode('QFt2', i, rd.r16Ring + SIZE * 0.002, angB, m.t2, m.winner === 2, hp, hi);

    if (m.score1 || m.score2) scoreBox(rElbQF, angC, m.score1, m.score2, col);

    const winner = m.winner === 1 ? m.t1 : m.winner === 2 ? m.t2 : null;
    drawNode('QF_out', i, rd.qfRing, angC, winner, !!winner, hp, hi);
  }

  // ── SF (semifinais) ───────────────────────────────────────
  const rElbSF = rd.qfRing - (rd.qfRing - rd.semiRing) * 0.55;

  for (let i = 0; i < 4; i++) {
    const angA = slotAngle('QF', i * 2);
    const angB = slotAngle('QF', i * 2 + 1);
    const angC = (angA + angB) / 2;
    const m    = bracket.SF[i];
    const col  = matchColor('SF', i);

    radLine(rd.qfRing, rElbSF, angA, col, 2.5);
    radLine(rd.qfRing, rElbSF, angB, col, 2.5);
    arcStroke(rElbSF, angA, angB, col, 2.5);
    radLine(rElbSF, rd.semiRing, angC, col, 2.5);

    const hp = hoveredNode.phase, hi = hoveredNode.idx;
    drawNode('SFt1', i, rd.qfRing + SIZE * 0.002, angA, m.t1, m.winner === 1, hp, hi);
    drawNode('SFt2', i, rd.qfRing + SIZE * 0.002, angB, m.t2, m.winner === 2, hp, hi);

    if (m.score1 || m.score2) scoreBox(rElbSF, angC, m.score1, m.score2, col);

    const winner = m.winner === 1 ? m.t1 : m.winner === 2 ? m.t2 : null;
    drawNode('SF_out', i, rd.semiRing, angC, winner, !!winner, hp, hi);
  }

  // ── FINAL ─────────────────────────────────────────────────
  const angA  = slotAngle('SF', 0);
  const angB  = slotAngle('SF', 3); // SF[0] e SF[3] são opostos
  // As duas semis que chegam na final: SF_out[0] e SF_out[1]
  const sfAngA = (slotAngle('QF', 0) + slotAngle('QF', 1)) / 2;
  const sfAngB = (slotAngle('QF', 2) + slotAngle('QF', 3)) / 2;
  const sfAngC = slotAngle('SF', 2); // vencedor da outra metade
  const rElbFinal = rd.semiRing - (rd.semiRing - rd.finalRing) * 0.55;

  // Pega os 2 nós de saída das semis
  const sfOut0ang = (slotAngle('QF', 0) + slotAngle('QF', 1)) / 2;
  const sfOut1ang = (slotAngle('QF', 2) + slotAngle('QF', 3)) / 2;
  const sfOut2ang = (slotAngle('QF', 4) + slotAngle('QF', 5)) / 2;
  const sfOut3ang = (slotAngle('QF', 6) + slotAngle('QF', 7)) / 2;
  // SF[0] ← QF[0]+QF[1], SF[1] ← QF[2]+QF[3], SF[2] ← QF[4]+QF[5], SF[3] ← QF[6]+QF[7]
  const sfMids = [
    (sfOut0ang + sfOut1ang) / 2,
    (sfOut2ang + sfOut3ang) / 2,
  ];
  // Final: SF[0]+SF[1] vencedor vs SF[2]+SF[3] vencedor
  const sfFinalAngA = sfMids[0]; // ângulo do nó de saída SF grupo 0
  const sfFinalAngB = sfMids[1]; // ângulo do nó de saída SF grupo 1
  const finalAngC   = (sfFinalAngA + sfFinalAngB) / 2 + 
                      (Math.abs(sfFinalAngB - sfFinalAngA) > 180 ? 180 : 0);

  const mFinal = bracket.FINAL[0];

  radLine(rd.semiRing, rElbFinal, sfFinalAngA, C.goldBrt, 3);
  radLine(rd.semiRing, rElbFinal, sfFinalAngB, C.goldBrt, 3);
  arcStroke(rElbFinal, Math.min(sfFinalAngA, sfFinalAngB),
                        Math.max(sfFinalAngA, sfFinalAngB), C.goldBrt, 3);
  radLine(rElbFinal, rd.finalRing, finalAngC, C.goldBrt, 3);
  radLine(rd.finalRing, 0, finalAngC, C.goldBrt, 3);

  const hpF = hoveredNode.phase, hiF = hoveredNode.idx;
  drawNode('FINt1', 0, rd.semiRing + SIZE * 0.002, sfFinalAngA, mFinal.t1, mFinal.winner === 1, hpF, hiF, 'lg');
  drawNode('FINt2', 0, rd.semiRing + SIZE * 0.002, sfFinalAngB, mFinal.t2, mFinal.winner === 2, hpF, hiF, 'lg');

  if (mFinal.score1 || mFinal.score2)
    scoreBox(rElbFinal, finalAngC, mFinal.score1, mFinal.score2, C.goldBrt);
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
function render() {
  const rd = R();
  ctx.clearRect(0, 0, SIZE, SIZE);
  drawBg(rd);
  drawDividers(rd);
  drawGroupLabels(rd);
  drawGroupTeams(rd);
  renderBracket(rd);
  drawTrophy(rd);
}

// ── INTERAÇÃO — hover ─────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = SIZE / rect.width;
  const scaleY = SIZE / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
  const n  = findNode(mx, my);
  const newPhase = n ? n.phase : null;
  const newIdx   = n ? n.idx   : null;
  if (newPhase !== hoveredNode.phase || newIdx !== hoveredNode.idx) {
    hoveredNode = { phase: newPhase, idx: newIdx };
    canvas.style.cursor = n ? 'pointer' : 'default';
    scheduleRender();
  }
});

// ── INTERAÇÃO — clique ────────────────────────────────────────
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = SIZE / rect.width;
  const scaleY = SIZE / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
  const n  = findNode(mx, my);
  if (!n) return;
  openModal(n.phase, n.idx);
});

// ── MODAL ─────────────────────────────────────────────────────
// Resolve phase/idx para a partida e o slot (t1 ou t2)
function resolveMatch(phase, idx) {
  // Nós de time diretamente vinculados a uma partida
  const teamNodeMap = {
    'R32t1': 'R32', 'R32t2': 'R32',
    'R16t1': 'R16', 'R16t2': 'R16',
    'QFt1' : 'QF',  'QFt2' : 'QF',
    'SFt1' : 'SF',  'SFt2' : 'SF',
    'FINt1': 'FINAL','FINt2': 'FINAL',
  };
  if (teamNodeMap[phase]) {
    const mPhase = teamNodeMap[phase];
    return { phase: mPhase, idx, matchData: bracket[mPhase][idx] };
  }
  // Nós de saída (_out) abrem a partida da próxima fase
  if (phase.endsWith('_out')) {
    const basePhase = phase.replace('_out', '');
    const nextPhase = { R32:'R16', R16:'QF', QF:'SF', SF:'FINAL' }[basePhase];
    if (!nextPhase) return null;
    const nextIdx = Math.floor(idx / 2);
    return { phase: nextPhase, idx: nextIdx, matchData: bracket[nextPhase][nextIdx] };
  }
  return null;
}

function openModal(phase, idx) {
  const resolved = resolveMatch(phase, idx);
  if (!resolved) return;
  const { phase: mPhase, idx: mIdx, matchData: m } = resolved;

  // Remove modal anterior
  const old = document.getElementById('bracketModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'bracketModal';
  modal.innerHTML = buildModalHTML(mPhase, mIdx, m);
  document.body.appendChild(modal);

  // Preenche bandeiras
  ['t1', 't2'].forEach(slot => {
    const abbr = m[slot];
    if (!abbr) return;
    const im = getImg(abbr);
    if (im && im.complete) {
      const el = document.getElementById(`modal_flag_${slot}`);
      if (el) el.src = im.src;
    }
  });

  // Eventos
  document.getElementById('modalClose').onclick  = closeModal;
  document.getElementById('modalSave').onclick   = () => saveModal(mPhase, mIdx);
  document.getElementById('modalReset').onclick  = () => resetMatch(mPhase, mIdx);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Seleção de time t1
  const btnT1 = document.getElementById('modalBtnT1');
  const btnT2 = document.getElementById('modalBtnT2');
  if (btnT1) btnT1.onclick = () => openTeamPicker(mPhase, mIdx, 't1');
  if (btnT2) btnT2.onclick = () => openTeamPicker(mPhase, mIdx, 't2');
}

function buildModalHTML(phase, idx, m) {
  const phaseLabel = { R32:'32-avos', R16:'Oitavas', QF:'Quartas', SF:'Semifinal', FINAL:'Final' }[phase] || phase;
  const t1 = m.t1 || '?', t2 = m.t2 || '?';
  const w1 = m.winner === 1, w2 = m.winner === 2;

  return `
  <div id="modalBox">
    <button id="modalClose">✕</button>
    <div id="modalPhase">${phaseLabel} — Jogo ${idx + 1}</div>
    <div id="modalTeams">
      <div class="modalTeam ${w1 ? 'winner' : ''}">
        <button id="modalBtnT1" class="flagBtn">
          <img id="modal_flag_t1" src="https://flagcdn.com/w40/${ISO[t1] || 'xx'}.png" alt="${t1}" onerror="this.style.display='none'">
          <span>${t1}</span>
        </button>
        <input id="score1" type="text" placeholder="Gols" value="${m.score1 || ''}" maxlength="3">
      </div>
      <div id="modalVs">VS</div>
      <div class="modalTeam ${w2 ? 'winner' : ''}">
        <button id="modalBtnT2" class="flagBtn">
          <img id="modal_flag_t2" src="https://flagcdn.com/w40/${ISO[t2] || 'xx'}.png" alt="${t2}" onerror="this.style.display='none'">
          <span>${t2}</span>
        </button>
        <input id="score2" type="text" placeholder="Gols" value="${m.score2 || ''}" maxlength="3">
      </div>
    </div>
    <div id="modalWinnerRow">
      <span>Vencedor:</span>
      <label><input type="radio" name="winner" value="1" ${w1 ? 'checked' : ''}> ${t1}</label>
      <label><input type="radio" name="winner" value="2" ${w2 ? 'checked' : ''}> ${t2}</label>
      <label><input type="radio" name="winner" value="0" ${!m.winner ? 'checked' : ''}> —</label>
    </div>
    <div id="modalActions">
      <button id="modalReset">Limpar</button>
      <button id="modalSave">Salvar ✓</button>
    </div>
  </div>`;
}

function saveModal(phase, idx) {
  const m = bracket[phase][idx];
  m.score1 = document.getElementById('score1').value.trim();
  m.score2 = document.getElementById('score2').value.trim();

  // Vencedor automático pelo placar (se ambos preenchidos e diferentes)
  const s1 = parseInt(m.score1), s2 = parseInt(m.score2);
  const autoWinner = (!isNaN(s1) && !isNaN(s2) && s1 !== s2) ? (s1 > s2 ? 1 : 2) : null;

  // Respeita rádio manual apenas se o usuário tiver escolhido explicitamente (≠ 0/sem auto)
  const radios = document.querySelectorAll('input[name="winner"]');
  let manualWinner = null;
  radios.forEach(r => { if (r.checked) manualWinner = parseInt(r.value) || null; });

  // Prioridade: autoWinner (placar) → manualWinner (radio)
  m.winner = autoWinner !== null ? autoWinner : manualWinner;

  saveBracket();
  propagate(phase, idx);
  closeModal();
  render();
}

function resetMatch(phase, idx) {
  const m = bracket[phase][idx];
  m.score1 = ''; m.score2 = ''; m.winner = null;
  clearForward(phase, idx);
  saveBracket();
  closeModal();
  render();
}

function closeModal() {
  const el = document.getElementById('bracketModal');
  if (el) el.remove();
}

// Picker de seleção de time
function openTeamPicker(phase, idx, slot) {
  const old = document.getElementById('teamPicker');
  if (old) old.remove();

  // Monta lista de times disponíveis (todos do ISO)
  const teams = Object.keys(ISO).sort();
  const picker = document.createElement('div');
  picker.id = 'teamPicker';

  const grid = teams.map(abbr => {
    const iso = ISO[abbr];
    return `<button class="tpBtn" data-abbr="${abbr}">
      <img src="https://flagcdn.com/w40/${iso}.png" alt="${abbr}" onerror="this.style.display='none'">
      <span>${abbr}</span>
    </button>`;
  }).join('');

  picker.innerHTML = `
    <div id="tpBox">
      <div id="tpHeader">
        <input id="tpSearch" type="text" placeholder="Buscar time...">
        <button id="tpClose">✕</button>
      </div>
      <div id="tpGrid">${grid}</div>
    </div>`;
  document.body.appendChild(picker);

  document.getElementById('tpClose').onclick = () => picker.remove();
  document.getElementById('tpSearch').oninput = function () {
    const q = this.value.toUpperCase();
    document.querySelectorAll('.tpBtn').forEach(btn => {
      btn.style.display = btn.dataset.abbr.includes(q) ? '' : 'none';
    });
  };
  document.querySelectorAll('.tpBtn').forEach(btn => {
    btn.onclick = () => {
      const abbr = btn.dataset.abbr;
      bracket[phase][idx][slot] = abbr;
      bracket[phase][idx].score1 = '';
      bracket[phase][idx].score2 = '';
      bracket[phase][idx].winner = null;
      clearForward(phase, idx);
      saveBracket();
      picker.remove();

      // Atualiza o modal existente diretamente no DOM (sem fechar/reabrir)
      const flagImg  = document.getElementById(`modal_flag_${slot}`);
      const flagSpan = flagImg && flagImg.closest('.flagBtn')?.querySelector('span');
      const iso      = ISO[abbr];
      if (flagImg && iso) {
        flagImg.src = `https://flagcdn.com/w40/${iso}.png`;
        flagImg.style.display = '';
      }
      if (flagSpan) flagSpan.textContent = abbr;

      // Atualiza os radio labels para refletir o novo nome
      document.querySelectorAll('#modalWinnerRow label').forEach((label, li) => {
        const radio = label.querySelector('input[type=radio]');
        if (!radio) return;
        const val = radio.value;
        if ((val === '1' && slot === 't1') || (val === '2' && slot === 't2')) {
          // Preserva o radio, atualiza só o texto
          label.innerHTML = '';
          label.appendChild(radio);
          label.append(` ${abbr}`);
        }
      });

      render();
    };
  });
  picker.addEventListener('click', e => { if (e.target === picker) picker.remove(); });
}

// ── CSS do Modal ──────────────────────────────────────────────
const modalCSS = `
#bracketModal {
  position:fixed; inset:0; background:rgba(0,0,0,0.72);
  display:flex; align-items:center; justify-content:center; z-index:1000;
}
#modalBox {
  background:#0d1e3c; border:1px solid #2a4070; border-radius:14px;
  padding:28px 32px; min-width:320px; max-width:420px; width:90%;
  color:#fff; font-family:Arial,sans-serif; position:relative;
}
#modalClose {
  position:absolute; top:12px; right:14px; background:none; border:none;
  color:#aaa; font-size:18px; cursor:pointer;
}
#modalClose:hover { color:#fff; }
#modalPhase {
  font-size:13px; color:#7a9cc0; margin-bottom:18px; text-align:center;
  text-transform:uppercase; letter-spacing:1px;
}
#modalTeams {
  display:flex; align-items:center; gap:12px; margin-bottom:18px;
}
.modalTeam {
  flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;
}
.modalTeam.winner .flagBtn { border-color:#f5c540; box-shadow:0 0 10px #f5c54077; }
.flagBtn {
  background:#1a2e55; border:2px solid #2a4070; border-radius:50%;
  width:56px; height:56px; cursor:pointer; overflow:hidden;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  padding:0; transition:border-color .2s;
}
.flagBtn:hover { border-color:#4af; }
.flagBtn img { width:36px; height:24px; object-fit:cover; border-radius:3px; }
.flagBtn span { font-size:9px; color:#aaa; }
.modalTeam input {
  width:60px; text-align:center; background:#0a1628; border:1px solid #2a4070;
  border-radius:6px; color:#fff; font-size:15px; padding:4px 6px;
}
#modalVs { font-size:18px; color:#4a6080; font-weight:bold; }
#modalWinnerRow {
  display:flex; align-items:center; gap:14px; font-size:13px;
  color:#aaa; margin-bottom:18px; flex-wrap:wrap;
}
#modalWinnerRow label { cursor:pointer; display:flex; align-items:center; gap:4px; }
#modalWinnerRow input[type=radio] { accent-color:#f5c540; }
#modalActions { display:flex; justify-content:flex-end; gap:10px; }
#modalActions button {
  padding:8px 20px; border:none; border-radius:8px; cursor:pointer;
  font-size:13px; font-weight:bold;
}
#modalReset { background:#1a2e55; color:#aaa; }
#modalReset:hover { background:#253e65; color:#fff; }
#modalSave  { background:#d4a017; color:#000; }
#modalSave:hover { background:#f5c540; }

/* Team picker */
#teamPicker {
  position:fixed; inset:0; background:rgba(0,0,0,0.80);
  display:flex; align-items:center; justify-content:center; z-index:1100;
}
#tpBox {
  background:#0d1e3c; border:1px solid #2a4070; border-radius:14px;
  padding:20px; width:420px; max-width:95vw; max-height:80vh;
  display:flex; flex-direction:column; gap:12px;
}
#tpHeader { display:flex; gap:10px; align-items:center; }
#tpSearch {
  flex:1; background:#0a1628; border:1px solid #2a4070; border-radius:8px;
  color:#fff; padding:7px 12px; font-size:14px;
}
#tpClose { background:none; border:none; color:#aaa; font-size:18px; cursor:pointer; }
#tpClose:hover { color:#fff; }
#tpGrid {
  display:grid; grid-template-columns:repeat(5,1fr); gap:8px;
  overflow-y:auto; max-height:55vh; padding-right:4px;
}
.tpBtn {
  background:#1a2e55; border:1px solid #2a4070; border-radius:8px;
  color:#fff; font-size:10px; cursor:pointer; padding:6px 4px;
  display:flex; flex-direction:column; align-items:center; gap:3px;
  transition:border-color .15s;
}
.tpBtn:hover { border-color:#4af; background:#253e65; }
.tpBtn img { width:32px; height:21px; object-fit:cover; border-radius:2px; }
`;

const styleEl = document.createElement('style');
styleEl.textContent = modalCSS;
document.head.appendChild(styleEl);

// ── INIT ──────────────────────────────────────────────────────
loadBracket();
preload();
window.addEventListener('resize', () => { resize(); render(); });
