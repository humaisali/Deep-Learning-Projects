// Game Objects & Physics for Fruit Slice AR
const imageCache = new Map();
function getImage(src) {
  if (!imageCache.has(src)) {
    const image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return imageCache.get(src);
}

// Sample only the fruit flesh/rind from photos with studio backdrops.
const photoMasks = {
  orange: [36, 6, 274, 281],
  watermelon: [9, 9, 343, 385],
};

function drawMaskedFruit(ctx, image, type, size, side = 0) {
  const mask = photoMasks[type];
  if (!mask) return false;
  let [x, y, w, h] = mask;
  if (side && type === 'watermelon') [x, y, w, h] = [9, 137, 280, 308];
  if (side > 0) x -= type === 'orange' ? 168 : 174;
  const scale = size / Math.max(w, h);
  const width = w * scale, height = h * scale;
  const center = side ? (x + w / 2 - (side < 0 ? image.naturalWidth : 0)) * scale : 0;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(center, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, center - (x + w / 2) * scale, -(y + h / 2) * scale,
    image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
  return true;
}

export class Blade {
  constructor(color = 'rgba(56, 189, 248, 0.75)', innerColor = '#ffffff') {
    this.history = [];
    this.maxHistory = 14;
    this.width = 12;
    this.velocity = 0;
    this.color = color;
    this.innerColor = innerColor;
  }

  update(x, y) {
    if (x === null || y === null || isNaN(x) || isNaN(y)) return;
    this.history.unshift({ x, y, time: performance.now() });

    if (this.history.length > 1) {
      const dx = this.history[0].x - this.history[1].x;
      const dy = this.history[0].y - this.history[1].y;
      this.velocity = Math.sqrt(dx * dx + dy * dy);
    } else {
      this.velocity = 0;
    }

    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  draw(ctx) {
    if (this.history.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer Glow / Blade Aura
    ctx.beginPath();
    ctx.moveTo(this.history[0].x, this.history[0].y);
    for (let i = 1; i < this.history.length; i++) {
      ctx.lineTo(this.history[i].x, this.history[i].y);
    }
    ctx.lineWidth = this.width + 6;
    ctx.strokeStyle = this.color;
    ctx.stroke();

    // Inner Sharp Core
    ctx.beginPath();
    ctx.moveTo(this.history[0].x, this.history[0].y);
    for (let i = 1; i < this.history.length; i++) {
      ctx.lineTo(this.history[i].x, this.history[i].y);
    }
    ctx.lineWidth = Math.max(3, this.width - 4);
    ctx.strokeStyle = this.innerColor;
    ctx.stroke();

    ctx.restore();
  }

  fade() {
    if (this.history.length > 0) this.history.pop();
    this.velocity = 0;
  }
}

// Distance squared between points
function dist2(v, w) {
  const sqr = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  return sqr === 0 ? 0.0001 : sqr;
}

export class Fruit {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = -(Math.random() * 6 + 14);
    this.gravity = 0.35;
    this.angle = 0;
    this.angularVelocity = (Math.random() - 0.5) * 0.18;
    this.size = 110;
    this.image = getImage(`/assets/fruits/${type}.png`);
  }

  update(step = 1) {
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.vy += this.gravity * step;
    this.angle += this.angularVelocity * step;
  }

  draw(ctx) {
    if (this.image.complete && this.image.naturalHeight !== 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      if (!drawMaskedFruit(ctx, this.image, this.type, this.size)) {
        ctx.drawImage(this.image, -this.size / 2, -this.size / 2, this.size, this.size);
      }
      ctx.restore();
    }
  }

  checkSlice(blade) {
    if (blade.history.length < 2 || blade.velocity < 14) return false;

    const p1 = blade.history[0];
    const p2 = blade.history[1];

    const l2 = dist2(p1, p2);
    let t = ((this.x - p1.x) * (p2.x - p1.x) + (this.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    const proj = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };

    const d = Math.sqrt(dist2({ x: this.x, y: this.y }, proj));
    return d < this.size * 0.52;
  }
}

export class SlicedFruit {
  constructor(x, y, type, side = 1, sliceVelocity = 15) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.side = side; // -1 for left half, 1 for right half
    this.vx = (Math.random() * 4 + 2) * side;
    this.vy = -(Math.random() * 3 + 2);
    this.gravity = 0.45;
    this.angle = 0;
    this.angularVelocity = 0.15 * side;
    this.size = 105;

    const halfNum = side === -1 ? '1' : '2';
    this.image = getImage(`/assets/fruits/${type}_half_${halfNum}.png`);
  }

  update(step = 1) {
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.vy += this.gravity * step;
    this.angle += this.angularVelocity * step;
  }

  draw(ctx) {
    if (this.image.complete && this.image.naturalHeight !== 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      if (drawMaskedFruit(ctx, this.image, this.type, this.size, this.side)) {
        ctx.restore();
        return;
      }
      const halfWidth = this.size * this.image.naturalWidth / this.image.naturalHeight;
      ctx.drawImage(this.image, this.side < 0 ? -halfWidth : 0, -this.size / 2, halfWidth, this.size);
      ctx.restore();
    }
  }
}

export class Bomb {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.type = 'bomb';
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = -(Math.random() * 5 + 13);
    this.gravity = 0.35;
    this.angle = 0;
    this.angularVelocity = (Math.random() - 0.5) * 0.12;
    this.size = 110;
    this.image = getImage('/assets/fruits/bomb.png');
    this.fuseTimer = 0;
  }

  update(step = 1) {
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.vy += this.gravity * step;
    this.angle += this.angularVelocity * step;
    this.fuseTimer += 0.2 * step;
  }

  draw(ctx) {
    if (this.image.complete && this.image.naturalHeight !== 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.drawImage(this.image, -this.size / 2, -this.size / 2, this.size, this.size);

      // Draw glowing fuse spark
      const sparkX = 22;
      const sparkY = -35;
      const sparkRadius = Math.sin(this.fuseTimer) * 2 + 4;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, Math.max(2, sparkRadius), 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      ctx.restore();
    }
  }

  checkSlice(blade) {
    if (blade.history.length < 2 || blade.velocity < 14) return false;

    const p1 = blade.history[0];
    const p2 = blade.history[1];

    const l2 = dist2(p1, p2);
    let t = ((this.x - p1.x) * (p2.x - p1.x) + (this.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    const proj = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };

    const d = Math.sqrt(dist2({ x: this.x, y: this.y }, proj));
    return d < this.size * 0.45;
  }
}

export class Splash {
  constructor(x, y, colorStr = '255, 165, 0') {
    this.particles = [];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 5 + 3,
        alpha: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
    this.colorStr = colorStr;
  }

  update(step = 1) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.2 * step; // slight gravity
      p.alpha -= p.decay * step;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.colorStr}, ${p.alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

export class ComboText {
  constructor(x, y, text, color = '#38bdf8') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.alpha = 1.0;
    this.vy = -2.5;
    this.scale = 1.4;
  }

  update(step = 1) {
    this.y += this.vy * step;
    this.alpha -= 0.025 * step;
    this.scale = Math.max(1.0, this.scale - 0.02 * step);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.font = `bold ${Math.round(28 * this.scale)}px 'Cinzel', 'Shojumaru', sans-serif`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
