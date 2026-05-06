(function () {

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const scEl = document.getElementById('sc');
  const hiEl = document.getElementById('hi');
  const comboDisplay = document.getElementById('combo-display');
  const cmbEl = document.getElementById('cmb');
  const deadScore = document.getElementById('dead-score');
  const logoEl = document.getElementById('logo');

  const W = 900, H = 506;
  canvas.width = W;
  canvas.height = H;

  const GROUND_Y = H - 80;
  const BOARD_H = 10;

  let state = 'idle';
  let score, hiScore = 0, frame, speed, combo;
  let obstacles, coins, particles, trails;
  let bgOffset, mgOffset;
  let raf;

  // ── Player ─────────────────────────────────────────
  const P = {
    x: 130, y: GROUND_Y,
    vy: 0, jumps: 0, maxJumps: 2,
    w: 28, h: 52,
    grounded: true, dead: false,
    wheelAngle: 0,
    legAngle: 0, armAngle: 0,
    bodyLean: 0, squash: 1, squashV: 0,
  };

  // ── Stars ──────────────────────────────────────────
  const STARS = Array.from({ length: 100 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (H * 0.5),
    r: Math.random() * 1.6 + 0.2,
    twinkle: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.2 + 0.05,
  }));

  // ── Buildings ──────────────────────────────────────
  const BG = [], MG = [];

  function makeWins(w, h) {
    const cols = Math.max(1, Math.floor(w / 16));
    const rows = Math.max(1, Math.floor(h / 18));
    return Array.from({ length: cols * rows }, () => ({
      on: Math.random() > 0.25,
      col: ['#0ff', '#ff0', '#f0f', '#fff'][Math.floor(Math.random() * 4)],
    }));
  }

  function initBuildings() {
    BG.length = 0; MG.length = 0;
    let x = 0;
    while (x < W * 3) {
      const w = 35 + Math.random() * 70, h = 50 + Math.random() * 140;
      BG.push({ x, w, h, col: Math.random() > 0.5 ? 'rgba(0,255,255,0.06)' : 'rgba(255,0,255,0.05)', wins: makeWins(w, h) });
      x += w + 2 + Math.random() * 12;
    }
    x = 0;
    while (x < W * 3) {
      const w = 50 + Math.random() * 90, h = 80 + Math.random() * 180;
      MG.push({ x, w, h, col: Math.random() > 0.5 ? 'rgba(0,255,255,0.12)' : 'rgba(255,0,255,0.08)', wins: makeWins(w, h), sign: Math.random() > 0.6 });
      x += w + 3 + Math.random() * 18;
    }
  }

  // ── Input — attached to window so nothing blocks it ─
  let gameStarted = false;

  function doJump() {
    if (state !== 'running') return;
    if (P.jumps < P.maxJumps) {
      P.vy = P.jumps === 0 ? -16 : -13;
      P.jumps++;
      P.squash = 0.7;
      P.bodyLean = -0.25;
      spawnJumpDust();
    }
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      doJump();
    }
  });

  window.addEventListener('mousedown', e => {
    if (e.target === startBtn) return;
    doJump();
  });

  window.addEventListener('touchstart', e => {
    if (e.target === startBtn) return;
    e.preventDefault();
    doJump();
  }, { passive: false });

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    startGame();
  });

  startBtn.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    startGame();
  });

  // ── Start / End ────────────────────────────────────
  function startGame() {
    state = 'running';
    score = 0; frame = 0; speed = 5.5; combo = 1;
    obstacles = []; coins = []; particles = []; trails = [];
    bgOffset = 0; mgOffset = 0;
    P.x = 130; P.y = GROUND_Y; P.vy = 0;
    P.jumps = 0; P.grounded = true; P.dead = false;
    P.wheelAngle = 0; P.legAngle = 0; P.armAngle = 0;
    P.bodyLean = 0; P.squash = 1; P.squashV = 0;
    initBuildings();
    overlay.style.display = 'none';
    comboDisplay.classList.remove('show');
    deadScore.style.display = 'none';
    logoEl.innerHTML = 'SKATE<br><span>CITY</span>';
    logoEl.style.color = '#0ff';
    logoEl.style.textShadow = '0 0 30px #0ff, 0 0 80px rgba(0,255,255,0.3)';
    startBtn.textContent = 'DROP IN';
    if (raf) cancelAnimationFrame(raf);
    lastTime = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function endGame() {
    if (P.dead) return;
    P.dead = true;
    state = 'dead';
    if (score > hiScore) hiScore = score;
    spawnDeathBurst();
    setTimeout(() => {
      overlay.style.display = 'flex';
      logoEl.innerHTML = 'BAILED!<br><span>OOF</span>';
      logoEl.style.color = '#f50';
      logoEl.style.textShadow = '0 0 30px #f50, 0 0 80px rgba(255,80,0,0.4)';
      deadScore.style.display = 'block';
      deadScore.textContent = 'SCORE ' + Math.floor(score) + '   BEST ' + Math.floor(hiScore);
      startBtn.textContent = 'GO AGAIN';
    }, 1000);
  }

  // ── Particles ──────────────────────────────────────
  function spawnJumpDust() {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: P.x + P.w / 2 + (Math.random() - 0.5) * 20,
        y: GROUND_Y + P.h,
        vx: (Math.random() - 0.5) * 3.5,
        vy: Math.random() * 2 + 0.5,
        life: 1, decay: 0.05,
        r: Math.random() * 4 + 1,
        col: Math.random() > 0.5 ? 'rgba(0,255,255,' : 'rgba(255,255,0,',
      });
    }
  }

  function spawnLandDust() {
    for (let i = 0; i < 16; i++) {
      particles.push({
        x: P.x + P.w / 2 + (Math.random() - 0.5) * 30,
        y: GROUND_Y + P.h,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 3,
        life: 1, decay: 0.05,
        r: Math.random() * 5 + 2,
        col: 'rgba(0,255,255,',
      });
    }
  }

  function spawnDeathBurst() {
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      const spd = Math.random() * 8 + 3;
      particles.push({
        x: P.x + P.w / 2, y: P.y + P.h / 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        life: 1, decay: 0.02,
        r: Math.random() * 6 + 2,
        col: i % 3 === 0 ? 'rgba(255,0,255,' : i % 3 === 1 ? 'rgba(255,80,0,' : 'rgba(255,255,0,',
      });
    }
  }

  function spawnCoinBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        life: 1, decay: 0.04,
        r: Math.random() * 3 + 1,
        col: 'rgba(255,215,0,',
      });
    }
  }

  // ── Spawning ───────────────────────────────────────
  function spawnObstacle() {
    const r = Math.random();
    if (r < 0.35) {
      const h = 35 + Math.random() * 45;
      obstacles.push({ type: 'barrier', x: W + 30, y: GROUND_Y + P.h - h, w: 20, h, col: '#f50' });
    } else if (r < 0.6) {
      obstacles.push({ type: 'cone', x: W + 30, y: GROUND_Y + P.h - 36, w: 28, h: 36, col: '#f50' });
    } else if (r < 0.8) {
      obstacles.push({ type: 'hurdle', x: W + 30, y: GROUND_Y + P.h - 22, w: 36, h: 22, col: '#f0f' });
    } else {
      const h1 = 30 + Math.random() * 25;
      obstacles.push({ type: 'barrier', x: W + 30, y: GROUND_Y + P.h - h1, w: 18, h: h1, col: '#f50' });
      obstacles.push({ type: 'barrier', x: W + 80, y: GROUND_Y + P.h - h1 + 10, w: 18, h: h1 - 10, col: '#f50' });
    }
  }

  function spawnCoin() {
    const offsets = [0, -40, -70, -100];
    const yOff = offsets[Math.floor(Math.random() * offsets.length)];
    const count = Math.random() > 0.6 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      coins.push({ x: W + 30 + i * 28, y: GROUND_Y + P.h - 40 + yOff, r: 11, collected: false, bob: Math.random() * Math.PI * 2, rot: 0 });
    }
  }

  // ── Update ─────────────────────────────────────────
  function update() {
    if (state !== 'running') return;
    frame++;
    score += speed * 0.05;
    speed = Math.min(5.5 + Math.floor(score / 150) * 0.4, 20);

    STARS.forEach(s => { s.x -= s.speed; if (s.x < 0) s.x = W; s.twinkle += 0.03; });
    bgOffset += speed * 0.25;
    mgOffset += speed * 0.55;

    const wasGrounded = P.grounded;
    if (!P.grounded) { P.vy += 0.7; P.y += P.vy; }
    if (P.y >= GROUND_Y) {
      if (!wasGrounded) spawnLandDust();
      P.y = GROUND_Y; P.vy = 0; P.jumps = 0; P.grounded = true; P.squash = 0.78;
    } else { P.grounded = false; }

    P.squashV += (1 - P.squash) * 0.3;
    P.squashV *= 0.75;
    P.squash += P.squashV;
    P.squash = Math.max(0.7, Math.min(1.3, P.squash));
    P.bodyLean += (0 - P.bodyLean) * 0.15;

    if (P.grounded) {
      P.legAngle = Math.sin(frame * 0.28) * 0.35;
      P.armAngle = Math.sin(frame * 0.28 + Math.PI) * 0.4;
      P.wheelAngle += speed * 0.07;
    } else {
      P.legAngle += (0.3 - P.legAngle) * 0.1;
      P.armAngle += (-0.5 - P.armAngle) * 0.1;
      P.wheelAngle += 0.08;
    }

    if (P.grounded) trails.push({ x: P.x, y: P.y, life: 1, w: P.w, h: P.h });
    trails.forEach(t => { t.life -= 0.12; t.x -= speed * 0.3; });
    trails = trails.filter(t => t.life > 0);

    const gap = Math.max(50, 110 - score * 0.035);
    if (frame % Math.max(20, Math.floor(gap + Math.random() * 60)) === 0) spawnObstacle();
    if (frame % 80 === 0) spawnCoin();

    obstacles.forEach(o => { o.x -= speed; });
    obstacles = obstacles.filter(o => o.x > -80);
    coins.forEach(c => { c.x -= speed; c.bob += 0.06; c.rot += 0.05; });
    coins = coins.filter(c => c.x > -40);

    const pr = { x: P.x + 5, y: P.y + 4, w: P.w - 10, h: P.h - 4 };
    for (const o of obstacles) {
      if (rectsOverlap(pr, { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 6 })) { endGame(); return; }
    }

    coins.forEach(c => {
      if (!c.collected) {
        const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
        if (Math.hypot(cx - c.x, cy - c.y) < c.r + 18) {
          c.collected = true; score += 50;
          combo = Math.min(combo + 1, 12);
          spawnCoinBurst(c.x, c.y);
        }
      }
    });
    coins = coins.filter(c => !c.collected);
    if (frame % 200 === 0 && combo > 1) combo--;

    if (combo > 1) { comboDisplay.classList.add('show'); cmbEl.textContent = combo; }
    else comboDisplay.classList.remove('show');

    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.97; p.life -= p.decay; });
    particles = particles.filter(p => p.life > 0);
  }

  // ── Draw ───────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawStars();
    drawMoon();
    drawBgBuildings();
    drawMgBuildings();
    drawGround();
    coins.forEach(drawCoin);
    obstacles.forEach(drawObstacle);
    drawTrails();
    if (!P.dead) drawPlayer();
    drawParticles();
    drawHUD();
    scEl.textContent = Math.floor(score);
    hiEl.textContent = Math.floor(hiScore);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#02020a');
    g.addColorStop(0.6, '#05050f');
    g.addColorStop(1, '#080818');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);
  }

  function drawStars() {
    STARS.forEach(s => {
      const a = 0.35 + Math.sin(s.twinkle) * 0.35;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
      if (s.r > 1.2) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${a * 0.15})`; ctx.fill();
      }
    });
  }

  function drawMoon() {
    const mx = W - 100, my = 55;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
    mg.addColorStop(0, 'rgba(255,255,220,0.08)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, 60, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx, my, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,220,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 12, my - 6, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#05050f'; ctx.fill();
  }

  function drawBgBuildings() {
    const total = BG.reduce((s, b) => s + b.w + 10, 0) || W;
    BG.forEach(b => {
      let bx = b.x - (bgOffset * 0.2) % total;
      while (bx > W + 100) bx -= total;
      while (bx < -b.w - 10) bx += total;
      const by = GROUND_Y - b.h;
      ctx.fillStyle = '#060610'; ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = b.col; ctx.lineWidth = 1; ctx.strokeRect(bx, by, b.w, b.h);
      const cols = Math.max(1, Math.floor(b.w / 16));
      b.wins.forEach((w, i) => {
        if (!w.on) return;
        const c = i % cols, r = Math.floor(i / cols);
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.015 + i) * 0.25;
        ctx.fillStyle = w.col;
        ctx.fillRect(bx + 3 + c * 16, by + 3 + r * 18, 9, 10);
      });
      ctx.globalAlpha = 1;
    });
  }

  function drawMgBuildings() {
    const total = MG.reduce((s, b) => s + b.w + 12, 0) || W;
    MG.forEach(b => {
      let bx = b.x - (mgOffset * 0.45) % total;
      while (bx > W + 100) bx -= total;
      while (bx < -b.w - 12) bx += total;
      const by = GROUND_Y - b.h;
      ctx.fillStyle = '#080814'; ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = b.col; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, b.w, b.h);
      const cols = Math.max(1, Math.floor(b.w / 18));
      b.wins.forEach((w, i) => {
        if (!w.on) return;
        const c = i % cols, r = Math.floor(i / cols);
        ctx.globalAlpha = 0.55 + Math.sin(frame * 0.018 + i) * 0.3;
        ctx.fillStyle = w.col;
        ctx.fillRect(bx + 4 + c * 18, by + 4 + r * 20, 11, 13);
      });
      ctx.globalAlpha = 1;
      if (b.sign) {
        ctx.shadowColor = '#f0f'; ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(255,0,255,0.7)'; ctx.lineWidth = 2;
        ctx.strokeRect(bx + b.w * 0.15, by + 8, b.w * 0.7, 18);
        ctx.shadowBlur = 0;
      }
    });
  }

  function drawGround() {
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, GROUND_Y + P.h, W, H - (GROUND_Y + P.h));
    ctx.save();
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 20;
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + P.h); ctx.lineTo(W, GROUND_Y + P.h); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
    ctx.strokeStyle = 'rgba(0,255,255,0.15)'; ctx.lineWidth = 1;
    const sp = 55, off = (frame * speed * 0.5) % sp;
    for (let i = 0; i < W / sp + 2; i++) {
      const lx = i * sp - off;
      ctx.beginPath(); ctx.moveTo(lx, GROUND_Y + P.h); ctx.lineTo(lx, H); ctx.stroke();
    }
    const gg = ctx.createLinearGradient(0, GROUND_Y + P.h, 0, H);
    gg.addColorStop(0, 'rgba(0,255,255,0.05)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, GROUND_Y + P.h, W, H - (GROUND_Y + P.h));
  }

  function drawTrails() {
    trails.forEach(t => {
      ctx.globalAlpha = t.life * 0.18;
      ctx.strokeStyle = '#0ff'; ctx.lineWidth = 1;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    });
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const cx = P.x + P.w / 2;
    const cy = P.y + P.h / 2;
    const sx = P.squash > 1 ? P.squash : 1;
    const sy = P.squash < 1 ? P.squash : (2 - P.squash);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(P.bodyLean);
    ctx.scale(sx, sy);
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 22;

    // Torso
    const tw = P.w, th = P.h * 0.38;
    ctx.fillStyle = '#080820'; ctx.fillRect(-tw / 2, -th / 2, tw, th);
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2; ctx.strokeRect(-tw / 2, -th / 2, tw, th);
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-tw / 2 + 4, -th / 2 + 4, tw - 8, th - 8);

    // Head
    const hw = 22, hh = 20;
    ctx.fillStyle = '#080820'; ctx.fillRect(-hw / 2, -th / 2 - hh - 2, hw, hh);
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2; ctx.strokeRect(-hw / 2, -th / 2 - hh - 2, hw, hh);
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-hw / 2 + 4, -th / 2 - hh - 2); ctx.lineTo(hw / 2 - 4, -th / 2 - hh - 2); ctx.stroke();

    // Visor
    ctx.fillStyle = '#ff0'; ctx.shadowColor = '#ff0'; ctx.shadowBlur = 12;
    ctx.fillRect(-hw / 2 + 3, -th / 2 - hh + 4, hw - 6, 6);
    ctx.shadowColor = '#0ff'; ctx.shadowBlur = 22;

    // Arms
    const kick = P.armAngle;
    ctx.strokeStyle = '#f0f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.save(); ctx.translate(-tw / 2, -th / 2 + 6); ctx.rotate(kick - 0.3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, 18); ctx.stroke();
    ctx.beginPath(); ctx.arc(-10, 18, 4, 0, Math.PI * 2); ctx.fillStyle = '#f0f'; ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(tw / 2, -th / 2 + 6); ctx.rotate(-kick + 0.3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 18); ctx.stroke();
    ctx.beginPath(); ctx.arc(10, 18, 4, 0, Math.PI * 2); ctx.fillStyle = '#f0f'; ctx.fill();
    ctx.restore();

    // Lower body
    ctx.fillStyle = '#080820'; ctx.fillRect(-tw / 2, th / 2 - 4, tw, P.h * 0.28);
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2; ctx.strokeRect(-tw / 2, th / 2 - 4, tw, P.h * 0.28);

    // Legs
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.save(); ctx.translate(-tw / 4, th / 2 + P.h * 0.28 - 6); ctx.rotate(P.legAngle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.stroke();
    ctx.fillStyle = '#0ff'; ctx.shadowColor = '#0ff'; ctx.shadowBlur = 8;
    ctx.fillRect(-6, 14, 14, 6); ctx.restore();

    ctx.save(); ctx.translate(tw / 4, th / 2 + P.h * 0.28 - 6); ctx.rotate(-P.legAngle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.stroke();
    ctx.fillStyle = '#0ff'; ctx.shadowColor = '#0ff'; ctx.shadowBlur = 8;
    ctx.fillRect(-6, 14, 14, 6); ctx.restore();

    ctx.shadowBlur = 0;
    ctx.restore();

    drawBoard();
  }

  function drawBoard() {
    const bx = P.x + P.w / 2;
    const by = P.y + P.h + BOARD_H / 2;
    ctx.save();
    ctx.translate(bx, by);
    if (!P.grounded) ctx.rotate(Math.sin(frame * 0.1) * 0.08);
    ctx.shadowColor = '#ff0'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#1a1800';
    ctx.beginPath();
    ctx.roundRect(-26, -5, 52, 10, 4);
    ctx.fill();
    ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,0,0.35)'; ctx.lineWidth = 1;
    for (let i = -20; i < 24; i += 7) {
      ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i + 4, 5); ctx.stroke();
    }
    ctx.fillStyle = '#555';
    ctx.fillRect(-22, 3, 8, 4); ctx.fillRect(14, 3, 8, 4);
    [[-16, 6], [16, 6]].forEach(([wx, wy]) => {
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(P.wheelAngle);
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#111'; ctx.fill();
      ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,255,255,0.7)'; ctx.lineWidth = 1.5;
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0ff'; ctx.fill();
      ctx.restore();
    });
    if (speed > 10 && P.grounded) {
      ctx.globalAlpha = 0.25;
      [[-16, 6], [16, 6]].forEach(([wx, wy]) => {
        ctx.beginPath(); ctx.arc(wx, wy, 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#0ff'; ctx.lineWidth = 4; ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    ctx.shadowColor = o.col; ctx.shadowBlur = 24;
    if (o.type === 'barrier') {
      ctx.fillStyle = '#150800'; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = o.col; ctx.lineWidth = 2.5; ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
      ctx.strokeStyle = 'rgba(255,150,0,0.4)'; ctx.lineWidth = 6;
      for (let i = -o.h; i < o.w + o.h; i += 14) {
        ctx.beginPath(); ctx.moveTo(o.x + i, o.y); ctx.lineTo(o.x + i + o.h, o.y + o.h); ctx.stroke();
      }
      ctx.restore();
    } else if (o.type === 'cone') {
      ctx.fillStyle = '#200800';
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = o.col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4;
      const sy = o.y + o.h * 0.5, sw = (o.w / o.h) * (o.h * 0.5);
      ctx.beginPath(); ctx.moveTo(o.x + o.w / 2 - sw / 2, sy); ctx.lineTo(o.x + o.w / 2 + sw / 2, sy); ctx.stroke();
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    } else if (o.type === 'hurdle') {
      ctx.fillStyle = '#150018'; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = o.col; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = o.col;
      ctx.fillRect(o.x, o.y, 4, o.h); ctx.fillRect(o.x + o.w - 4, o.y, 4, o.h);
      ctx.strokeStyle = o.col; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(o.x, o.y + 4); ctx.lineTo(o.x + o.w, o.y + 4); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawCoin(c) {
    const by = c.y + Math.sin(c.bob) * 6;
    ctx.save(); ctx.translate(c.x, by); ctx.rotate(c.rot);
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1200'; ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, c.r - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 0);
    ctx.shadowBlur = 0; ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.col + p.life + ')'; ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    const bw = 140, bh = 5, bx = W / 2 - bw / 2, by = H - 18;
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, by, bw, bh);
    const pct = Math.min((speed - 5.5) / 14.5, 1);
    if (pct > 0) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#0ff'); g.addColorStop(0.5, '#f0f'); g.addColorStop(1, '#ff0');
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw * pct, bh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px Share Tech Mono';
    ctx.textAlign = 'center'; ctx.fillText('SPEED', W / 2, by - 4);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ── Loop ───────────────────────────────────────────
  let lastTime = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;
    update();
    draw();
    if (state === 'running' || (state === 'dead' && particles.length > 0)) {
      raf = requestAnimationFrame(loop);
    }
  }

  // Init idle draw
  initBuildings();
  draw();

})();
