const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const levelEl = document.getElementById("level");
const hpEl = document.getElementById("hp");
const statusEl = document.getElementById("status");

const keys = new Set();
const state = {
  level: 1,
  hp: 5,
  maxHp: 5,
  camX: 0,
  camY: 0,
  facingX: 0,
  facingY: -1,
  bullets: [],
  enemies: [],
  particles: [],
  stars: [],
  nebulae: [],
  lastShot: 0,
  gameOver: false,
};

const ENEMY = {
  asteroid: { hp: 2, radius: 26, color: "#8fa4b0" },
  station: { hp: 7, radius: 36, color: "#e061ff" },
  strikeCraft: { hp: 3, radius: 20, color: "#6fffdd" },
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function worldToScreen(x, y) {
  return {
    x: x - state.camX + canvas.width / 2,
    y: y - state.camY + canvas.height / 2,
  };
}

function seedBackground() {
  for (let i = 0; i < 350; i += 1) {
    state.stars.push({ x: rand(-5000, 5000), y: rand(-5000, 5000), r: rand(0.5, 2) });
  }
  for (let i = 0; i < 26; i += 1) {
    state.nebulae.push({
      x: rand(-4500, 4500),
      y: rand(-4500, 4500),
      radius: rand(180, 700),
      hue: rand(180, 340),
      alpha: rand(0.08, 0.2),
    });
  }
}

function spawnLevel(level) {
  const enemies = [];
  const range = 900 + level * 90;
  const asteroidCount = 6 + level * 2;
  const stationCount = 3 + Math.floor(level / 2);
  const strikeCount = Math.max(0, level - 2);

  const place = (type, count) => {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(420, range);
      enemies.push({
        type,
        hp: ENEMY[type].hp,
        x: state.camX + Math.cos(angle) * distance,
        y: state.camY + Math.sin(angle) * distance,
        vx: type === "strikeCraft" ? rand(-40, 40) : type === "asteroid" ? rand(-12, 12) : 0,
        vy: type === "strikeCraft" ? rand(-40, 40) : type === "asteroid" ? rand(-12, 12) : 0,
      });
    }
  };

  place("asteroid", asteroidCount);
  place("station", stationCount);
  place("strikeCraft", strikeCount);
  state.enemies = enemies;
}

function restart() {
  Object.assign(state, {
    level: 1,
    hp: 5,
    camX: 0,
    camY: 0,
    facingX: 0,
    facingY: -1,
    bullets: [],
    enemies: [],
    particles: [],
    lastShot: 0,
    gameOver: false,
  });
  spawnLevel(state.level);
}

function shoot(time) {
  if (time - state.lastShot < 110 || state.gameOver) {
    return;
  }
  state.lastShot = time;
  const speed = 760;
  state.bullets.push({
    x: state.camX,
    y: state.camY,
    vx: state.facingX * speed,
    vy: state.facingY * speed,
    life: 1.2,
  });
}

function addExplosion(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 180);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.3, 0.8),
      color,
    });
  }
}

function update(delta, time) {
  if (state.gameOver) {
    if (keys.has("enter")) {
      restart();
    }
    return;
  }

  let moveX = 0;
  let moveY = 0;
  if (keys.has("arrowleft") || keys.has("a")) moveX -= 1;
  if (keys.has("arrowright") || keys.has("d")) moveX += 1;
  if (keys.has("arrowup") || keys.has("w")) moveY -= 1;
  if (keys.has("arrowdown") || keys.has("s")) moveY += 1;

  if (moveX || moveY) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;
    state.facingX = moveX;
    state.facingY = moveY;
  }

  const speed = 310;
  state.camX += moveX * speed * delta;
  state.camY += moveY * speed * delta;

  if (keys.has(" ") || keys.has("k")) {
    shoot(time);
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  for (const enemy of state.enemies) {
    if (enemy.type === "strikeCraft") {
      const dx = state.camX - enemy.x;
      const dy = state.camY - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      enemy.vx += (dx / dist) * 75 * delta;
      enemy.vy += (dy / dist) * 75 * delta;
      const max = 125;
      const v = Math.hypot(enemy.vx, enemy.vy);
      if (v > max) {
        enemy.vx = (enemy.vx / v) * max;
        enemy.vy = (enemy.vy / v) * max;
      }
    }
    enemy.x += enemy.vx * delta;
    enemy.y += enemy.vy * delta;
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      const r = ENEMY[enemy.type].radius;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) <= r) {
        bullet.life = 0;
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          addExplosion(enemy.x, enemy.y, ENEMY[enemy.type].color);
        }
        break;
      }
    }
  }

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  const playerRadius = 13;
  for (const enemy of state.enemies) {
    const r = ENEMY[enemy.type].radius + playerRadius;
    if (Math.hypot(state.camX - enemy.x, state.camY - enemy.y) < r) {
      state.hp -= 1;
      addExplosion(state.camX, state.camY, "#ff8a8a", 16);
      enemy.hp = 0;
      if (state.hp <= 0) {
        state.gameOver = true;
      }
    }
  }

  const stationsLeft = state.enemies.filter((enemy) => enemy.type === "station").length;
  if (!state.gameOver && stationsLeft === 0) {
    state.level += 1;
    addExplosion(state.camX, state.camY, "#8ef7ff", 28);
    spawnLevel(state.level);
  }
}

function drawWaveBullet(bullet, screenX, screenY) {
  const angle = Math.atan2(bullet.vy, bullet.vx);
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(angle);
  ctx.strokeStyle = "#8cf9ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const step = 4;
  for (let i = 0; i <= 18; i += 1) {
    const x = -18 + i * step;
    const y = Math.sin(i * 0.9 + performance.now() * 0.02) * 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function render(time) {
  ctx.fillStyle = "#020207";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const nebula of state.nebulae) {
    const s = worldToScreen(nebula.x, nebula.y);
    if (
      s.x < -nebula.radius ||
      s.x > canvas.width + nebula.radius ||
      s.y < -nebula.radius ||
      s.y > canvas.height + nebula.radius
    ) {
      continue;
    }
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, nebula.radius);
    g.addColorStop(0, `hsla(${nebula.hue}, 90%, 62%, ${nebula.alpha})`);
    g.addColorStop(1, "hsla(240, 80%, 10%, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, nebula.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#e4f3ff";
  for (const star of state.stars) {
    const s = worldToScreen(star.x, star.y);
    if (s.x < 0 || s.x > canvas.width || s.y < 0 || s.y > canvas.height) continue;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin((star.x + star.y + time * 0.07) * 0.01);
    ctx.fillRect(s.x, s.y, star.r, star.r);
  }
  ctx.globalAlpha = 1;

  for (const enemy of state.enemies) {
    const s = worldToScreen(enemy.x, enemy.y);
    const spec = ENEMY[enemy.type];
    if (enemy.type === "asteroid") {
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 7; i += 1) {
        const a = (Math.PI * 2 * i) / 7;
        const r = spec.radius + Math.sin(i + enemy.x * 0.02) * 5;
        const x = s.x + Math.cos(a) * r;
        const y = s.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (enemy.type === "station") {
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x - 28, s.y - 28, 56, 56);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 28);
      ctx.lineTo(s.x + 28, s.y);
      ctx.lineTo(s.x, s.y + 28);
      ctx.lineTo(s.x - 28, s.y);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 16);
      ctx.lineTo(s.x + 14, s.y + 14);
      ctx.lineTo(s.x - 14, s.y + 14);
      ctx.closePath();
      ctx.stroke();
    }
  }

  for (const bullet of state.bullets) {
    const s = worldToScreen(bullet.x, bullet.y);
    drawWaveBullet(bullet, s.x, s.y);
  }

  for (const p of state.particles) {
    const s = worldToScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.6);
    ctx.fillRect(s.x, s.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angle = Math.atan2(state.facingY, state.facingX) + Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = "#7de2ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(14, 14);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  levelEl.textContent = `Level ${state.level}`;
  hpEl.textContent = `Hull ${Math.max(0, state.hp)}/${state.maxHp}`;
  const stationsLeft = state.enemies.filter((enemy) => enemy.type === "station").length;
  statusEl.textContent = state.gameOver
    ? "Game Over — press Enter to restart"
    : `Stations remaining ${stationsLeft}`;
}

let last = performance.now();
function frame(now) {
  const delta = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(delta, now);
  render(now);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(event.key.toLowerCase())) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resize);

resize();
seedBackground();
spawnLevel(state.level);
requestAnimationFrame(frame);
