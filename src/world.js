import * as THREE from 'three';
import { Rng, fbm, ridged, clamp, smoothstep } from './noise.js';
import { RESOURCES } from './universe.js';

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(.18, 'rgba(255,255,255,.58)');
  g.addColorStop(.45, 'rgba(255,255,255,.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function glowSprite(color, scale = 3, opacity = .8) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(scale);
  return sprite;
}

function makeSky(planet) {
  const geom = new THREE.SphereGeometry(640, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(planet.biome.skyTop) },
      midColor: { value: new THREE.Color(planet.biome.skyMid) },
      horizonColor: { value: new THREE.Color(planet.biome.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld - cameraPosition).y;
        vec3 c = mix(horizonColor, midColor, smoothstep(-0.015, 0.23, h));
        c = mix(c, topColor, smoothstep(0.16, 0.82, h));
        float band = smoothstep(-0.06, 0.02, h) - smoothstep(0.02, 0.16, h);
        c += vec3(0.06, 0.035, 0.02) * max(0.0, band);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geom, mat);
}

function makeStars() {
  const rng = new Rng(991177);
  const count = 1100;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const theta = rng.float() * Math.PI * 2;
    const phi = Math.acos(rng.range(-.18, 1));
    const r = 560;
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r;
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    c.setHSL(rng.range(.52, .67), rng.range(.1, .5), rng.range(.65, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 2.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, fog: false });
  return new THREE.Points(geom, mat);
}

function makeGiantTexture(planet, rng) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const horizon = new THREE.Color(planet.biome.skyHorizon);
  const accent = new THREE.Color(planet.biome.accent);
  const low = new THREE.Color(planet.biome.low);
  const cream = new THREE.Color(0xf2d6a2);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  const stops = [
    [0, cream.clone().lerp(horizon, .28)],
    [.16, horizon.clone().lerp(cream, .3)],
    [.31, horizon.clone().lerp(low, .36)],
    [.46, cream.clone().lerp(horizon, .25)],
    [.62, horizon.clone().lerp(accent, .4)],
    [.78, low.clone().lerp(horizon, .45)],
    [1, low.clone().multiplyScalar(.55)],
  ];
  for (const [at, col] of stops) grad.addColorStop(at, `#${col.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 44; i++) {
    const y = rng.range(4, 252);
    const h = rng.range(1, 6);
    const tone = rng.chance(.5) ? cream : low;
    ctx.fillStyle = `rgba(${tone.r * 255 | 0},${tone.g * 255 | 0},${tone.b * 255 | 0},${rng.range(.04, .2)})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * .018 + i) * rng.range(1, 5));
    ctx.lineTo(512, y + h);
    for (let x = 512; x >= 0; x -= 16) ctx.lineTo(x, y + h + Math.sin(x * .018 + i) * rng.range(1, 5));
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 1500; i++) {
    const x = rng.range(0, 512), y = rng.range(0, 256);
    ctx.fillStyle = rng.chance(.5) ? 'rgba(255,240,210,.06)' : 'rgba(30,10,20,.06)';
    ctx.fillRect(x, y, rng.range(1, 4), rng.range(1, 3));
  }
  const sx = rng.range(90, 330), sy = rng.range(100, 210);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,238,210,.32)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,60,.35)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34 - i * 6, 12 - i * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGasGiant(planet, rng) {
  const group = new THREE.Group();
  const color = new THREE.Color(planet.biome.skyHorizon).lerp(new THREE.Color(planet.biome.accent), .25);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(29, 48, 32),
    new THREE.MeshStandardMaterial({ map: makeGiantTexture(planet, rng), color: 0xffffff, roughness: .88, metalness: .03, fog: false, emissive: color.clone().multiplyScalar(.08) })
  );
  group.add(sphere);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(30.5, 40, 28),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(planet.biome.accent) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0-abs(dot(vN,vV)), 2.4); gl_FragColor = vec4(color, rim*.55); }`,
    })
  );
  group.add(atmo);
  const ringColor = new THREE.Color(planet.biome.skyHorizon).lerp(new THREE.Color(0xf5e9c8), .55);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(35 + i * 5, 35.9 + i * 5, 96),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: .42 - i * .07, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    ring.rotation.x = Math.PI / 2.28;
    ring.rotation.z = .12 + i * .03;
    group.add(ring);
  }
  const glow = glowSprite(color, 118, .34);
  group.add(glow);
  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd7d0ba, roughness: 1, fog: false }));
  moon.position.set(46, 8, -8);
  moonPivot.add(moon);
  group.add(moonPivot);
  group.position.set(168, 53, -158);
  group.rotation.z = rng.range(-.25, .1);
  group.userData.moonPivot = moonPivot;
  return group;
}

function buildTerrain(planet, rng) {
  const size = 320, seg = 152;
  const positions = [], colors = [], indices = [];
  const low = new THREE.Color(planet.biome.low);
  const mid = new THREE.Color(planet.biome.mid);
  const high = new THREE.Color(planet.biome.high);
  const c = new THREE.Color();
  const sea = planet.biome.water ? -3.2 : -999;
  const height = (x, z) => terrainHeight(x, z, planet, sea);

  for (let iz = 0; iz <= seg; iz++) {
    for (let ix = 0; ix <= seg; ix++) {
      const x = (ix / seg - .5) * size;
      const z = (iz / seg - .5) * size;
      const h = height(x, z);
      positions.push(x, h, z);
      const n = fbm(x * .09 + 30, z * .09 - 17, planet.seed + 91, 3);
      if (h < sea + .8 && sea > -900) {
        c.copy(low).lerp(mid, .35).multiplyScalar(.58);
      } else {
        c.copy(low).lerp(mid, smoothstep(-2, 13, h));
        c.lerp(high, smoothstep(14, 41, h) * .9);
      }
      c.offsetHSL((n - .5) * .035, (n - .5) * .06, (n - .5) * .09);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let iz = 0; iz < seg; iz++) {
    for (let ix = 0; ix < seg; ix++) {
      const a = iz * (seg + 1) + ix;
      const b = a + 1;
      const d = a + seg + 1;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: .04, flatShading: true });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function terrainHeight(x, z, planet, sea = -999) {
  const d = Math.hypot(x, z);
  const base = (fbm(x * .013, z * .013, planet.seed, 5) - .48) * 47;
  const ridge = ridged(x * .025, z * .025, planet.seed + 77, 4) * 27;
  let h = base * .62 + ridge * .6 + 1.2;
  const flat = 1 - smoothstep(5, 23, d);
  h = h * (1 - flat * .86) + flat * 1.15;
  const basin = smoothstep(95, 150, d);
  h = h * (1 - basin * .35) - basin * 3;
  return h;
}

function resourceVisual(key, rng) {
  if (['DIHYDROGEN', 'SODIUM', 'COBALT', 'URANIUM', 'EMERIL', 'CHROMATIC'].includes(key)) return 'crystal';
  if (['FERRITE', 'COPPER', 'GOLD'].includes(key)) return 'rock';
  if (key === 'PARAFINIUM') return 'pod';
  return 'plant';
}

function buildNode(key, x, z, y, amount, rng, hero = false) {
  const res = RESOURCES[key];
  const color = new THREE.Color(res.color);
  const visual = resourceVisual(key, rng);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const spin = new THREE.Group();
  group.add(spin);
  const scale = hero ? 1.18 : rng.range(.72, 1.15);
  spin.scale.setScalar(scale);

  if (visual === 'crystal') {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: .22, metalness: .25, transparent: true, opacity: .92, flatShading: true });
    const shards = 3 + rng.int(3);
    for (let i = 0; i < shards; i++) {
      const h = rng.range(1.2, 3.4) * (i === 0 ? 1.2 : 1);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rng.range(.18, .42), h, 5), mat);
      cone.position.set(rng.range(-.5, .5), h / 2 - .08, rng.range(-.5, .5));
      cone.rotation.z = rng.range(-.22, .22);
      cone.rotation.x = rng.range(-.22, .22);
      spin.add(cone);
    }
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), new THREE.MeshStandardMaterial({ color: 0x202a2d, roughness: .92, metalness: .12, flatShading: true }));
    base.scale.set(1.2, .38, 1.1);
    base.position.y = -.06;
    spin.add(base);
    const glow = glowSprite(color, 4.6, .55);
    glow.position.y = .6;
    group.add(glow);
    group.userData.glow = glow;
  } else if (visual === 'rock') {
    const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.63), roughness: .6, metalness: .62, flatShading: true });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), mat);
    rock.scale.set(1.45, .78, 1.18);
    rock.position.y = .35;
    rock.rotation.set(rng.range(0, 1), rng.range(0, 3), rng.range(0, 1));
    spin.add(rock);
    for (let i = 0; i < 3; i++) {
      const vein = new THREE.Mesh(new THREE.TorusGeometry(rng.range(.42, .82), .025, 4, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
      vein.position.y = rng.range(.25, .6);
      vein.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      spin.add(vein);
    }
    const glow = glowSprite(color, 2.5, .24);
    glow.position.y = .45;
    group.add(glow);
    group.userData.glow = glow;
  } else if (visual === 'pod') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(.75, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2d2429, roughness: .5, metalness: .5 }));
    shell.scale.y = 1.35;
    shell.position.y = 1;
    spin.add(shell);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, roughness: .2 }));
    core.position.y = 1.02;
    spin.add(core);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.85, .025, 4, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending }));
      ring.position.y = .95;
      ring.rotation.x = Math.PI / 2 + rng.range(-.4, .4);
      ring.rotation.y = rng.range(0, 2);
      spin.add(ring);
    }
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0x27292b, roughness: .7, metalness: .5 }));
      leg.position.set(Math.cos(i * 2.1) * .45, .4, Math.sin(i * 2.1) * .45);
      leg.rotation.z = Math.cos(i * 2.1) * .35;
      leg.rotation.x = Math.sin(i * 2.1) * .35;
      spin.add(leg);
    }
    const glow = glowSprite(color, 5.2, .6);
    glow.position.y = 1;
    group.add(glow);
    group.userData.glow = glow;
  } else {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x234332, roughness: .9, flatShading: true });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.075, .15, 2.8, 5), stemMat);
    stem.position.y = 1.4;
    stem.rotation.z = rng.range(-.12, .12);
    spin.add(stem);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.5, 4), new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color(0x71c77b), .42), roughness: .82, flatShading: true }));
      const a = i * 1.37;
      leaf.position.set(Math.cos(a) * .65, 1.9 + i * .2, Math.sin(a) * .65);
      leaf.rotation.z = Math.cos(a) * .8;
      leaf.rotation.x = Math.sin(a) * .8;
      spin.add(leaf);
    }
    const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.45, roughness: .2 }));
    bulb.position.y = 3.05;
    spin.add(bulb);
    const glow = glowSprite(color, 3.2, .42);
    glow.position.y = 3;
    group.add(glow);
    group.userData.glow = glow;
  }

  group.userData.spin = spin;
  group.userData.visual = visual;
  group.userData.baseY = y;
  group.userData.phase = rng.range(0, Math.PI * 2);
  return { key, resource: res, group, amount, maxAmount: amount, alive: true, scanned: hero, visual, hero };
}

function buildShip() {
  const g = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: .48, metalness: .3, flatShading: true });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7448, roughness: .4, metalness: .35, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242d32, roughness: .4, metalness: .7, flatShading: true });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6ef2d8, emissive: 0x1fa58d, emissiveIntensity: 1.2, roughness: .08, metalness: .4, transparent: true, opacity: .82 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(.38, .58, 3.7, 6), cream);
  body.rotation.x = Math.PI / 2;
  body.position.z = .1;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.4, 1.5, 6), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.35;
  g.add(nose);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8), glass);
  cockpit.scale.set(1.05, .7, 1.55);
  cockpit.position.set(0, .33, -.38);
  g.add(cockpit);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.35, .12, 1.25), cream);
  wing.position.set(0, -.06, .42);
  wing.rotation.y = 0;
  g.add(wing);
  const wingEdgeL = new THREE.Mesh(new THREE.BoxGeometry(.55, .16, 1.7), orange);
  wingEdgeL.position.set(-1.64, -.02, .46);
  wingEdgeL.rotation.y = -.09;
  g.add(wingEdgeL);
  const wingEdgeR = wingEdgeL.clone();
  wingEdgeR.position.x = 1.64;
  wingEdgeR.rotation.y = .09;
  g.add(wingEdgeR);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(.19, .26, 1.1, 8), dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * .66, -.02, 1.92);
    g.add(engine);
    const exhaust = new THREE.Mesh(new THREE.CircleGeometry(.19, 10), new THREE.MeshBasicMaterial({ color: 0xff8b4d, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    exhaust.position.set(side * .66, -.02, 2.47);
    g.add(exhaust);
    const glow = glowSprite(0xff8b4d, 1.8, .8);
    glow.position.set(side * .66, -.02, 2.6);
    g.add(glow);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, .75, .7), orange);
    fin.position.set(side * 1.45, .32, 1.12);
    fin.rotation.z = side * .28;
    g.add(fin);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: 0x353d40, roughness: .55, metalness: .65 });
  for (const [x, z] of [[-1.1, -.6], [1.1, -.6], [0, 1.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.1, 5), legMat);
    leg.position.set(x, -.62, z);
    leg.rotation.z = x * .16;
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.24, .3, .12, 7), legMat);
    foot.position.set(x * 1.07, -1.16, z);
    g.add(foot);
  }
  const glow = glowSprite(0x37f2d4, 7, .18);
  glow.position.y = -.8;
  g.add(glow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.8, 2.9, 64), new THREE.MeshBasicMaterial({ color: 0x37f2d4, transparent: true, opacity: .4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.2;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

function buildMonolith() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: .66, metalness: .42, flatShading: true });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 8.2, 1.25), stone);
  slab.position.y = 4.1;
  g.add(slab);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.75, .3, 1.55), new THREE.MeshStandardMaterial({ color: 0x2c3538, roughness: .5, metalness: .55, flatShading: true }));
  cap.position.y = 8.25;
  g.add(cap);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 1024);
  ctx.strokeStyle = 'rgba(110,255,230,.9)';
  ctx.fillStyle = 'rgba(55,242,212,.8)';
  ctx.lineWidth = 3;
  const rng = new Rng(777);
  for (let y = 60; y < 960; y += 54) {
    const count = 1 + rng.int(3);
    for (let i = 0; i < count; i++) {
      const x = 38 + rng.int(5) * 38;
      ctx.beginPath();
      if (rng.chance(.35)) {
        ctx.arc(x, y, 7 + rng.int(6), 0, Math.PI * 2);
      } else {
        ctx.moveTo(x - 10, y - 12);
        ctx.lineTo(x + 6, y - 3);
        ctx.lineTo(x - 4, y + 13);
        ctx.lineTo(x + 13, y + 16);
      }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const glyphs = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 7.4), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glyphs.position.set(0, 4.2, .635);
  g.add(glyphs);
  const glow = glowSprite(0x37f2d4, 11, .18);
  glow.position.y = 4.3;
  g.add(glow);
  g.userData.glyphs = glyphs;
  g.userData.glow = glow;
  return g;
}

function buildSentinel() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x303a40, roughness: .32, metalness: .85, flatShading: true });
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.72, 0), dark);
  body.scale.y = 1.25;
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, .07, 5, 24), dark);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
  eye.position.z = -.67;
  g.add(eye);
  const light = glowSprite(0xff3b3b, 2.4, .7);
  light.position.z = -.7;
  g.add(light);
  g.userData.body = body;
  g.userData.ring = ring;
  g.userData.eye = eye;
  g.userData.light = light;
  return g;
}

function buildFauna(name, color, rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .05, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20312a, roughness: .9, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.48, 1.35, 5, 8), skin);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.1;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.39, 9, 7), skin);
  head.position.set(.98, 1.22, 0);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(.22, .48, 6), skin);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(1.3, 1.15, 0);
  g.add(snout);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(.16, .8, 4), new THREE.MeshStandardMaterial({ color: 0xff9b5b, roughness: .6, flatShading: true }));
  crest.position.set(.9, 1.7, 0);
  crest.rotation.z = -.26;
  g.add(crest);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 1.0, 5), dark);
      leg.position.set(.38 - i * .8, .45, side * .28);
      leg.rotation.z = Math.sin(i * 3) * .15;
      g.add(leg);
    }
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  eye.position.set(1.17, 1.32, .19);
  g.add(eye);
  g.userData.name = name;
  g.userData.legs = [];
  g.userData.color = color;
  return g;
}

function buildBeam(color = 0xff9b5b) {
  const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Line(geom, mat);
}

function buildMotes(rng) {
  const count = 260;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng.float() * Math.PI * 2;
    const r = Math.sqrt(rng.float()) * 34;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = rng.range(.4, 16);
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x9fffe9, size: .16, map: getGlowTexture(), transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false, alphaTest: .01 });
  return new THREE.Points(geom, mat);
}

export class World {
  constructor(planet, scene) {
    this.planet = planet;
    this.scene = scene;
    this.rng = new Rng(planet.seed);
    this.group = new THREE.Group();
    this.seaLevel = planet.biome.water ? -3.2 : -999;
    this.nodes = [];
    this.sentinels = [];
    this.fauna = [];
    this.scanTime = 0;
    this.running = true;
    scene.add(this.group);
    this.buildLights();
    this.buildSky();
    this.buildTerrain();
    this.buildScatter();
    this.buildResources();
    this.buildStructures();
    this.buildFauna();
    this.buildSentinels();
    this.buildFx();
  }

  heightAt(x, z) { return terrainHeight(x, z, this.planet, this.seaLevel); }

  buildLights() {
    const b = this.planet.biome;
    const hemi = new THREE.HemisphereLight(new THREE.Color(b.skyHorizon), new THREE.Color(b.low), 1.38);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(new THREE.Color(b.skyHorizon).lerp(new THREE.Color(0xffffff), .65), 2.15);
    sun.position.set(-74, 78, -58);
    this.group.add(sun);
    const fill = new THREE.DirectionalLight(new THREE.Color(b.accent), .42);
    fill.position.set(60, 26, 52);
    this.group.add(fill);
    this.group.add(new THREE.AmbientLight(0x334455, .46));
    this.sunLight = sun;
  }

  buildSky() {
    this.sky = makeSky(this.planet);
    this.group.add(this.sky);
    this.stars = makeStars();
    this.group.add(this.stars);
    const sunSprite = glowSprite(new THREE.Color(this.planet.biome.skyHorizon).lerp(new THREE.Color(0xffffff), .5), 74, .8);
    sunSprite.position.set(-170, 128, -280);
    this.group.add(sunSprite);
    this.sunSprite = sunSprite;
    this.giant = makeGasGiant(this.planet, this.rng);
    this.group.add(this.giant);
  }

  buildTerrain() {
    this.terrain = buildTerrain(this.planet, this.rng);
    this.group.add(this.terrain);
    const b = this.planet.biome;
    this.scene.fog = new THREE.FogExp2(new THREE.Color(b.fog), .0115);
    if (b.water) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400, 1, 1),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(b.skyMid).multiplyScalar(.55), roughness: .13, metalness: .55, transparent: true, opacity: .78 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = this.seaLevel;
      this.group.add(water);
      this.water = water;
    }
  }

  buildScatter() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b4234, roughness: .9, flatShading: true });
    const crownMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.planet.biome.mid).lerp(new THREE.Color(this.planet.biome.accent), .54), roughness: .88, flatShading: true });
    const counts = this.planet.biomeKey === 'BARREN' ? 34 : 94;
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .28, 2.8, 5), trunkMat, counts);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0), crownMat, counts);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < counts; i++) {
      let x, z, tries = 0;
      do {
        const a = rng.float() * Math.PI * 2;
        const r = 9 + Math.sqrt(rng.float()) * 135;
        x = Math.cos(a) * r; z = Math.sin(a) * r; tries++;
      } while (this.inResourceClearing(x, z) && tries < 10);
      const y = this.heightAt(x, z);
      const scale = rng.range(.55, 1.45);
      const trunkH = 2.8 * scale;
      dummy.position.set(x, y + trunkH / 2 - .05, z);
      dummy.rotation.set(rng.range(-.08, .08), rng.range(0, 6.28), rng.range(-.08, .08));
      dummy.scale.set(scale * .85, scale, scale * .85);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + trunkH + .55 * scale, z);
      dummy.rotation.set(rng.range(0, 1), rng.range(0, 6.28), rng.range(0, 1));
      dummy.scale.set(scale * rng.range(.8, 1.25), scale * rng.range(1.1, 1.65), scale * rng.range(.8, 1.25));
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      color.setHSL(rng.range(.25, .43), rng.range(.32, .6), rng.range(.3, .54));
      crowns.setColorAt(i, color);
    }
    crowns.instanceColor.needsUpdate = true;
    this.group.add(trunks, crowns);

    const rockCount = 120;
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.planet.biome.low).lerp(new THREE.Color(this.planet.biome.high), .3), roughness: .95, metalness: .08, flatShading: true });
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, rockCount);
    for (let i = 0; i < rockCount; i++) {
      const a = rng.float() * Math.PI * 2;
      const r = 8 + Math.sqrt(rng.float()) * 140;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.heightAt(x, z);
      const s = rng.range(.3, 1.7);
      dummy.position.set(x, y + s * .24, z);
      dummy.rotation.set(rng.range(0, 3), rng.range(0, 6), rng.range(0, 3));
      dummy.scale.set(s * rng.range(.8, 1.4), s * rng.range(.45, .8), s * rng.range(.8, 1.3));
      dummy.updateMatrix();
      this.rocks.setMatrixAt(i, dummy.matrix);
    }
    this.group.add(this.rocks);

    const sporeCount = this.planet.biomeKey === 'BARREN' ? 48 : 130;
    const sporePos = new Float32Array(sporeCount * 3);
    const sporeCol = new Float32Array(sporeCount * 3);
    const sporeColor = new THREE.Color();
    for (let i = 0; i < sporeCount; i++) {
      const a = rng.float() * Math.PI * 2;
      const r = 2.5 + Math.sqrt(rng.float()) * 45;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      sporePos[i * 3] = x;
      sporePos[i * 3 + 1] = this.heightAt(x, z) + rng.range(.35, 2.6);
      sporePos[i * 3 + 2] = z;
      sporeColor.set(rng.chance(.55) ? this.planet.biome.accent : (rng.chance(.5) ? this.planet.biome.skyHorizon : 0xff7b4d));
      sporeCol[i * 3] = sporeColor.r;
      sporeCol[i * 3 + 1] = sporeColor.g;
      sporeCol[i * 3 + 2] = sporeColor.b;
    }
    const sporeGeom = new THREE.BufferGeometry();
    sporeGeom.setAttribute('position', new THREE.BufferAttribute(sporePos, 3));
    sporeGeom.setAttribute('color', new THREE.BufferAttribute(sporeCol, 3));
    this.spores = new THREE.Points(sporeGeom, new THREE.PointsMaterial({ size: .24, map: getGlowTexture(), vertexColors: true, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, alphaTest: .01 }));
    this.group.add(this.spores);

    const grassCount = this.planet.biomeKey === 'BARREN' ? 110 : 660;
    if (grassCount) {
      const blade = new THREE.ConeGeometry(.075, 1.3, 3);
      blade.translate(0, .65, 0);
      const grassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.planet.biome.accent).lerp(new THREE.Color(this.planet.biome.mid), .5), roughness: .92, flatShading: true });
      this.grass = new THREE.InstancedMesh(blade, grassMat, grassCount);
      for (let i = 0; i < grassCount; i++) {
        const a = rng.float() * Math.PI * 2;
        const r = 4 + Math.sqrt(rng.float()) * 58;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const y = this.heightAt(x, z);
        const s = rng.range(.55, 1.55);
        dummy.position.set(x, y, z);
        dummy.rotation.set(rng.range(-.12, .12), rng.range(0, 6.28), rng.range(-.16, .16));
        dummy.scale.set(s * rng.range(.8, 1.4), s * rng.range(.65, 1.15), s * rng.range(.8, 1.4));
        dummy.updateMatrix();
        this.grass.setMatrixAt(i, dummy.matrix);
      }
      this.group.add(this.grass);
    }

    const bushCount = this.planet.biomeKey === 'BARREN' ? 32 : 132;
    const bushMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.planet.biome.mid).lerp(new THREE.Color(this.planet.biome.accent), .3), roughness: .9, flatShading: true });
    this.bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.68, 0), bushMat, bushCount);
    for (let i = 0; i < bushCount; i++) {
      const a = rng.float() * Math.PI * 2;
      const r = 3 + Math.sqrt(rng.float()) * 44;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.heightAt(x, z);
      const s = rng.range(.35, 1.02);
      dummy.position.set(x, y + s * .24, z);
      dummy.rotation.set(rng.range(0, 1), rng.range(0, 6.28), rng.range(0, 1));
      dummy.scale.set(s * rng.range(.9, 1.5), s * rng.range(.5, .9), s * rng.range(.9, 1.4));
      dummy.updateMatrix();
      this.bushes.setMatrixAt(i, dummy.matrix);
      color.setHSL(rng.range(.28, .46), rng.range(.3, .58), rng.range(.25, .48));
      this.bushes.setColorAt(i, color);
    }
    this.bushes.instanceColor.needsUpdate = true;
    this.group.add(this.bushes);
  }

  inResourceClearing(x, z) {
    return Math.hypot(x - 7.2, z + 8.6) < 7 || Math.hypot(x + 5.5, z + 11) < 6 || Math.hypot(x - 12, z + 13) < 8 || Math.hypot(x + 27, z + 34) < 9;
  }

  makeNodeAt(key, x, z, amount, hero = false) {
    const y = this.heightAt(x, z);
    const node = buildNode(key, x, z, y, amount, this.rng, hero);
    node.group.rotation.y = this.rng.range(0, Math.PI * 2);
    this.group.add(node.group);
    this.nodes.push(node);
    return node;
  }

  buildResources() {
    const res = this.planet.resources;
    const pick = i => RESOURCES[res[i % res.length]] ? res[i % res.length] : 'CARBON';
    this.makeNodeAt(this.planet.biomeKey === 'LUSH' ? 'DIHYDROGEN' : pick(0), 7.2, -8.6, 130, true);
    this.makeNodeAt('CARBON', -5.5, -11, 82, true);
    this.makeNodeAt(pick(1), 12, -16.5, 74, true);
    this.makeNodeAt('SODIUM', -9.5, -20, 68, true);
    for (let i = 0; i < 42; i++) {
      const a = this.rng.float() * Math.PI * 2;
      const r = 13 + Math.sqrt(this.rng.float()) * 108;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x, z) < 12) continue;
      const key = this.rng.pick(res);
      const amount = 34 + this.rng.int(78);
      this.makeNodeAt(key, x, z, amount, this.rng.chance(.08));
    }
  }

  buildStructures() {
    const ship = buildShip();
    const sx = 12.5, sz = -13.5;
    ship.position.set(sx, this.heightAt(sx, sz) + 1.25, sz);
    ship.rotation.y = -.72;
    this.group.add(ship);
    this.ship = ship;
    this.shipPos = new THREE.Vector3(sx, this.heightAt(sx, sz) + 1.25, sz);

    const mono = buildMonolith();
    const mx = -27, mz = -34;
    mono.position.set(mx, this.heightAt(mx, mz), mz);
    mono.rotation.y = .45;
    this.group.add(mono);
    this.monolith = mono;
    this.monolithPos = new THREE.Vector3(mx, this.heightAt(mx, mz), mz);
  }

  buildFauna() {
    const rng = this.rng;
    const palette = [0xb8d47a, 0xc98a6a, 0x86b9c9, 0xd1b2d9, 0xe4c47a];
    const names = this.planet.faunaNames.length ? this.planet.faunaNames : ['Rylak', 'Vexoth', 'Thalune'];
    const count = Math.min(5, Math.max(2, names.length));
    for (let i = 0; i < count; i++) {
      const creature = buildFauna(names[i % names.length], palette[i % palette.length], rng);
      const a = rng.float() * Math.PI * 2;
      const r = rng.range(18, 48);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      creature.position.set(x, this.heightAt(x, z), z);
      creature.userData.radius = r;
      creature.userData.angle = a;
      creature.userData.speed = rng.range(.08, .18) * (rng.chance(.5) ? 1 : -1);
      creature.userData.phase = rng.float() * 10;
      this.group.add(creature);
      this.fauna.push(creature);
    }
  }

  buildSentinels() {
    const rng = this.rng;
    const count = 3;
    for (let i = 0; i < count; i++) {
      const s = buildSentinel();
      const a = 2.7 + i * 1.55;
      const r = 38 + i * 7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.heightAt(x, z) + 2.7;
      s.position.set(x, y, z);
      s.userData = { ...s.userData, alive: true, hp: 100, maxHp: 100, angle: a, radius: r, phase: rng.float() * 10, baseY: y, hostile: false, attackCd: 0, hit: 0 };
      this.group.add(s);
      this.sentinels.push(s);
    }
  }

  buildFx() {
    this.beam = buildBeam(0xff9b5b);
    this.beam.visible = false;
    this.group.add(this.beam);
    this.laser = buildBeam(0x57f2d8);
    this.laser.visible = false;
    this.group.add(this.laser);
    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(.92, 1, 80),
      new THREE.MeshBasicMaterial({ color: 0x37f2d4, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.visible = false;
    this.group.add(this.scanRing);
    this.motes = buildMotes(this.rng);
    this.group.add(this.motes);
    this.impact = glowSprite(0xffb26b, 1.5, 0);
    this.group.add(this.impact);
  }

  pulseScan(position) {
    this.scanRing.position.set(position.x, this.heightAt(position.x, position.z) + .25, position.z);
    this.scanRing.scale.setScalar(1);
    this.scanRing.material.opacity = .9;
    this.scanRing.visible = true;
    this.scanTime = 0;
  }

  showBeam(from, to, kind = 'mine', dt = 0) {
    const beam = kind === 'mine' ? this.beam : this.laser;
    const other = kind === 'mine' ? this.laser : this.beam;
    other.visible = false;
    const pos = beam.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    beam.material.opacity = .8;
    beam.visible = true;
    this.impact.position.copy(to);
    this.impact.material.opacity = .65;
    this.impact.material.color.setHex(kind === 'mine' ? 0xffb26b : 0x57f2d8);
    this.impact.scale.setScalar(.9 + Math.random() * .8);
  }

  hideBeams() {
    this.beam.visible = false;
    this.laser.visible = false;
  }

  nearestNode(camera, maxDist = 14, aim = .72) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position;
    let best = null, bestScore = -1;
    for (const node of this.nodes) {
      if (!node.alive || node.amount <= 0) continue;
      const p = node.group.position.clone();
      p.y += 1.2;
      const v = p.clone().sub(origin);
      const d = v.length();
      if (d > maxDist) continue;
      const dot = v.normalize().dot(dir);
      if (dot < aim) continue;
      const score = dot - d * .012;
      if (score > bestScore) { bestScore = score; best = node; }
    }
    return best;
  }

  nearestSentinel(camera, maxDist = 70, aim = .55) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let best = null, bestScore = -1;
    for (const s of this.sentinels) {
      if (!s.userData.alive) continue;
      const v = s.position.clone().sub(camera.position);
      const d = v.length();
      if (d > maxDist) continue;
      const dot = v.normalize().dot(dir);
      if (dot < aim) continue;
      const score = dot - d * .004;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  damageNode(node, amount = 12) {
    node.amount = Math.max(0, node.amount - amount);
    const ratio = node.amount / node.maxAmount;
    node.group.userData.spin.scale.setScalar((node.hero ? 1.18 : .9) * (.25 + ratio * .75));
    if (node.group.userData.glow) node.group.userData.glow.material.opacity = .18 + ratio * .4;
    if (node.amount <= 0) {
      node.alive = false;
      node.group.visible = false;
      return true;
    }
    return false;
  }

  damageSentinel(sentinel, amount = 22) {
    sentinel.userData.hp -= amount;
    sentinel.userData.hit = .18;
    sentinel.userData.hostile = true;
    if (sentinel.userData.hp <= 0) {
      sentinel.userData.alive = false;
      sentinel.visible = false;
      return true;
    }
    return false;
  }

  update(dt, time, camera, player, game) {
    const t = time * .001;
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    if (this.giant.userData.moonPivot) this.giant.userData.moonPivot.rotation.y = t * .04;
    if (this.water) this.water.position.x = camera.position.x * 0;

    for (const node of this.nodes) {
      if (!node.alive) continue;
      const u = node.group.userData;
      if (u.visual === 'crystal' || u.visual === 'pod') u.spin.rotation.y = t * .18 + u.phase;
      if (u.visual === 'pod') node.group.position.y = u.baseY + Math.sin(t * 1.1 + u.phase) * .12;
      if (u.glow) u.glow.material.opacity = .25 + Math.sin(t * 2 + u.phase) * .1 + (node.hero ? .18 : 0);
    }

    this.ship.position.y = this.shipPos.y + Math.sin(t * .9) * .06;
    this.ship.userData.ring.rotation.z = t * .12;
    this.ship.userData.ring.material.opacity = .26 + Math.sin(t * 1.7) * .1;
    this.monolith.userData.glyphs.material.opacity = .65 + Math.sin(t * 2.3) * .18;
    this.monolith.userData.glow.material.opacity = .11 + Math.sin(t * 2.3) * .05;

    for (const f of this.fauna) {
      const u = f.userData;
      u.angle += u.speed * dt;
      const x = Math.cos(u.angle) * u.radius;
      const z = Math.sin(u.angle) * u.radius;
      f.position.x = x;
      f.position.z = z;
      f.position.y = this.heightAt(x, z) + Math.abs(Math.sin(t * 2.2 + u.phase)) * .12;
      f.rotation.y = -u.angle + (u.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
      f.rotation.z = Math.sin(t * 1.4 + u.phase) * .035;
    }

    for (const s of this.sentinels) {
      if (!s.userData.alive) continue;
      const u = s.userData;
      u.attackCd = Math.max(0, u.attackCd - dt);
      if (u.hostile && game && game.wanted > 0) {
        const dx = player.position.x - s.position.x;
        const dz = player.position.z - s.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 5.5) {
          const speed = 3.1;
          s.position.x += (dx / dist) * speed * dt;
          s.position.z += (dz / dist) * speed * dt;
        }
        s.position.y = this.heightAt(s.position.x, s.position.z) + 2.6 + Math.sin(t * 2 + u.phase) * .25;
        s.rotation.y = Math.atan2(dx, dz) + Math.PI;
        if (dist < 18 && u.attackCd <= 0) {
          u.attackCd = 1.7;
          if (game) game.hitBySentinel(s);
        }
      } else {
        u.angle += dt * .07;
        const x = player.position.x + Math.cos(u.angle) * u.radius;
        const z = player.position.z + Math.sin(u.angle) * u.radius;
        s.position.x = x;
        s.position.z = z;
        s.position.y = this.heightAt(x, z) + 2.7 + Math.sin(t * 1.5 + u.phase) * .3;
        s.rotation.y = -u.angle + Math.PI / 2;
      }
      if (u.hit > 0) {
        u.hit -= dt;
        u.body.material.emissive = new THREE.Color(0xff4444);
        u.body.material.emissiveIntensity = 1.2;
      } else {
        u.body.material.emissiveIntensity = .0;
      }
      u.ring.rotation.z = t * 2.1 + u.phase;
      u.eye.scale.setScalar(1 + Math.sin(t * 5 + u.phase) * .16);
      u.light.material.opacity = u.hostile ? .65 + Math.sin(t * 7) * .25 : .35;
    }

    if (this.beam.visible) {
      this.beam.material.opacity = .55 + Math.sin(t * 28) * .25;
      this.laser.material.opacity = .6 + Math.sin(t * 22) * .25;
    } else {
      this.laser.material.opacity = Math.max(0, this.laser.material.opacity - dt * 3);
      if (this.laser.material.opacity <= 0) this.laser.visible = false;
    }
    this.impact.material.opacity = Math.max(0, this.impact.material.opacity - dt * 4);

    if (this.scanRing.visible) {
      this.scanTime += dt;
      const s = 1 + this.scanTime * 34;
      this.scanRing.scale.setScalar(s);
      this.scanRing.material.opacity = Math.max(0, .8 * (1 - this.scanTime / 2.4));
      if (this.scanTime > 2.4) this.scanRing.visible = false;
    }

    this.motes.rotation.y = t * .01;
    const mp = this.motes.material;
    mp.opacity = .35 + Math.sin(t * .8) * .12;
    if (this.spores) {
      this.spores.rotation.y = t * .008;
      this.spores.material.opacity = .58 + Math.sin(t * 1.3) * .16;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map && m.map !== glowTexture) m.map.dispose();
          m.dispose();
        }
      }
    });
    if (this.beam) { this.beam.geometry.dispose(); this.beam.material.dispose(); }
  }
}

export { terrainHeight };
