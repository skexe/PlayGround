import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatNumber(value) {
  return Math.round(value).toLocaleString('es-ES').replaceAll('.', ' ');
}

export function makeGlowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.46, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeCloudTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(9411);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 18; i += 1) {
    const x = size * (0.2 + random() * 0.6);
    const y = size * (0.3 + random() * 0.4);
    const r = size * (0.06 + random() * 0.14);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makePlanetTexture(colors, seed = 1234) {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(seed);
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, colors[0]);
  base.addColorStop(0.45, colors[1]);
  base.addColorStop(0.75, colors[2]);
  base.addColorStop(1, colors[3]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 90; i += 1) {
    const y = random() * height;
    const bandHeight = 3 + random() * 28;
    const alpha = 0.03 + random() * 0.13;
    ctx.fillStyle = random() > 0.5 ? `rgba(255,235,200,${alpha})` : `rgba(12,40,60,${alpha})`;
    ctx.fillRect(0, y, width, bandHeight);
  }
  for (let i = 0; i < 70; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const rx = 12 + random() * 80;
    const ry = 4 + random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(255,255,255,${0.02 + random() * 0.06})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function makeRingTexture(seed = 42) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(seed);
  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, 'rgba(240,214,180,0)');
  gradient.addColorStop(0.16, 'rgba(240,214,180,0.16)');
  gradient.addColorStop(0.28, 'rgba(255,230,200,0.55)');
  gradient.addColorStop(0.42, 'rgba(120,90,90,0.12)');
  gradient.addColorStop(0.55, 'rgba(255,220,180,0.5)');
  gradient.addColorStop(0.68, 'rgba(40,35,50,0.08)');
  gradient.addColorStop(0.82, 'rgba(255,225,190,0.35)');
  gradient.addColorStop(1, 'rgba(240,214,180,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 32);
  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = `rgba(30,20,30,${random() * 0.18})`;
    ctx.fillRect(random() * 512, 0, 1 + random() * 3, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeGlyphTexture(seed = 7) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = mulberry32(seed);
  ctx.clearRect(0, 0, 256, 512);
  ctx.strokeStyle = 'rgba(255,170,90,0.9)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(255,120,50,0.9)';
  ctx.shadowBlur = 10;
  for (let row = 0; row < 7; row += 1) {
    const cy = 48 + row * 68;
    for (let col = 0; col < 3; col += 1) {
      const cx = 58 + col * 70;
      ctx.beginPath();
      const points = 3 + Math.floor(random() * 4);
      for (let p = 0; p < points; p += 1) {
        const angle = (p / points) * Math.PI * 2 + random() * 0.7;
        const r = 10 + random() * 15;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
