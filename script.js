const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayTitle = document.getElementById('overlay-title');
const scEl = document.getElementById('sc');
const hiEl = document.getElementById('hi');
const comboDisplay = document.getElementById('combo-display');
const cmbEl = document.getElementById('cmb');
const deadScore = document.getElementById('dead-score');

const W = 800, H = 420;
canvas.width = W;
canvas.height = H;

const GROUND = H - 70;

// Game state
let state = 'idle';
let score = 0, hiScore = 0, frame = 0, speed = 5, combo = 1;
let lastTime = 0;
let obstacles = [], coins = [], particles = [];
let buildingOffset = 0;

// Stars
const stars = Array.from({ length: 80 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (H * 0.55),
  r: Math.random() * 1.5 + 0.3,
  blink: Math.random() * Math.PI * 2,
  speed: Math.random() * 0.3 + 0.1,
}));

// Buildings
const buildings = [];
function initBuildings() {
  buildings.length = 0;
  let x = 0;
  while (x < W * 2.5) {
    const w = 40 + Math.random() * 80;
    const h = 60 + Math.random() * 160;
    const cols = Math.floor(w / 18);
    const rows = Math.floor(h / 20);
    buildings.push({
      x, w, h,
      color: Math.random() > 0.5 ? 'rgba(0,255,255,0.08)' : 'rgba(255,0,255,0.08)',
      windows: Array.from({ length: cols * rows }, () => ({
        on: Math.random() > 0.3,
        color: Math.random() > 0.5 ? '#0ff' : '#ff0',
      }))
    });
    x += w + 4 + Math.random() * 20;
  }
}

// Player
const player = {
  x: 110, y: GROUND,
  vy: 0, jumps: 0, maxJumps: 2,
  w: 34, h: 46,
  dead: false,
  grounded: true,
  wheelRot: 0,
  trailParts: [],
};

function resetPlayer() {
  player.y = GROUND;
  player.vy = 0;
  player.jumps = 0;
  player.dead = false;
  player.grounded = true;
  player.wheelRot = 0;
  player.trailParts = [];
}

function startGame() {
  state = 'running';
  score = 0; frame = 0; speed = 5; combo = 1;
  obstacles = []; coins = []; particles = [];
  buildingOffset = 0;
  resetPlayer();
  initBuildings();
  overlay.style.display = 'none';
  comboDisplay.style.opacity = '0';
  overlayTitle.innerHTML = 'SKATE<br>CITY';
  overlayTitle.style.color = '#0ff';
  overlayTitle.style.textShadow = '0 0 20px #0ff, 0 0 60px rgba(0,255,255,0.4)';
  deadScore.style.display = 'none';
  startBtn.textContent = 'DROP IN';
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function jump() {
  if (state !== 'running') return;
  if (player.jumps < player.maxJumps) {
    player.vy = -14;
    player.jumps++;
    spawnJumpParticles();
  }
}

// Input
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
});

let touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchStartY = e.touches[0].clientY;
  jump();
}, { passive: false });

startBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchend', e => { e.preventDefault(); startGame(); });

// Particles
function spawnJumpParticles() {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: player.x + player.w / 2,
      y: player.y + player.h,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1,
      life: 1,
      color: Math.random() > 0.5 ? '#0ff' : '#ff0',
      r: Math.random() * 3 + 1,
    });
  }
}

function spawnDeathParticles(x, y) {
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const spd = Math.random() * 7 + 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 3,
      life: 1,
      color: i % 2 === 0 ? '#f0f' : '#f50',
      r: Math.random() * 4 + 2,
    });
  }
}

function spawnCoinParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4 - 2,
      life: 1,
      color: '#ff0',
      r: Math.random() * 2 + 1,
    });
  }
}

function spawnObstacle() {
  const types = ['barrier', 'cone', 'low'];
  const t = types[Math.floor(Math.random() * types.length)];
  if (t === 'barrier') {
    const h = 30 + Math.random() * 40;
    obstacles.push({ type: 'barrier', x: W + 20, y: GROUND + player.h - h, w: 22, h, color: '#f50' });
  } else if (t === 'cone') {
    obstacles.push({ type: 'cone', x: W + 20, y: GROUND + player.h - 30, w: 24, h: 30, color: '#f50' });
  } else {
    obstacles.push({ type: 'low', x: W + 20, y: GROUND + player.h - 18, w: 32, h: 18, color: '#f0f' });
  }
}

function spawnCoin() {
  const y = GROUND + player.h - 55 - Math.random() * 55;
  coins.push({ x: W + 20, y, r: 10, collected: false, bob: Math.random() * Math.PI * 2 });
}

// Draw
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#050508');
  sky.addColorStop(1, '#0a0a18');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  stars.forEach(s => {
    s.blink += 0.02;
    const alpha = 0.4 + Math.sin(s.blink) * 0.3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  });

  // Moon
  ctx.beginPath();
  ctx.arc(W - 80, 50, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 68, 44, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#050508';
  ctx.fill();
}

function drawBuildings() {
  buildings.forEach(b => {
    let bx = (b.x - buildingOffset * 0.28) % (W * 2.5);
    if (bx > W + 200) bx -= W * 2.5 + 200;
    const by = GROUND - b.h;

    ctx.fillStyle = '#080812';
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, b.w, b.h);

    const cols = Math.floor(b.w / 18);
    const rows = Math.floor(b.h / 20);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wi = r * cols + c;
        if (wi < b.windows.length && b.windows[wi].on) {
          ctx.globalAlpha = 0.6 + Math.sin(frame * 0.02 + wi) * 0.25;
          ctx.fillStyle = b.windows[wi].color;
          ctx.fillRect(bx + 4 + c * 18, by + 4 + r * 20, 10, 12);
          ctx.globalAlpha = 1;
        }
      }
    }
  });
}

function drawGround() {
  ctx.fillStyle = '#080812';
  ctx.fillRect(0, GROUND + player.h, W, H - (GROUND + player.h));

  ctx.beginPath();
  ctx.moveTo(0, GROUND + player.h);
  ctx.lineTo(W, GROUND + player.h);
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grid lines
  ctx.strokeStyle = 'rgba(0,255,255,0.12)';
  ctx.lineWidth = 1;
  const spacing = 60;
  const offset = (frame * speed * 0.5) % spacing;
  for (let i = 0; i < 10; i++) {
    const lx = (i * spacing - offset + spacing * 2) % (spacing * 10);
    ctx.beginPath();
    ctx.moveTo(lx, GROUND + player.h);
    ctx.lineTo(lx, H);
    ctx.stroke();
  }

  // Ground glow
  const grd = ctx.createLinearGradient(0, GROUND + player.h, 0, H);
  grd.addColorStop(0, 'rgba(0,255,255,0.04)');
  grd.addColorStop(1, 'rgba(0,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, GROUND + player.h, W, H - (GROUND + player.h));
}

function drawPlayer() {
  const px = player.x;
  const py = player.y;
  const w = player.w;
  const h = player.h;
  const bob = player.grounded ? Math.sin(frame * 0.15) * 2 : 0;

  // Trail
  player.trailParts.forEach(t => {
    ctx.globalAlpha = t.life * 0.35;
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(t.x, t.y + bob, w, h);
    ctx.globalAlpha = 1;
    t.life -= 0.1;
  });
  player.trailParts = player.trailParts.filter(t => t.life > 0);
  if (state === 'running' && player.grounded) {
    player.trailParts.push({ x: px - 8, y: py, life: 0.5 });
  }

  ctx.save();
  ctx.translate(px + w / 2, py + h / 2 + bob);
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 18;

  // Body
  ctx.fillStyle = '#080820';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  // Chest stripe
  ctx.strokeStyle = '#f0f';
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2 + 4, -h / 2 + 6, w - 8, h * 0.44);

  // Head
  ctx.fillStyle = '#080820';
  ctx.fillRect(-9, -h / 2 - 17, 18, 17);
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -h / 2 - 17, 18, 17);

  // Visor
  ctx.fillStyle = '#ff0';
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 10;
  ctx.fillRect(-7, -h / 2 - 13, 14, 5);

  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 10;

  // Arms
  const kick = Math.sin(frame * 0.2) * 8 * (player.grounded ? 1 : 0.3);
  ctx.strokeStyle = '#f0f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2 + 14);
  ctx.lineTo(-w / 2 - 10, -h / 2 + 22 + kick);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2, -h / 2 + 14);
  ctx.lineTo(w / 2 + 8, -h / 2 + 20 - kick);
  ctx.stroke();

  // Legs
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-w / 4, h / 2 - 8);
  ctx.lineTo(-w / 4, h / 2 + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 4, h / 2 - 8);
  ctx.lineTo(w / 4, h / 2 + 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  drawBoard(px, py + h + bob);
}

function drawBoard(px, py) {
  ctx.save();
  ctx.translate(px + player.w / 2, py);
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 14;

  // Deck
  ctx.fillStyle = '#1a1a00';
  ctx.fillRect(-22, -6, 44, 8);
  ctx.strokeStyle = '#ff0';
  ctx.lineWidth = 2;
  ctx.strokeRect(-22, -6, 44, 8);

  // Grip tape
  ctx.strokeStyle = 'rgba(255,255,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = -16; i < 20; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -6);
    ctx.lineTo(i + 3, 2);
    ctx.stroke();
  }

  // Wheels
  player.wheelRot += player.grounded ? speed * 0.08 : 0.05;
  [[-14, 4], [14, 4]].forEach(([wx, wy]) => {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(player.wheelRot);
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,255,255,0.6)';
    ctx.lineWidth = 1;
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.restore();
  });

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 20;

  if (o.type === 'barrier' || o.type === 'low') {
    ctx.fillStyle = '#180800';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = 'rgba(255,100,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < o.h; i += 10) {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + i);
      ctx.lineTo(o.x + o.w, o.y + i + 8);
      ctx.stroke();
    }
  } else if (o.type === 'cone') {
    ctx.fillStyle = '#200800';
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x + 6, o.y + o.h * 0.55);
    ctx.lineTo(o.x + o.w - 6, o.y + o.h * 0.55);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCoin(coin) {
  coin.bob += 0.05;
  const by = coin.y + Math.sin(coin.bob) * 5;
  ctx.save();
  ctx.shadowColor = '#ff0';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(coin.x, by, coin.r, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1400';
  ctx.fill();
  ctx.strokeStyle = '#ff0';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#ff0';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', coin.x, by);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawHUD() {
  scEl.textContent = Math.floor(score);
  hiEl.textContent = Math.floor(hiScore);

  if (combo > 1) {
    comboDisplay.style.opacity = '1';
    cmbEl.textContent = combo;
  } else {
    comboDisplay.style.opacity = '0';
  }

  // Speed bar
  const bw = 120, bh = 6;
  const bx = W / 2 - bw / 2;
  const by = H - 22;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(bx, by, bw, bh);
  const spd = Math.min((speed - 5) / 13, 1);
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  grad.addColorStop(0, '#0ff');
  grad.addColorStop(0.5, '#f0f');
  grad.addColorStop(1, '#ff0');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw * spd, bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px Share Tech Mono';
  ctx.textAlign = 'center';
  ctx.fillText('SPEED', W / 2, by - 4);
}

function getPlayerRect() {
  return { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 4 };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function die() {
  if (state === 'dead' || player.dead) return;
  player.dead = true;
  state = 'dead';
  if (score > hiScore) hiScore = score;
  spawnDeathParticles(player.x + player.w / 2, player.y + player.h / 2);

  setTimeout(() => {
    overlay.style.display = 'flex';
    deadScore.style.display = 'block';
    deadScore.textContent = `SCORE: ${Math.floor(score)}   BEST: ${Math.floor(hiScore)}`;
    startBtn.textContent = 'SKATE AGAIN';
    overlayTitle.textContent = 'BAILED!';
    overlayTitle.style.color = '#f50';
    overlayTitle.style.textShadow = '0 0 20px #f50, 0 0 60px rgba(255,80,0,0.4)';
  }, 900);
}

function update() {
  if (state !== 'running') return;
  frame++;
  score += speed * 0.05;
  speed = Math.min(5 + Math.floor(score / 200) * 0.5, 18);

  stars.forEach(s => { s.x -= s.speed; if (s.x < 0) s.x = W; });
  buildingOffset += speed * 0.4;

  // Physics
  if (!player.grounded) {
    player.vy += 0.62;
    player.y += player.vy;
  }
  if (player.y >= GROUND) {
    player.y = GROUND;
    player.vy = 0;
    player.jumps = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  // Spawn
  const gap = Math.max(55, 115 - score * 0.04);
  if (frame % Math.floor(gap + Math.random() * 75) === 0) spawnObstacle();
  if (frame % 88 === 0) spawnCoin();

  // Move
  obstacles.forEach(o => { o.x -= speed; });
  obstacles = obstacles.filter(o => o.x > -100);
  coins.forEach(c => { c.x -= speed; });
  coins = coins.filter(c => c.x > -50);

  // Collisions
  const pr = getPlayerRect();
  for (const o of obstacles) {
    if (rectsOverlap(pr, { x: o.x, y: o.y, w: o.w, h: o.h })) { die(); return; }
  }
  coins.forEach(c => {
    if (!c.collected && Math.hypot(pr.x + pr.w / 2 - c.x, pr.y + pr.h / 2 - c.y) < c.r + 16) {
      c.collected = true;
      score += 50;
      combo = Math.min(combo + 1, 10);
      spawnCoinParticles(c.x, c.y);
    }
  });
  coins = coins.filter(c => !c.collected);
  if (frame % 180 === 0 && combo > 1) combo--;

  // Particles
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.03;
  });
  particles = particles.filter(p => p.life > 0);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawBuildings();
  drawGround();
  coins.forEach(drawCoin);
  obstacles.forEach(drawObstacle);
  if (!player.dead) drawPlayer();
  drawParticles();
  drawHUD();
}

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  update();
  draw();
  if (state === 'running' || (state === 'dead' && particles.length > 0)) {
    requestAnimationFrame(loop);
  }
}

// Initial idle draw
draw();
