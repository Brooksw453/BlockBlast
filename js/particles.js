/* ============================================
   Block Blast // Neon Edition — Particle System
   Lightweight canvas-based particle engine
   ============================================ */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.maxParticles = 400;
    this.ambientActive = false;
    this.ambientTimer = null;
    this.running = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.start();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.dpr = dpr;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap delta
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      p.vx *= (1 - (p.friction || 0) * dt);
      p.vy *= (1 - (p.friction || 0) * dt);
      p.alpha = Math.min(1, p.life / p.maxLife * 2);

      if (p.type === 'text') {
        p.alpha = p.life / p.maxLife;
        p.y -= 40 * dt; // float upward
      }

      if (p.type === 'ambient') {
        p.alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.3;
      }

      if (p.shrink) {
        p.size = p.originalSize * (p.life / p.maxLife);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    // Clear with the scale reset
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();

    // Additive blending for neon glow
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'text') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${p.size}px Orbitron, sans-serif`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glow || 8;
        ctx.fill();
      }

      ctx.restore();
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Spawn particles with config
  emit(config) {
    const count = config.count || 10;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = config.angle !== undefined
        ? config.angle + (Math.random() - 0.5) * (config.spread || Math.PI * 2)
        : Math.random() * Math.PI * 2;
      const speed = (config.speed || 100) * (0.5 + Math.random() * 0.5);
      const life = (config.life || 1) * (0.7 + Math.random() * 0.3);

      this.particles.push({
        x: config.x + (Math.random() - 0.5) * (config.offsetX || 0),
        y: config.y + (Math.random() - 0.5) * (config.offsetY || 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (config.size || 3) * (0.5 + Math.random() * 0.5),
        originalSize: (config.size || 3) * (0.5 + Math.random() * 0.5),
        color: config.color || '#00ffff',
        alpha: 1,
        life: life,
        maxLife: life,
        gravity: config.gravity || 0,
        friction: config.friction || 2,
        type: config.type || 'spark',
        glow: config.glow || 8,
        shrink: config.shrink !== false,
        text: config.text || ''
      });
    }
  }

  // Get screen position from a board cell element
  getCellCenter(cellElement) {
    const rect = cellElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  // Line clear effect — sparks explode from each cleared cell
  emitLineClear(clearedCells, gameBoardElement) {
    const cells = gameBoardElement.getElementsByClassName('cell');

    for (const { r, c, color } of clearedCells) {
      const cellIndex = r * 8 + c;
      const cellElem = cells[cellIndex];
      if (!cellElem) continue;

      const pos = this.getCellCenter(cellElem);
      const neonColor = NEON_COLORS[color] || '#00ffff';

      this.emit({
        x: pos.x, y: pos.y,
        count: 6,
        speed: 120,
        size: 3.5,
        life: 0.8,
        color: neonColor,
        gravity: 80,
        friction: 2,
        glow: 12
      });
    }

    // Extra cyan sparkle burst
    if (clearedCells.length > 0) {
      const midCell = clearedCells[Math.floor(clearedCells.length / 2)];
      const midIndex = midCell.r * 8 + midCell.c;
      const midElem = cells[midIndex];
      if (midElem) {
        const pos = this.getCellCenter(midElem);
        this.emit({
          x: pos.x, y: pos.y,
          count: 8,
          speed: 80,
          size: 2,
          life: 0.6,
          color: '#00ffff',
          glow: 15
        });
      }
    }
  }

  // Block placement — small burst
  emitBlockPlace(placedCells, gameBoardElement, colorIndex) {
    const cells = gameBoardElement.getElementsByClassName('cell');
    const neonColor = NEON_COLORS[colorIndex] || '#00ffff';

    for (const { r, c } of placedCells) {
      const cellIndex = r * 8 + c;
      const cellElem = cells[cellIndex];
      if (!cellElem) continue;

      const pos = this.getCellCenter(cellElem);
      this.emit({
        x: pos.x, y: pos.y,
        count: 3,
        speed: 60,
        size: 2.5,
        life: 0.5,
        color: neonColor,
        gravity: 40,
        friction: 3,
        glow: 8
      });
    }
  }

  // Combo effect — larger burst with multiplier text
  emitCombo(x, y, multiplier) {
    // Particle burst
    this.emit({
      x, y,
      count: 12 + multiplier * 4,
      speed: 150,
      size: 4,
      life: 1,
      color: '#00ffff',
      gravity: 50,
      friction: 2,
      glow: 15
    });

    // Floating combo text
    this.emit({
      x, y: y - 20,
      count: 1,
      speed: 0,
      size: 22 + multiplier * 2,
      life: 1.2,
      color: '#00ffff',
      type: 'text',
      text: `x${multiplier}`,
      shrink: false,
      gravity: 0,
      friction: 0
    });
  }

  // Perfect clear celebration
  emitPerfectClear(gameBoardElement) {
    const rect = gameBoardElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Big burst from center
    for (const color of Object.values(NEON_COLORS)) {
      this.emit({
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 100,
        count: 10,
        speed: 200,
        size: 4,
        life: 1.5,
        color: color,
        gravity: 60,
        friction: 1.5,
        glow: 15
      });
    }

    // Floating text
    this.emit({
      x: cx, y: cy,
      count: 1,
      speed: 0,
      size: 20,
      life: 2,
      color: '#00ffff',
      type: 'text',
      text: 'PERFECT!',
      shrink: false,
      gravity: 0,
      friction: 0
    });
  }

  // Game over — dramatic particle rain
  emitGameOver(gameBoardElement) {
    const rect = gameBoardElement.getBoundingClientRect();

    // Rain of particles from top
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const colors = Object.values(NEON_COLORS);
        this.emit({
          x: rect.left + Math.random() * rect.width,
          y: rect.top - 10,
          count: 2,
          speed: 30,
          size: 3,
          life: 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 150,
          friction: 0.5,
          glow: 10,
          angle: Math.PI / 2,
          spread: 0.5
        });
      }, i * 40);
    }
  }

  // Score popup (DOM-based for crisp text)
  emitScorePopup(x, y, text, color) {
    const container = document.getElementById('scorePopupContainer');
    if (!container) return;

    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.color = color || '#00ffff';
    popup.style.textShadow = `0 0 10px ${color || '#00ffff'}`;

    // Position relative to game container
    const containerRect = container.getBoundingClientRect();
    popup.style.left = (x - containerRect.left) + 'px';
    popup.style.top = (y - containerRect.top) + 'px';

    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
  }

  // Ambient floating particles
  startAmbient() {
    this.ambientActive = true;
    this.spawnAmbient();
  }

  stopAmbient() {
    this.ambientActive = false;
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  spawnAmbient() {
    if (!this.ambientActive) return;

    // Count current ambient particles
    const ambientCount = this.particles.filter(p => p.type === 'ambient').length;
    if (ambientCount < 15) {
      this.emit({
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + 10,
        count: 1,
        speed: 15 + Math.random() * 20,
        size: 1.5 + Math.random() * 1.5,
        life: 8 + Math.random() * 6,
        color: '#00ffff',
        type: 'ambient',
        gravity: -8,
        friction: 0,
        glow: 6,
        shrink: false,
        angle: -Math.PI / 2,
        spread: 0.4
      });
    }

    this.ambientTimer = setTimeout(() => this.spawnAmbient(), 600 + Math.random() * 800);
  }
}

// Neon color mapping (shared with game.js)
const NEON_COLORS = {
  1: '#ff0066',  // neon pink
  2: '#00ff88',  // neon green
  3: '#00ccff',  // neon blue
  4: '#bf00ff',  // neon purple
  5: '#ff6600',  // neon orange
  6: '#ffff00'   // neon yellow
};

// Initialize the particle system
const particles = new ParticleSystem('particleCanvas');
particles.startAmbient();
