const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const levelEl = document.getElementById("level");
const hpEl = document.getElementById("hp");
const statusEl = document.getElementById("status");
const controlsEl = document.getElementById("controls");
const warningEl = document.getElementById("warning");

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
  nullZoneTime: 0,
  playerDestroyedAt: 0,
  gameOver: false,
};

const NULL_ZONE = {
  halfWidth: 700,
  halfHeight: 450,
  warningDelay: 4,
};
const AUTO_SPEED = 190;

const ENEMY = {
  asteroid: { hp: 1, color: "#8fa4b0" },
  station: { hp: 7, radius: 52, color: "#e061ff" },
  strikeCraft: { hp: 3, radius: 20, color: "#6fffdd" },
};

const ASTEROID_RADIUS = {
  large: { min: 30, max: 39 },
  small: { min: 13, max: 19 },
};

const NEBULA_PALETTES = [
  [320, 285],
  [320, 26],
  [115, 26, 358],
  [182, 240, 305],
  [170, 215, 35],
];

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

function isOnScreen(x, y, radius = 0) {
  const s = worldToScreen(x, y);
  return s.x >= -radius && s.x <= canvas.width + radius && s.y >= -radius && s.y <= canvas.height + radius;
}

function randomAsteroidRadius(size) {
  const range = ASTEROID_RADIUS[size];
  return rand(range.min, range.max);
}

function makeAsteroid(size, x, y, vx, vy) {
  const radius = randomAsteroidRadius(size);
  return {
    type: "asteroid",
    asteroidSize: size,
    hp: 1,
    radius,
    x: Math.max(-NULL_ZONE.halfWidth + radius, Math.min(NULL_ZONE.halfWidth - radius, x)),
    y: Math.max(-NULL_ZONE.halfHeight + radius, Math.min(NULL_ZONE.halfHeight - radius, y)),
    vx,
    vy,
  };
}

function makeStation(x, y) {
  return {
    type: "station",
    hp: ENEMY.station.hp,
    radius: ENEMY.station.radius,
    x,
    y,
    vx: 0,
    vy: 0,
    laserState: "idle",
    laserCooldown: rand(0.8, 2.2),
    laserTimer: 0,
    laserDirX: 0,
    laserDirY: 0,
    laserLength: 1500,
    laserHit: false,
  };
}

function makeStrikeCraft(x, y) {
  return {
    type: "strikeCraft",
    hp: ENEMY.strikeCraft.hp,
    radius: ENEMY.strikeCraft.radius,
    x,
    y,
    vx: rand(-40, 40),
    vy: rand(-40, 40),
  };
}

function safeSpawnPosition(angle, distance, margin = 60) {
  return {
    x: Math.max(
      -NULL_ZONE.halfWidth + margin,
      Math.min(NULL_ZONE.halfWidth - margin, state.camX + Math.cos(angle) * distance),
    ),
    y: Math.max(
      -NULL_ZONE.halfHeight + margin,
      Math.min(NULL_ZONE.halfHeight - margin, state.camY + Math.sin(angle) * distance),
    ),
  };
}

function seedBackground() {
  for (let i = 0; i < 350; i += 1) {
    state.stars.push({ x: rand(-5000, 5000), y: rand(-5000, 5000), r: rand(0.5, 2) });
  }
  for (let i = 0; i < 26; i += 1) {
    const hues = NEBULA_PALETTES[Math.floor(rand(0, NEBULA_PALETTES.length))];
    const layers = hues.map((hue) => ({
      hue,
      offsetX: rand(-0.24, 0.24),
      offsetY: rand(-0.24, 0.24),
      scale: rand(0.75, 1.14),
      alphaScale: rand(0.85, 1.2),
    }));
    state.nebulae.push({
      x: rand(-4500, 4500),
      y: rand(-4500, 4500),
      radius: rand(420, 1200),
      alpha: rand(0.07, 0.17),
      layers,
    });
  }
}

function spawnLevel(level) {
  const enemies = [];
  const range = 900 + level * 90;
  const asteroidCount = 6 + level * 2;
  const stationCount = 3 + Math.floor(level / 2);
  const strikeCount = Math.max(0, level - 2);

  for (let i = 0; i < asteroidCount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(420, range);
    const size = Math.random() < 0.62 ? "large" : "small";
    const position = safeSpawnPosition(angle, distance, 48);
    enemies.push(
      makeAsteroid(
        size,
        position.x,
        position.y,
        rand(-12, 12),
        rand(-12, 12),
      ),
    );
  }

  for (let i = 0; i < stationCount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(420, range);
    const position = safeSpawnPosition(angle, distance, ENEMY.station.radius + 12);
    enemies.push(makeStation(position.x, position.y));
  }

  for (let i = 0; i < strikeCount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const distance = rand(420, range);
    const position = safeSpawnPosition(angle, distance, ENEMY.strikeCraft.radius + 12);
    enemies.push(
      makeStrikeCraft(position.x, position.y),
    );
  }

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
    nullZoneTime: 0,
    playerDestroyedAt: 0,
    gameOver: false,
  });
  spawnLevel(state.level);
}

function isInNullZone() {
  return (
    Math.abs(state.camX) >= NULL_ZONE.halfWidth ||
    Math.abs(state.camY) >= NULL_ZONE.halfHeight
  );
}

function combustAndRespawn() {
  state.playerDestroyedAt = performance.now();
  damagePlayer(1, "#ff4545", 34);
  state.camX = 0;
  state.camY = 0;
  state.nullZoneTime = 0;
}

function shoot(time) {
  if (time - state.lastShot < 250 || state.gameOver) {
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

function damagePlayer(amount, color = "#ff8a8a", particleAmount = 16) {
  state.hp -= amount;
  addExplosion(state.camX, state.camY, color, particleAmount);
  if (state.hp <= 0) {
    state.playerDestroyedAt = performance.now();
    state.gameOver = true;
  }
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.000001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const lx = x1 + dx * t;
  const ly = y1 + dy * t;
  return Math.hypot(px - lx, py - ly);
}

function updateStationLaser(enemy, delta) {
  if (!isOnScreen(enemy.x, enemy.y, enemy.radius)) {
    if (enemy.laserState !== "idle") {
      enemy.laserState = "idle";
      enemy.laserTimer = 0;
    }
    enemy.laserCooldown = Math.max(enemy.laserCooldown, 0.35);
    return;
  }

  if (enemy.laserState === "idle") {
    enemy.laserCooldown -= delta;
    if (enemy.laserCooldown <= 0) {
      const dx = state.camX - enemy.x;
      const dy = state.camY - enemy.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      enemy.laserDirX = dx / distance;
      enemy.laserDirY = dy / distance;
      enemy.laserLength = Math.max(canvas.width, canvas.height) * 1.8;
      enemy.laserState = "charging";
      enemy.laserTimer = 0.8;
      enemy.laserHit = false;
    }
    return;
  }

  enemy.laserTimer -= delta;

  if (enemy.laserState === "charging") {
    if (enemy.laserTimer <= 0) {
      enemy.laserState = "firing";
      enemy.laserTimer = 0.35;
    }
    return;
  }

  if (!enemy.laserHit) {
    const endX = enemy.x + enemy.laserDirX * enemy.laserLength;
    const endY = enemy.y + enemy.laserDirY * enemy.laserLength;
    const dist = distancePointToSegment(state.camX, state.camY, enemy.x, enemy.y, endX, endY);
    if (dist <= 16) {
      damagePlayer(1, "#ff5656", 18);
      enemy.laserHit = true;
    }
  }

  if (enemy.laserTimer <= 0) {
    enemy.laserState = "idle";
    enemy.laserCooldown = rand(1.35, 2.6);
    enemy.laserTimer = 0;
    enemy.laserHit = false;
  }
}

function spawnAsteroidFragments(enemy, spawned) {
  if (enemy.type !== "asteroid" || enemy.asteroidSize !== "large") {
    return;
  }
  const count = Math.floor(rand(1, 4));
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(35, 95);
    const offset = rand(8, 16);
    spawned.push(
      makeAsteroid(
        "small",
        enemy.x + Math.cos(angle) * offset,
        enemy.y + Math.sin(angle) * offset,
        enemy.vx * 0.4 + Math.cos(angle) * speed,
        enemy.vy * 0.4 + Math.sin(angle) * speed,
      ),
    );
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

  state.camX += state.facingX * AUTO_SPEED * delta;
  state.camY += state.facingY * AUTO_SPEED * delta;

  if (isInNullZone()) {
    state.nullZoneTime += delta;
    if (state.nullZoneTime >= NULL_ZONE.warningDelay) {
      combustAndRespawn();
    }
  } else {
    state.nullZoneTime = 0;
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
    if (enemy.type === "station") {
      updateStationLaser(enemy, delta);
    }
    enemy.x += enemy.vx * delta;
    enemy.y += enemy.vy * delta;
    if (enemy.type === "asteroid") {
      if (enemy.x - enemy.radius < -NULL_ZONE.halfWidth) {
        enemy.x = -NULL_ZONE.halfWidth + enemy.radius;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x + enemy.radius > NULL_ZONE.halfWidth) {
        enemy.x = NULL_ZONE.halfWidth - enemy.radius;
        enemy.vx = -Math.abs(enemy.vx);
      }
      if (enemy.y - enemy.radius < -NULL_ZONE.halfHeight) {
        enemy.y = -NULL_ZONE.halfHeight + enemy.radius;
        enemy.vy = Math.abs(enemy.vy);
      } else if (enemy.y + enemy.radius > NULL_ZONE.halfHeight) {
        enemy.y = NULL_ZONE.halfHeight - enemy.radius;
        enemy.vy = -Math.abs(enemy.vy);
      }
    }
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      const r = enemy.radius ?? ENEMY[enemy.type].radius;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) <= r) {
        bullet.life = 0;
        enemy.hp -= 1;
        break;
      }
    }
  }

  const spawned = [];
  const survivors = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      addExplosion(enemy.x, enemy.y, ENEMY[enemy.type].color);
      spawnAsteroidFragments(enemy, spawned);
    } else {
      survivors.push(enemy);
    }
  }
  state.enemies = survivors.concat(spawned);

  const playerRadius = 13;
  for (const enemy of state.enemies) {
    const r = (enemy.radius ?? ENEMY[enemy.type].radius) + playerRadius;
    if (Math.hypot(state.camX - enemy.x, state.camY - enemy.y) < r) {
      damagePlayer(1);
      enemy.hp = 0;
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

function drawStripedRegion(x, y, width, height, time) {
  if (width <= 0 || height <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = "rgba(150, 0, 0, 0.1)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(255, 35, 35, 0.52)";
  ctx.lineWidth = 3;
  const offset = (time * 0.08) % 32;
  for (let stripe = -canvas.height - 32; stripe < canvas.width + canvas.height; stripe += 32) {
    ctx.beginPath();
    ctx.moveTo(stripe + offset, 0);
    ctx.lineTo(stripe - canvas.height + offset, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNullZone(time) {
  const boundary = worldToScreen(-NULL_ZONE.halfWidth, -NULL_ZONE.halfHeight);
  const right = boundary.x + NULL_ZONE.halfWidth * 2;
  const bottom = boundary.y + NULL_ZONE.halfHeight * 2;
  drawStripedRegion(0, 0, canvas.width, boundary.y, time);
  drawStripedRegion(0, bottom, canvas.width, canvas.height - bottom, time);
  drawStripedRegion(0, boundary.y, boundary.x, NULL_ZONE.halfHeight * 2, time);
  drawStripedRegion(right, boundary.y, canvas.width - right, NULL_ZONE.halfHeight * 2, time);
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
    for (const layer of nebula.layers) {
      const lx = s.x + layer.offsetX * nebula.radius;
      const ly = s.y + layer.offsetY * nebula.radius;
      const lr = nebula.radius * layer.scale;
      const alpha = nebula.alpha * layer.alphaScale;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0, `hsla(${layer.hue}, 92%, 60%, ${alpha})`);
      g.addColorStop(1, "hsla(235, 70%, 10%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#e4f3ff";
  for (const star of state.stars) {
    const s = worldToScreen(star.x, star.y);
    if (s.x < 0 || s.x > canvas.width || s.y < 0 || s.y > canvas.height) continue;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin((star.x + star.y + time * 0.07) * 0.01);
    ctx.fillRect(s.x, s.y, star.r, star.r);
  }
  ctx.globalAlpha = 1;

  drawNullZone(time);

  const boundary = worldToScreen(-NULL_ZONE.halfWidth, -NULL_ZONE.halfHeight);
  const boundaryWidth = NULL_ZONE.halfWidth * 2;
  const boundaryHeight = NULL_ZONE.halfHeight * 2;
  ctx.save();
  ctx.strokeStyle = "#ff3030";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 14]);
  ctx.lineDashOffset = -time * 0.08;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255, 30, 30, 0.85)";
  ctx.strokeRect(boundary.x, boundary.y, boundaryWidth, boundaryHeight);
  ctx.restore();

  for (const enemy of state.enemies) {
    const s = worldToScreen(enemy.x, enemy.y);
    const spec = ENEMY[enemy.type];
    if (enemy.type === "asteroid") {
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 7; i += 1) {
        const a = (Math.PI * 2 * i) / 7;
        const r = enemy.radius + Math.sin(i + enemy.x * 0.02) * (enemy.asteroidSize === "large" ? 5 : 2.5);
        const x = s.x + Math.cos(a) * r;
        const y = s.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (enemy.type === "station") {
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 4;
      const size = enemy.radius;
      ctx.strokeRect(s.x - size, s.y - size, size * 2, size * 2);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - size);
      ctx.lineTo(s.x + size, s.y);
      ctx.lineTo(s.x, s.y + size);
      ctx.lineTo(s.x - size, s.y);
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

  for (const enemy of state.enemies) {
    if (enemy.type !== "station" || enemy.laserState === "idle") continue;
    const start = worldToScreen(enemy.x, enemy.y);
    const end = worldToScreen(
      enemy.x + enemy.laserDirX * enemy.laserLength,
      enemy.y + enemy.laserDirY * enemy.laserLength,
    );
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    if (enemy.laserState === "charging") {
      ctx.strokeStyle = "rgba(255, 70, 70, 0.35)";
      ctx.lineWidth = 5;
    } else {
      ctx.strokeStyle = "rgba(255, 70, 70, 0.98)";
      ctx.lineWidth = 9;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(255, 70, 70, 0.9)";
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
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

  if (state.playerDestroyedAt > 0) {
    const progress = (time - state.playerDestroyedAt) / 900;
    if (progress < 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = `rgba(255, 70, 70, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + progress * 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(progress * Math.PI);
      ctx.beginPath();
      ctx.moveTo(-26 - progress * 16, 0);
      ctx.lineTo(26 + progress * 16, 0);
      ctx.moveTo(0, -26 - progress * 16);
      ctx.lineTo(0, 26 + progress * 16);
      ctx.stroke();
      ctx.restore();
    }
  }

  levelEl.textContent = `Level ${state.level}`;
  hpEl.textContent = `Hull ${Math.max(0, state.hp)}/${state.maxHp}`;
  const stationsLeft = state.enemies.filter((enemy) => enemy.type === "station").length;
  statusEl.textContent = state.gameOver
    ? "Game Over — press Enter to restart"
    : `Stations remaining ${stationsLeft}`;
  if (controlsEl) {
    controlsEl.textContent =
      "Move: Arrow Keys/WASD · Shoot: Space or K (tap, max 4 shots/sec) · Restart: Enter";
  }
  if (warningEl) {
    const remaining = Math.max(0, NULL_ZONE.warningDelay - state.nullZoneTime);
    warningEl.textContent = `WARNING: ENTERING NULL ZONE ${remaining.toFixed(1)}`;
    warningEl.classList.toggle("active", state.nullZoneTime > 0);
  }
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
  const key = event.key.toLowerCase();
  if (!event.repeat) {
    keys.add(key);
  }
  if ((key === " " || key === "k") && !event.repeat) {
    shoot(performance.now());
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resize);

resize();
seedBackground();
spawnLevel(state.level);
requestAnimationFrame(frame);
