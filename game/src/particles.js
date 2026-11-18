// Particles and floating text: exhaust puffs, crash sparks, pickup sparkles, and the
// little cash numbers that float up. A fixed pool, allocated once, so a frame never
// allocates. The renderer draws them; the world only asks for bursts.

export function createParticles() {
  const pool = [];
  for (let i = 0; i < 160; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffffff' });
  }
  const texts = [];
  for (let i = 0; i < 16; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, text: '' });
  }

  function free() {
    for (const p of pool) if (!p.active) return p;
    return null;
  }

  function freeText() {
    for (const t of texts) if (!t.active) return t;
    return null;
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      const p = free();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = life * (0.6 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.color = color;
    }
  }

  function exhaust(x, y, angle) {
    const p = free();
    if (!p) return;
    p.active = true;
    p.x = x - Math.cos(angle) * 24;
    p.y = y - Math.sin(angle) * 24;
    p.vx = -Math.cos(angle) * 40 + (Math.random() - 0.5) * 30;
    p.vy = -Math.sin(angle) * 40 + (Math.random() - 0.5) * 30;
    p.life = 0.5;
    p.maxLife = 0.5;
    p.size = 4;
    p.color = '#8a8f98';
  }

  function floatText(x, y, text) {
    const t = freeText();
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.life = 1.1;
    t.text = text;
  }

  function step(dt) {
    for (const p of pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
    }
    for (const t of texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.active = false;
    }
  }

  return { pool, texts, burst, exhaust, floatText, step };
}
