// Virgen Jump - simple endless runner (Dino-like)
(function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  // Ensure canvas focuses to receive keyboard events on mobile with external keyboards
  canvas.setAttribute('tabindex', '0');
  // Responsive canvas sizing
  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const displayWidth = Math.min(canvas.clientWidth || 800, window.innerWidth);
    const desiredWidth = Math.floor(displayWidth * ratio);
    const desiredHeight = Math.floor((300/800) * desiredWidth); // keep 800x300 aspect
    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
      state.groundY = canvas.height - Math.floor(58 * ratio);
      // scale character size with ratio to keep consistent on high-DPI
      const baseScale = desiredWidth / (800 * ratio);
      state.character.w = Math.floor(70 * ratio * baseScale);
      state.character.h = Math.floor(76 * ratio * baseScale);
      state.character.y = state.groundY - state.character.h;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const playBtn = document.getElementById('playBtn');
  const intro = document.getElementById('intro');
  const game = document.getElementById('game');
  const scoreText = document.getElementById('scoreText');
  const overlay = document.getElementById('gameOverlay');
  const finalTimeEl = document.getElementById('finalTime');
  const finalScoreText = document.getElementById('finalScore');
  const retryBtn = document.getElementById('retryBtn');
  const submitForm = document.getElementById('submitForm');
  const tweetLink = document.getElementById('tweetLink');
  // character is loaded from /assets/character.png (uploads disabled)

  let characterImage = null;
  let characterImageLoaded = false;
  // Load default asset (no upload)
  (function loadDefaultCharacter() {
    const img = new Image();
    img.onload = () => {
      characterImage = img;
      characterImageLoaded = true;
    };
    img.onerror = () => {};
    img.src = '/assets/character.png';
  })();

  // Game state (tuned like Chrome Dino)
  const state = {
    running: false,
    score: 0,
    speed: 4.6,
    gravity: 0.6,
    jumpVelocity: -12.5,
    groundY: canvas.height - 58,
    character: { x: 60, y: 0, w: 70, h: 76, vy: 0, onGround: true },
    obstacles: [],
    clouds: [],
    lastSpawn: 0,
    lastCloud: 0,
    spawnCooldownMs: 0,
    elapsedMs: 0,
    jumpPressed: false,
    jumpHoldMs: 0,
    maxJumpHoldMs: 160,
  };
  state.character.y = state.groundY - state.character.h;

  function resetGame() {
    state.running = true;
    state.score = 0;
    state.speed = 4.6;
    state.obstacles = [];
    state.lastSpawn = 0;
    state.spawnCooldownMs = 0;
    state.elapsedMs = 0;
    state.jumpPressed = false;
    state.jumpHoldMs = 0;
    state.character.y = state.groundY - state.character.h;
    state.character.vy = 0;
    state.character.onGround = true;
    lastTime = performance.now();
    loop(lastTime);
  }

  // Controls
  function jump() {
    if (!state.running) return;
    if (state.character.onGround) {
      state.character.vy = state.jumpVelocity;
      state.character.onGround = false;
      state.jumpHoldMs = 0;
      state.jumpPressed = true;
    }
  }

  function duck(pressed) {
    // Simple duck: reduce height while on ground
    const c = state.character;
    if (pressed && c.onGround) {
      c.h = 52;
      c.y = state.groundY - c.h;
    } else if (c.onGround) {
      c.h = 76;
      c.y = state.groundY - c.h;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state.character.onGround) jump();
      state.jumpPressed = true;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      duck(true);
    }
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      duck(false);
    }
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      state.jumpPressed = false;
    }
  }, { passive: false });
  function pressStart(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (state.character.onGround) jump();
    state.jumpPressed = true;
  }
  function pressEnd(e) {
    if (e && e.preventDefault) e.preventDefault();
    state.jumpPressed = false;
  }
  // Attach unified input handlers (pointer preferred)
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
  if (supportsPointer) {
    canvas.addEventListener('pointerdown', pressStart, { passive: false, capture: true });
    canvas.addEventListener('pointerup', pressEnd, { passive: true, capture: true });
    canvas.addEventListener('pointercancel', pressEnd, { passive: true, capture: true });
  }
  canvas.addEventListener('touchstart', pressStart, { passive: false, capture: true });
  canvas.addEventListener('touchend', pressEnd, { passive: true, capture: true });
  canvas.addEventListener('mousedown', pressStart, { passive: false, capture: true });
  canvas.addEventListener('mouseup', pressEnd, { passive: true, capture: true });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true });

  // Rendering
  function drawBackground() {
    // Ground baseline
    ctx.strokeStyle = '#535353';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, state.groundY);
    ctx.lineTo(canvas.width, state.groundY);
    ctx.stroke();

    // Ground dots moving left
    ctx.fillStyle = '#9e9e9e';
    const offset = (performance.now() * 0.12) % 48;
    for (let i = -offset; i < canvas.width; i += 48) {
      const y = state.groundY + 6 + ((i / 48) % 2 ? 2 : -2);
      ctx.fillRect(i, y, 8, 2);
    }

    // Clouds
    ctx.fillStyle = '#cfcfcf';
    for (const cl of state.clouds) {
      ctx.fillRect(cl.x, cl.y, cl.w, 6);
      ctx.fillRect(cl.x + 10, cl.y - 4, cl.w * 0.6, 6);
    }
  }

  function drawCharacter() {
    const c = state.character;
    if (characterImageLoaded && characterImage) {
      ctx.drawImage(characterImage, c.x, c.y, c.w, c.h);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }
  }

  function spawnObstacle(timestamp) {
    // dynamic cooldown: starts easy, speeds up gradually
    const targetCooldown = computeSpawnCooldown();
    if (state.spawnCooldownMs > 0) {
      state.spawnCooldownMs -= (timestamp - state.lastSpawn);
      state.lastSpawn = timestamp;
      return;
    }
    state.lastSpawn = timestamp;
    state.spawnCooldownMs = targetCooldown;

    // Signboard obstacle with "DUMP" text
    const difficulty = getDifficultyFactor();
    const postH = (24 + Math.random() * 10) + difficulty * 4; // min height rises over time
    const boardW = 44 + Math.random() * 12; // keep width relatively stable
    // sometimes short signboard
    const boardH = Math.random() < 0.45 ? 16 : 24;
    // spacing (kept for future use)
    const gapX = 16 + Math.random() * 12;
    const yBase = state.groundY;
    const makeSign = (x0) => ({
      type: 'sign',
      x: x0,
      postH,
      boardW,
      boardH,
      yTop: yBase - postH - boardH,
      passed: false,
      w: boardW,
      h: postH + boardH,
    });
    const xStart = canvas.width + 30;
    // Base sign
    state.obstacles.push(makeSign(xStart));

    // Phase-based clustering
    const phase = getPhase();
    const { probability, maxExtras, gapFactor } = getClusterConfig(phase);
    if (Math.random() < probability && maxExtras > 0) {
      const baseGap = computeJumpGapPixels();
      const gap = baseGap * gapFactor;
      const extras = 1 + Math.floor(Math.random() * maxExtras); // 1..maxExtras
      for (let i = 0; i < extras; i++) {
        const prev = state.obstacles[state.obstacles.length - 1];
        const jitter = (Math.random() * 12 - 6);
        const nx = prev.x + prev.w + gap + jitter;
        state.obstacles.push(makeSign(nx));
      }
    }
  }

  function spawnCloud(timestamp) {
    if (timestamp - state.lastCloud < 2000) return;
    state.lastCloud = timestamp;
    state.clouds.push({ x: canvas.width + 40, y: 40 + Math.random() * 80, w: 44 });
  }

  function update(dt, timestamp) {
    // Difficulty ramp: start easy, slowly accelerate
    state.elapsedMs += dt;
    state.speed += dt * 0.00020; // gentler acceleration
    state.score += dt * 0.02; // slower score gain

    // Physics
    const c = state.character;
    // Variable jump: reduce gravity while rising and jump is held
    let effG = state.gravity;
    // Keep jump height constant: only apply a tiny float effect, not extra height
    if (state.jumpPressed && !c.onGround && c.vy < 0 && state.jumpHoldMs < state.maxJumpHoldMs) {
      effG *= 0.75; // small float, not strong lift
      state.jumpHoldMs += dt;
    }
    c.vy += effG;
    c.y += c.vy;
    if (c.y + c.h >= state.groundY) {
      c.y = state.groundY - c.h;
      c.vy = 0;
      c.onGround = true;
      state.jumpHoldMs = 0;
    }
    // Clamp to top so it never goes off screen
    if (c.y < 8) {
      c.y = 8;
      c.vy = Math.max(0, c.vy);
    }

    // Obstacles
    for (const o of state.obstacles) {
      o.x -= state.speed;
      if (!o.passed && (o.x + (o.w || 0)) < c.x) {
        o.passed = true;
        state.score += 4; // smaller pass bonus
      }
    }
    state.obstacles = state.obstacles.filter(o => o.x + o.w > -20);

    spawnObstacle(timestamp);
    spawnCloud(timestamp);

    // Collision
    for (const o of state.obstacles) {
      if (collidesWithObstacle(c, o)) {
        endGame();
        break;
      }
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collidesWithObstacle(c, o) {
    if (o.type === 'sign') {
      // Treat as union of post and board rectangles
      const postW = 6;
      const postRect = { x: o.x + (o.boardW - postW) / 2, y: state.groundY - o.postH, w: postW, h: o.postH };
      const boardRect = { x: o.x, y: o.yTop, w: o.boardW, h: o.boardH };
      return rectsOverlap(c, postRect) || rectsOverlap(c, boardRect);
    }
    return rectsOverlap(c, o);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawCharacter();

    // Draw obstacles
    for (const o of state.obstacles) {
      drawObstacle(o);
    }

    // Score on canvas top-right
    const s = Math.floor(state.score).toString().padStart(5, '0');
    ctx.fillStyle = '#222';
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(s, canvas.width - 16, 24);
  }

  function drawObstacle(o) {
    if (o.type === 'sign') {
      // post
      const postW = 6;
      ctx.fillStyle = '#222';
      ctx.fillRect(o.x + (o.boardW - postW) / 2, state.groundY - o.postH, postW, o.postH);
      // board (green)
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(o.x, o.yTop, o.boardW, o.boardH);
      // inner text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PUMP', o.x + o.boardW / 2, o.yTop + o.boardH / 2 + 1);
      return;
    }
    ctx.fillStyle = '#222';
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  function computeSpawnCooldown() {
    // Phase-based intervals
    const phase = getPhase();
    let base;
    if (phase === 1) base = 1650;       // 0-15s very sparse
    else if (phase === 2) base = 1300;  // 15-30s closer
    else if (phase === 3) base = 1100;  // 30-60s medium
    else base = 950;                    // 60s+ fast
    // small speed-based reduction
    const reduction = Math.min(420, Math.max(0, (state.speed - 5) * 75));
    return Math.max(420, base - reduction);
  }

  function getDifficultyFactor() {
    // 0.0 to ~1.0 over first few minutes
    const t = state.elapsedMs;
    return Math.min(1, t / 120000); // reaches 1.0 at ~2 minutes
  }

  function getPhase() {
    const t = state.elapsedMs;
    if (t < 15000) return 1;     // 0-15s
    if (t < 30000) return 2;     // 15-30s
    if (t < 60000) return 3;     // 30-60s
    return 4;                    // 60s+
  }

  function getClusterConfig(phase) {
    // Returns probability, maxExtras (how many additional signs beyond the first), and gapFactor
    // Gap factor shrinks slightly in later phases to keep sequences jumpable
    if (phase === 1) return { probability: 0,    maxExtras: 0, gapFactor: 1.0 };
    if (phase === 2) return { probability: 0.20, maxExtras: 1, gapFactor: 0.95 }; // low cluster, 2 total
    if (phase === 3) return { probability: 0.45, maxExtras: 2, gapFactor: 0.92 }; // medium, 2-3 total
    return               { probability: 0.65, maxExtras: 2, gapFactor: 0.90 };     // hard, allow up to 3 total
  }

  function computeJumpGapPixels() {
    // Estimate safe horizontal gap after a full jump and brief run-up
    // Use current speed and a nominal airtime ~550-650ms depending on float
    const speed = Math.max(4.6, state.speed);
    const airMs = 600; // ballpark
    const runupMs = 220; // time after landing before next jump
    const px = speed * ((airMs + runupMs) / 16.67); // convert ms to ~frames
    // Ensure gap isn't too small or too large
    return Math.max(80, Math.min(220, px));
  }

  let lastTime = 0;
  function loop(timestamp) {
    if (!state.running) return;
    const dt = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;
    update(dt, timestamp);
    render();
    requestAnimationFrame(loop);
  }

  function endGame() {
    state.running = false;
    finalScoreText.textContent = Math.floor(state.score).toString();
    finalTimeEl.textContent = Math.floor(state.elapsedMs / 1000).toString();
    const shareText = encodeURIComponent(`I scored ${Math.floor(state.score)} in Virgen Jump! @virgenfts`);
    const url = encodeURIComponent(window.location.href);
    tweetLink.href = `https://twitter.com/intent/tweet?text=${shareText}&url=${url}`;
    overlay.classList.remove('hidden');
    refreshLeaderboard();
  }

  function showSection(section) {
    intro.classList.add('hidden');
    game.classList.add('hidden');
    if (section === 'intro') intro.classList.remove('hidden');
    if (section === 'game') game.classList.remove('hidden');
  }

  
  function startGameFromUI(e){
    if (e) { try{ e.preventDefault(); e.stopPropagation(); }catch(_){} }
    console.log('PLAY CLICKED!'); // Debug log
    showSection('game');
    overlay.classList.add('hidden');
    resetGame();
  }

  // Simple, direct event binding for maximum mobile compatibility
  playBtn.onclick = startGameFromUI;
  playBtn.ontouchstart = function(e) { e.preventDefault(); startGameFromUI(e); };
  playBtn.ontouchend = function(e) { e.preventDefault(); };
  
  retryBtn.onclick = startGameFromUI;
  retryBtn.ontouchstart = function(e) { e.preventDefault(); startGameFromUI(e); };
  retryBtn.ontouchend = function(e) { e.preventDefault(); };

  submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const twitter = document.getElementById('twitter').value.trim();
    const wallet = document.getElementById('wallet').value.trim();
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twitter, wallet, score: Math.floor(state.score) })
      });
      if (!res.ok) throw new Error('Failed to submit score');
      await res.json();
      await refreshLeaderboard();
      alert('Score submitted!');
    } catch (err) {
      alert('Could not submit score.');
    }
  });

  async function refreshLeaderboard() {
    try {
      const lbRes = await fetch('/api/leaderboard/daily');
      const lb = await lbRes.json();
      const tbody = document.querySelector('#dailyTable tbody');
      tbody.innerHTML = '';
      lb.leaderboard.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx + 1}</td><td>${escapeHtml(row.twitter || '-')}</td><td>${row.score}</td>`;
        tbody.appendChild(tr);
      });
    } catch {}

    try {
      const winnersRes = await fetch('/api/winners');
      const w = await winnersRes.json();
      const tbody = document.querySelector('#winnersTable tbody');
      tbody.innerHTML = '';
      const dates = Object.keys(w).sort((a, b) => b.localeCompare(a));
      dates.forEach((date) => {
        const row = w[date];
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${date}</td><td>${escapeHtml(row.twitter || '-')}</td><td>${row.score}</td>`;
        tbody.appendChild(tr);
      });
    } catch {}
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Initial
  showSection('intro');
  refreshLeaderboard();
})();


