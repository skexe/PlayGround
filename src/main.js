import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { SpaceScene } from './space.js';
import { clamp, formatNumber } from './utils.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);
const autostart = params.get('autostart') === '1';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 1700);
camera.rotation.order = 'YXZ';
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.42, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const world = new World(scene, seed);

const systemNames = ['KORVAX-7', 'IXAR-9', 'VETAR-3', 'ORISON-4', 'TELAMON-6'];
const planetNames = ['KORVAX PRIME', 'IXAR-9B', 'VETAR MINOR', 'ORISON IV', 'TELAMON II'];
const systemIndex = Math.abs(seed - 7) % systemNames.length;
const systemName = systemNames[systemIndex];
const planetName = planetNames[systemIndex];
if (seed !== 7) {
  const locationName = document.querySelector('.hud-location strong');
  const locationSub = document.querySelector('.hud-location small');
  if (locationName) locationName.textContent = planetName;
  if (locationSub) locationSub.textContent = `${systemName} // CLASE ${systemIndex > 2 ? 'K' : 'G'} // EUCLID`;
  const spaceSystem = document.querySelector('.space-system strong');
  if (spaceSystem) spaceSystem.textContent = systemName;
}

const state = {
  mode: 'menu',
  started: false,
  oxygen: 100,
  shield: 88,
  hazard: 0.18,
  storm: false,
  stormTimer: 34,
  units: 1240,
  nanites: 18,
  resources: { ferrita: 0, carbono: 0, sodio: 0, oxigeno: 0 },
  warpCore: false,
  missionIndex: 0,
  scanCooldown: 0,
  scanPulse: 0,
  minedCount: 0,
  sentinel: null,
  sentinelSpawned: false,
  readMonolith: false,
  panelOpen: false,
  launchStarted: false,
  warpReady: false,
  lastFrame: performance.now(),
};

const player = {
  position: new THREE.Vector3(world.spawn.x, world.spawn.y + 1.72, world.spawn.z),
  velocity: new THREE.Vector3(),
  verticalVelocity: 0,
  yaw: 0.04,
  pitch: -0.035,
  eye: 1.72,
  onGround: true,
  bob: 0,
  distance: 0,
  moving: false,
};

const keys = new Set();
const touchMove = new THREE.Vector2();
let touchLook = null;
let mobileMining = false;
let mining = false;
let draggingLook = false;
let targetNode = null;
let targetSentinel = false;
let toolHeat = 0;
let overheatTimer = 0;
let toolRecoil = 0;
let cinematicTime = 0;

const missions = [
  {
    title: 'RECOLECTA FERRITA',
    desc: 'Extrae mineral ferroso de las rocas oscuras cercanas.',
    goal: 12,
    reward: 250,
    check: () => state.resources.ferrita >= 12,
    value: () => state.resources.ferrita,
  },
  {
    title: 'RECOLECTA CARBONO',
    desc: 'La flora bioluminiscente contiene carbono orgánico.',
    goal: 8,
    reward: 300,
    check: () => state.resources.carbono >= 8,
    value: () => state.resources.carbono,
  },
  {
    title: 'RECOLECTA SODIO',
    desc: 'Los cristales amarillos almacenan energía térmica.',
    goal: 5,
    reward: 350,
    check: () => state.resources.sodio >= 5,
    value: () => state.resources.sodio,
  },
  {
    title: 'FABRICA UN NÚCLEO DE SALTO',
    desc: 'Abre el inventario con C y fabrica el núcleo de hiperimpulso.',
    goal: 1,
    reward: 400,
    check: () => state.warpCore,
    value: () => (state.warpCore ? 1 : 0),
  },
  {
    title: 'REGRESA A LA NAVE',
    desc: 'La nave te espera en la zona de aterrizaje. Pulsa E para despegar.',
    goal: 1,
    reward: 500,
    check: () => false,
    value: () => 0,
  },
];

/* ---------------- build tool ---------------- */
const tool = new THREE.Group();
const toolMuzzle = new THREE.Object3D();
{
  const cream = new THREE.MeshStandardMaterial({ color: 0x7a715c, roughness: 0.72, metalness: 0.28, emissive: 0x120c08, emissiveIntensity: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd46434, roughness: 0.48, metalness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2a2d, roughness: 0.58, metalness: 0.55 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x53f5d8, emissive: 0x37ffe1, emissiveIntensity: 3.2, roughness: 0.2 });

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.38), cream);
  stock.position.set(0, -0.01, 0.17);
  tool.add(stock);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.62), cream);
  body.position.set(0, 0.015, -0.22);
  tool.add(body);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.72), orange);
  rail.position.set(0, 0.13, -0.25);
  tool.add(rail);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.62, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, -0.72);
  tool.add(barrel);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.18, 8), glow);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.035, -1.04);
  tool.add(tip);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.07), new THREE.MeshBasicMaterial({ color: 0x7affe6, transparent: true, opacity: 0.9 }));
  screen.position.set(0.091, 0.045, -0.22);
  screen.rotation.y = Math.PI / 2;
  tool.add(screen);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), dark);
  grip.position.set(0, -0.16, 0.08);
  grip.rotation.x = 0.28;
  tool.add(grip);

  const toolLight = new THREE.PointLight(0xffd7b0, 0.18, 2.2, 2);
  toolLight.position.set(0.15, 0.35, -0.35);
  tool.add(toolLight);

  for (let i = 0; i < 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.17), orange);
    fin.position.set((i - 1) * 0.055, 0.14, -0.82);
    fin.rotation.x = -0.18;
    tool.add(fin);
  }

  const muzzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: world.glowTexture,
    color: 0x62f5d5,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  muzzleGlow.position.set(0, 0.035, -1.16);
  muzzleGlow.scale.setScalar(0.32);
  tool.add(muzzleGlow);
  tool.userData.muzzleGlow = muzzleGlow;

  toolMuzzle.position.set(0, 0.035, -1.14);
  tool.add(toolMuzzle);

  tool.position.set(0.54, -0.47, -1.28);
  tool.rotation.set(-0.05, -0.06, 0.03);
  tool.scale.setScalar(0.6);
  tool.visible = false;
  camera.add(tool);
}

/* ---------------- beam + particles ---------------- */
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.055, 1, 6, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff7f32, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
);
beam.visible = false;
scene.add(beam);

const impactGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: world.glowTexture,
  color: 0xffb05e,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
}));
impactGlow.visible = false;
impactGlow.scale.setScalar(1.2);
scene.add(impactGlow);

const MAX_PARTICLES = 240;
const particlePositions = new Float32Array(MAX_PARTICLES * 3);
const particleColors = new Float32Array(MAX_PARTICLES * 3);
const particleVelocities = Array.from({ length: MAX_PARTICLES }, () => new THREE.Vector3());
const particleLife = new Float32Array(MAX_PARTICLES);
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
  size: 0.18,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
}));
particles.frustumCulled = false;
scene.add(particles);
for (let i = 0; i < MAX_PARTICLES; i += 1) particlePositions[i * 3 + 1] = -1000;

function burst(position, color, count = 16, force = 2.4) {
  const c = new THREE.Color(color);
  let spawned = 0;
  for (let i = 0; i < MAX_PARTICLES && spawned < count; i += 1) {
    if (particleLife[i] > 0) continue;
    particleLife[i] = 0.7 + Math.random() * 0.7;
    particlePositions[i * 3] = position.x + (Math.random() - 0.5) * 0.45;
    particlePositions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.45;
    particlePositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.45;
    particleVelocities[i].set((Math.random() - 0.5) * force, Math.random() * force + 0.6, (Math.random() - 0.5) * force);
    particleColors[i * 3] = c.r;
    particleColors[i * 3 + 1] = c.g;
    particleColors[i * 3 + 2] = c.b;
    spawned += 1;
  }
  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.color.needsUpdate = true;
}

function updateParticles(dt) {
  let changed = false;
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    if (particleLife[i] <= 0) continue;
    particleLife[i] -= dt;
    if (particleLife[i] <= 0) {
      particlePositions[i * 3 + 1] = -1000;
    } else {
      particleVelocities[i].y -= dt * 2.8;
      particlePositions[i * 3] += particleVelocities[i].x * dt;
      particlePositions[i * 3 + 1] += particleVelocities[i].y * dt;
      particlePositions[i * 3 + 2] += particleVelocities[i].z * dt;
    }
    changed = true;
  }
  if (changed) particleGeometry.attributes.position.needsUpdate = true;
}

/* ---------------- UI helpers ---------------- */
const ui = {
  boot: $('#boot'),
  bootBar: $('#bootBar'),
  bootStatus: $('#bootStatus'),
  menu: $('#menu'),
  codex: $('#codex'),
  hud: $('#hud'),
  mobileUI: $('#mobileUI'),
  panel: $('#panel'),
  launch: $('#launch'),
  spaceHud: $('#spaceHud'),
  arrival: $('#arrival'),
  flash: $('#flash'),
  units: $('#units'),
  nanites: $('#nanites'),
  panelUnits: $('#panelUnits'),
  panelNanites: $('#panelNanites'),
  oxygenBar: $('#oxygenBar'),
  oxygenVal: $('#oxygenVal'),
  shieldBar: $('#shieldBar'),
  shieldVal: $('#shieldVal'),
  hazardBar: $('#hazardBar'),
  hazardVal: $('#hazardVal'),
  missionStep: $('#missionStep'),
  missionTitle: $('#missionTitle'),
  missionDesc: $('#missionDesc'),
  missionBar: $('#missionBar'),
  missionProgress: $('#missionProgress'),
  missionReward: $('#missionReward'),
  reticle: $('#reticle'),
  reticleLabel: $('#reticleLabel'),
  targetCard: $('#targetCard'),
  targetKind: $('#targetKind'),
  targetName: $('#targetName'),
  targetBar: $('#targetBar'),
  targetHint: $('#targetHint'),
  compassHeading: $('#compassHeading'),
  compassDeg: $('#compassDeg'),
  compassTicks: $('#compassTicks'),
  notifications: $('#notifications'),
  scanVignette: $('#scanVignette'),
  interactPrompt: $('#interactPrompt'),
  interactText: $('#interactText'),
  radar: $('#radar'),
  toolCharge: $('#toolCharge'),
  toolStatus: $('#toolStatus'),
  quickbar: $('#quickbar'),
  slots: $('#slots'),
  craftBtn: $('#craftBtn'),
  launchBar: $('#launchBar'),
  launchPct: $('#launchPct'),
  launchStatus: $('#launchStatus'),
  launchLog: $('#launchLog'),
  spaceSpeed: $('#spaceSpeed'),
  warpBtn: $('#warpBtn'),
  warpOverlay: $('#warpOverlay'),
  warpTitle: $('#warpTitle'),
  warpSub: $('#warpSub'),
  bootStatusEl: $('#bootStatus'),
};

const compassTicks = [];
{
  const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };
  for (let angle = 0; angle < 360; angle += 15) {
    const tick = document.createElement('i');
    const label = document.createElement('span');
    if (angle % 90 === 0) {
      tick.classList.add('major');
      label.textContent = labels[angle];
    } else if (angle % 45 === 0) {
      label.textContent = String(angle).padStart(3, '0');
    }
    ui.compassTicks.append(tick, label);
    compassTicks.push({ angle, tick, label });
  }
}

function notify(title, message, orange = false) {
  const el = document.createElement('div');
  el.className = `notice${orange ? ' orange' : ''}`;
  el.innerHTML = `<div class="notice-icon">${orange ? '!' : '◇'}</div><div><strong>${title}</strong><span>${message}</span></div>`;
  ui.notifications.prepend(el);
  while (ui.notifications.children.length > 4) ui.notifications.lastElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 420);
  }, 4200);
}

function flash() {
  ui.flash.classList.add('on');
  setTimeout(() => ui.flash.classList.remove('on'), 100);
}

function updateResourcesUI() {
  ui.units.textContent = formatNumber(state.units);
  ui.nanites.textContent = formatNumber(state.nanites);
  ui.panelUnits.textContent = formatNumber(state.units);
  ui.panelNanites.textContent = formatNumber(state.nanites);
  for (const type of Object.keys(state.resources)) {
    const quick = ui.quickbar.querySelector(`[data-res="${type}"] b`);
    if (quick) quick.textContent = state.resources[type];
  }
  updateInventory();
}

function updateInventory() {
  const colors = {
    ferrita: 'linear-gradient(135deg,#c66b41,#5b2d28)',
    carbono: 'linear-gradient(135deg,#f08e57,#8c3f2c)',
    sodio: 'linear-gradient(135deg,#ffe487,#a8741e)',
    oxigeno: 'linear-gradient(135deg,#9bfff1,#1a7c73)',
  };
  const items = [
    ['ferrita', 'FERRITA', state.resources.ferrita],
    ['carbono', 'CARBONO', state.resources.carbono],
    ['sodio', 'SODIO', state.resources.sodio],
    ['oxigeno', 'OXÍGENO', state.resources.oxigeno],
  ];
  if (state.warpCore) items.push(['core', 'NÚCLEO DE SALTO', 1]);
  let html = '';
  for (let i = 0; i < 24; i += 1) {
    const item = items[i];
    if (item) {
      const bg = item[0] === 'core'
        ? 'radial-gradient(circle at 40% 38%,#fff4bd,#ff9b4a 40%,#6c2a16)'
        : colors[item[0]];
      html += `<div class="slot filled"><i style="background:${bg};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></i><span>${item[1]}</span><b>${item[2]}</b></div>`;
    } else {
      html += '<div class="slot"><i class="empty">+</i></div>';
    }
  }
  ui.slots.innerHTML = html;
}

function updateMissionUI() {
  const index = Math.min(state.missionIndex, missions.length - 1);
  const mission = missions[index];
  ui.missionStep.textContent = `${String(index + 1).padStart(2, '0')} / ${String(missions.length).padStart(2, '0')}`;
  ui.missionTitle.textContent = mission.title;
  ui.missionDesc.textContent = mission.desc;
  ui.missionReward.textContent = `+ ${mission.reward} UNIDADES`;
  if (index === 4) {
    const distance = player.position.distanceTo(world.shipPosition);
    const progress = clamp(1 - distance / 70, 0, 1);
    ui.missionBar.style.width = `${progress * 100}%`;
    ui.missionProgress.textContent = `NAVE A ${Math.round(distance)} m`;
  } else {
    const value = Math.min(mission.value(), mission.goal);
    ui.missionBar.style.width = `${(value / mission.goal) * 100}%`;
    ui.missionProgress.textContent = `${Math.floor(value)} / ${mission.goal}`;
  }
}

function refreshMission() {
  let guard = 0;
  while (state.missionIndex < 3 && guard < 4) {
    const mission = missions[state.missionIndex];
    if (!mission.check()) break;
    state.units += mission.reward;
    state.missionIndex += 1;
    const next = missions[state.missionIndex];
    notify('OBJETIVO COMPLETADO', `+${mission.reward} unidades · ${next ? next.title : 'Regresa a la nave'}`, false);
    guard += 1;
  }
  if (state.missionIndex === 3 && state.warpCore) {
    state.units += missions[3].reward;
    state.missionIndex = 4;
    notify('NÚCLEO DE SALTO LISTO', 'Regresa a la nave y pulsa E para despegar.', true);
  }
  updateResourcesUI();
  updateMissionUI();
}

function updateVitalsUI() {
  ui.oxygenVal.textContent = `${Math.round(state.oxygen)}%`;
  ui.oxygenBar.style.width = `${clamp(state.oxygen, 0, 100)}%`;
  ui.shieldVal.textContent = `${Math.round(state.shield)}%`;
  ui.shieldBar.style.width = `${clamp(state.shield, 0, 100)}%`;
  ui.hazardBar.style.width = `${clamp(state.hazard * 100, 0, 100)}%`;
  ui.hazardVal.textContent = state.storm ? 'TORMENTA' : 'ESTABLE';
}

function updateCompass() {
  const heading = ((-player.yaw * 180) / Math.PI % 360 + 360) % 360;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  ui.compassHeading.textContent = labels[Math.round(heading / 45) % 8];
  ui.compassDeg.textContent = `${String(Math.round(heading)).padStart(3, '0')}°`;
  for (const { angle, tick, label } of compassTicks) {
    let delta = ((angle - heading + 540) % 360) - 180;
    const x = 50 + (delta / 180) * 50;
    const opacity = Math.max(0, 1 - Math.abs(delta) / 95);
    tick.style.left = `${x}%`;
    tick.style.opacity = opacity;
    label.style.left = `${x}%`;
    label.style.transform = 'translateX(-50%)';
    label.style.opacity = opacity * 0.9;
  }
}

function drawRadar() {
  const ctx = ui.radar.getContext('2d');
  const w = ui.radar.width;
  const h = ui.radar.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.46;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = 'rgba(98,245,213,0.12)';
  ctx.lineWidth = 1;
  for (const r of [0.33, 0.66, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();
  ctx.fillStyle = 'rgba(98,245,213,0.08)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, -Math.PI * 0.72, -Math.PI * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const toRadar = (x, z) => {
    const dx = x - player.position.x;
    const dz = z - player.position.z;
    const right = dx * rightX + dz * rightZ;
    const forward = dx * forwardX + dz * forwardZ;
    const scale = radius / 62;
    return [cx + right * scale, cy - forward * scale, Math.hypot(dx, dz)];
  };

  for (const node of world.nodes) {
    if (node.depleted) continue;
    const [x, y, distance] = toRadar(node.position.x, node.position.z);
    if (distance > 62) continue;
    const colors = { ferrita: '#ff8a4c', carbono: '#ff6f4f', sodio: '#ffdd7a', oxigeno: '#6ffff0' };
    ctx.fillStyle = colors[node.type];
    ctx.globalAlpha = node.scanned ? 1 : 0.58;
    ctx.beginPath();
    ctx.arc(x, y, node.scanned ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const [sx, sy, sd] = toRadar(world.shipPosition.x, world.shipPosition.z);
  if (sd < 62) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#ffb15d';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const [mx, my, md] = toRadar(world.monolithPosition.x, world.monolithPosition.z);
  if (md < 62) {
    ctx.fillStyle = '#c58cff';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }

  ctx.fillStyle = '#f4ead4';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function updateToolUI() {
  const charge = clamp(100 - toolHeat, 0, 100);
  ui.toolCharge.style.width = `${charge}%`;
  if (overheatTimer > 0) {
    ui.toolStatus.textContent = 'SOBRECALENTADO';
    ui.toolStatus.style.color = 'var(--red)';
  } else if (mining) {
    ui.toolStatus.textContent = 'EXTRAYENDO';
    ui.toolStatus.style.color = 'var(--orange-hot)';
  } else {
    ui.toolStatus.textContent = 'LISTO';
    ui.toolStatus.style.color = 'var(--cyan)';
  }
}

function updateTargetUI() {
  if (targetNode) {
    ui.targetCard.classList.add('visible');
    ui.reticle.classList.add('active');
    ui.targetKind.textContent = targetNode.depleted ? 'RECURSO AGOTADO' : 'RECURSO';
    ui.targetName.textContent = targetNode.name;
    ui.targetBar.style.width = `${clamp((targetNode.health / targetNode.maxHealth) * 100, 0, 100)}%`;
    ui.targetHint.textContent = 'MANTÉN EL DISPARO PARA EXTRAER';
    ui.reticleLabel.textContent = targetNode.name;
  } else if (targetSentinel && state.sentinel && state.sentinel.alive) {
    ui.targetCard.classList.add('visible');
    ui.reticle.classList.add('active');
    ui.targetKind.textContent = 'AMENAZA';
    ui.targetName.textContent = 'CENTINELA';
    ui.targetBar.style.width = `${clamp((state.sentinel.health / state.sentinel.maxHealth) * 100, 0, 100)}%`;
    ui.targetHint.textContent = 'DISPARA PARA NEUTRALIZAR';
    ui.reticleLabel.textContent = 'CENTINELA';
  } else {
    ui.targetCard.classList.remove('visible');
    ui.reticle.classList.remove('active');
  }
}

/* ---------------- sentinel ---------------- */
function spawnSentinel() {
  if (state.sentinelSpawned) return;
  state.sentinelSpawned = true;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222b2e, roughness: 0.4, metalness: 0.7 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff6c38, emissive: 0xff4f21, emissiveIntensity: 2.8, roughness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff2f20, emissive: 0xff2417, emissiveIntensity: 5, roughness: 0.2 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), bodyMat);
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 24), orangeMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
  eye.position.set(0, 0, -0.66);
  group.add(eye);
  for (let i = 0; i < 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.32), bodyMat);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 0.72, 0.18, Math.sin(angle) * 0.72);
    fin.rotation.y = -angle;
    group.add(fin);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: world.glowTexture,
    color: 0xff4b24,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.scale.setScalar(4);
  group.add(glow);
  const beamMat = new THREE.LineBasicMaterial({ color: 0xff3b22, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const laser = new THREE.Line(beamGeo, beamMat);
  laser.visible = false;
  scene.add(laser);
  scene.add(group);
  const meshes = [];
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.sentinel = true;
      meshes.push(child);
    }
  });
  state.sentinel = {
    group,
    laser,
    meshes,
    health: 100,
    maxHealth: 100,
    alive: true,
    fireTimer: 2.4,
    hitFlash: 0,
    orbit: Math.random() * Math.PI * 2,
    position: new THREE.Vector3(player.position.x + 16, player.position.y + 7, player.position.z - 12),
  };
  notify('CENTINELA DETECTADO', 'La minería excesiva ha activado una unidad de seguridad.', true);
  document.body.classList.add('alert');
}

function updateSentinel(dt) {
  const sentinel = state.sentinel;
  if (!sentinel || !sentinel.alive) return;
  sentinel.orbit += dt * 0.45;
  const radius = 15;
  const targetX = player.position.x + Math.cos(sentinel.orbit) * radius;
  const targetZ = player.position.z + Math.sin(sentinel.orbit) * radius;
  const targetY = world.heightAt(targetX, targetZ) + 7 + Math.sin(sentinel.orbit * 2.2) * 1.4;
  sentinel.position.x += (targetX - sentinel.position.x) * dt * 1.4;
  sentinel.position.y += (targetY - sentinel.position.y) * dt * 1.4;
  sentinel.position.z += (targetZ - sentinel.position.z) * dt * 1.4;
  sentinel.group.position.copy(sentinel.position);
  sentinel.group.rotation.y += dt * 1.2;
  sentinel.group.rotation.z = Math.sin(sentinel.orbit * 1.8) * 0.12;

  sentinel.fireTimer -= dt;
  if (sentinel.fireTimer <= 0 && sentinel.position.distanceTo(player.position) < 28) {
    sentinel.fireTimer = 2.3;
    sentinel.laser.visible = true;
    const positions = sentinel.laser.geometry.attributes.position;
    positions.setXYZ(0, sentinel.position.x, sentinel.position.y, sentinel.position.z);
    positions.setXYZ(1, player.position.x, player.position.y + 0.8, player.position.z);
    positions.needsUpdate = true;
    state.shield = Math.max(0, state.shield - 6);
    notify('IMPACTO DE CENTINELA', 'Escudo térmico comprometido. Usa R para recargar.', true);
    setTimeout(() => { sentinel.laser.visible = false; }, 260);
  }
  if (sentinel.hitFlash > 0) {
    sentinel.hitFlash -= dt;
    sentinel.group.scale.setScalar(1 + Math.sin(sentinel.hitFlash * 50) * 0.05);
  } else {
    sentinel.group.scale.setScalar(1);
  }
}

function damageSentinel(amount) {
  const sentinel = state.sentinel;
  if (!sentinel || !sentinel.alive) return;
  sentinel.health -= amount;
  sentinel.hitFlash = 0.08;
  burst(sentinel.position, 0xff7a36, 6, 1.6);
  if (sentinel.health <= 0) {
    sentinel.alive = false;
    sentinel.group.visible = false;
    sentinel.laser.visible = false;
    state.nanites += 35;
    state.units += 200;
    burst(sentinel.position, 0xff4f21, 34, 5);
    notify('CENTINELA NEUTRALIZADO', '+35 nanitos · +200 unidades', false);
    document.body.classList.remove('alert');
    updateResourcesUI();
  }
}

/* ---------------- interactions ---------------- */
const raycaster = new THREE.Raycaster();
raycaster.far = 24;
const centerScreen = new THREE.Vector2(0, 0);

function detectTarget() {
  if (state.mode !== 'playing' || state.panelOpen) {
    targetNode = null;
    targetSentinel = false;
    return;
  }
  raycaster.setFromCamera(centerScreen, camera);
  const hits = raycaster.intersectObjects(world.interactables, false);
  let foundNode = null;
  for (const hit of hits) {
    const node = hit.object.userData.node;
    if (node && !node.depleted) {
      foundNode = node;
      break;
    }
  }
  targetNode = foundNode;
  targetSentinel = false;
  if (!targetNode && state.sentinel && state.sentinel.alive) {
    const sentinelHits = raycaster.intersectObjects(state.sentinel.meshes, false);
    if (sentinelHits.length) targetSentinel = true;
  }
}

function mineTarget(dt) {
  if (overheatTimer > 0) return;
  if (targetNode) {
    const node = targetNode;
    node.health -= dt * 31;
    toolHeat += dt * 17;
    const scale = 0.68 + 0.32 * clamp(node.health / node.maxHealth, 0, 1);
    node.group.scale.setScalar(scale);
    if (Math.random() < 0.24) {
      const p = node.position.clone();
      p.y += 0.8;
      burst(p, node.type === 'sodio' ? 0xffdd7a : node.type === 'oxigeno' ? 0x6ffff0 : 0xff8a4c, 1, 1.2);
    }
    if (node.health <= 0) {
      node.depleted = true;
      node.group.visible = false;
      state.resources[node.type] += node.amount;
      state.minedCount += 1;
      state.units += 15;
      burst(node.position.clone().add(new THREE.Vector3(0, 0.8, 0)), node.type === 'sodio' ? 0xffdd7a : node.type === 'oxigeno' ? 0x6ffff0 : 0xff8a4c, 28, 3.8);
      notify(`+${node.amount} ${node.name}`, 'Recurso añadido al exotraje.', false);
      updateResourcesUI();
      refreshMission();
      targetNode = null;
      if (state.minedCount >= 4) spawnSentinel();
    }
  } else if (targetSentinel && state.sentinel) {
    damageSentinel(dt * 28);
    toolHeat += dt * 14;
  }
  if (toolHeat >= 100) {
    toolHeat = 100;
    overheatTimer = 2.6;
    mining = false;
    notify('MULTIHERRAMIENTA SOBRECALENTADA', 'Espera a que el sistema de refrigeración se estabilice.', true);
  }
}

function scan() {
  if (state.mode !== 'playing' || state.panelOpen || state.scanCooldown > 0) return;
  state.scanCooldown = 4.5;
  state.scanPulse = 1;
  world.scanRing.visible = true;
  world.scanRing.position.set(player.position.x, world.heightAt(player.position.x, player.position.z) + 0.22, player.position.z);
  world.scanRing.scale.setScalar(1);
  const found = world.scan(player.position, 66);
  if (found.length) {
    state.units += found.length * 18;
    state.nanites += Math.max(1, Math.floor(found.length / 5));
    notify('ESCANEO COMPLETADO', `${found.length} depósitos de recursos marcados en el radar.`, false);
    updateResourcesUI();
  } else {
    notify('ESCANEO COMPLETADO', 'No se detectaron recursos en el radio de 66 m.', false);
  }
  ui.scanVignette.classList.remove('on');
  void ui.scanVignette.offsetWidth;
  ui.scanVignette.classList.add('on');
  setTimeout(() => ui.scanVignette.classList.remove('on'), 900);
}

function recharge() {
  if (state.mode !== 'playing') return;
  let used = false;
  if (state.oxygen < 92 && state.resources.oxigeno > 0) {
    state.resources.oxigeno -= 1;
    state.oxygen = Math.min(100, state.oxygen + 42);
    used = true;
    notify('SOPORTE VITAL RECARGADO', 'Oxígeno +42%', false);
  }
  if (state.shield < 88 && state.resources.sodio > 0) {
    state.resources.sodio -= 1;
    state.shield = Math.min(100, state.shield + 32);
    used = true;
    notify('ESCUDO TÉRMICO RECARGADO', 'Sodio consumido · Escudo +32%', false);
  }
  if (!used) notify('SIN SUMINISTROS', 'Necesitas oxígeno o sodio para recargar.', true);
  updateResourcesUI();
}

function interact() {
  if (state.mode !== 'playing' || state.panelOpen) return;
  const shipDistance = player.position.distanceTo(world.shipPosition);
  if (shipDistance < 9.5) {
    if (!state.warpCore) {
      notify('NÚCLEO DE SALTO AUSENTE', 'Fabrica un núcleo de salto con C antes de despegar.', true);
      return;
    }
    beginLaunch();
    return;
  }
  const monolithDistance = player.position.distanceTo(world.monolithPosition);
  if (monolithDistance < 7) {
    if (state.readMonolith) {
      notify('MONOLITO // ARCHIVO 07', '“El Atlas observa. La galaxia recuerda. Tú eres el eco.”', false);
    } else {
      state.readMonolith = true;
      state.units += 240;
      state.nanites += 6;
      notify('CONOCIMIENTO ANCESTRAL', 'Has descifrado un fragmento del idioma Korvax. +240 unidades · +6 nanitos', false);
      updateResourcesUI();
    }
  }
}

/* ---------------- crafting ---------------- */
const costs = { ferrita: 12, carbono: 8, sodio: 5 };

function canCraft() {
  return !state.warpCore
    && state.resources.ferrita >= costs.ferrita
    && state.resources.carbono >= costs.carbono
    && state.resources.sodio >= costs.sodio;
}

function updateCraftUI() {
  const ok = canCraft();
  for (const [type, cost] of Object.entries(costs)) {
    const el = ui.panel.querySelector(`[data-cost="${type}"]`);
    if (!el) continue;
    const current = state.resources[type];
    el.querySelector('b').textContent = `${Math.min(current, cost)}/${cost}`;
    el.classList.toggle('ok', current >= cost);
  }
  ui.craftBtn.disabled = !ok && !state.warpCore;
  ui.craftBtn.innerHTML = state.warpCore ? 'FABRICADO <span>✓</span>' : ok ? 'FABRICAR <span>↵</span>' : 'RECURSOS INSUFICIENTES';
}

function craftCore() {
  if (state.warpCore) return;
  if (!canCraft()) {
    notify('RECURSOS INSUFICIENTES', 'Necesitas 12 ferrita, 8 carbono y 5 sodio.', true);
    return;
  }
  state.resources.ferrita -= costs.ferrita;
  state.resources.carbono -= costs.carbono;
  state.resources.sodio -= costs.sodio;
  state.warpCore = true;
  state.units += 400;
  updateResourcesUI();
  refreshMission();
  updateCraftUI();
  notify('NÚCLEO DE SALTO FABRICADO', 'Tecnología de hiperimpulso instalada en la nave.', false);
  setTimeout(() => togglePanel(false), 900);
}

function togglePanel(force) {
  if (state.mode !== 'playing') return;
  const open = typeof force === 'boolean' ? force : !state.panelOpen;
  state.panelOpen = open;
  ui.panel.classList.toggle('is-visible', open);
  if (open) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    updateCraftUI();
    updateInventory();
    mining = false;
  }
}

/* ---------------- launch + space ---------------- */
let spaceScene = null;
const joyLabel = document.querySelector('#joyZone > span');

function setSpaceTouchUI(active) {
  ui.mobileUI.classList.toggle('is-space', active);
  if (joyLabel) joyLabel.textContent = active ? 'VIRAR' : 'MOVER';
  if (!active && spaceScene) {
    spaceScene.touchThrust = false;
    spaceScene.touchBoost = false;
  }
}

function beginLaunch() {
  if (state.launchStarted) return;
  state.launchStarted = true;
  state.mode = 'launch';
  mining = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  ui.hud.classList.remove('is-visible');
  ui.mobileUI.classList.remove('is-visible');
  ui.launch.classList.add('is-visible');
  ui.launchBar.style.width = '0%';
  ui.launchPct.textContent = '0%';
  ui.launchStatus.textContent = 'INICIANDO PROPULSORES';
  ui.launchLog.innerHTML = '';
  const logLines = [
    '> comprobando integridad del casco ......... OK',
    '> núcleo de salto estabilizado ............. OK',
    '> escudos atmosféricos ..................... 100%',
    '> coordenadas de despegue ................. BLOQUEADAS',
    '> propulsores de despegue .................. IGNICIÓN',
    '> abandono de superficie ................... AUTORIZADO',
  ];
  let progress = 0;
  let logIndex = 0;
  const timer = setInterval(() => {
    progress = Math.min(100, progress + 3.2 + Math.random() * 3.8);
    ui.launchBar.style.width = `${progress}%`;
    ui.launchPct.textContent = `${Math.round(progress)}%`;
    if (progress > 18 && ui.launchStatus.textContent === 'INICIANDO PROPULSORES') ui.launchStatus.textContent = 'ATRAVESANDO LA ATMÓSFERA';
    if (logIndex < logLines.length && progress > 12 + logIndex * 12) {
      ui.launchLog.innerHTML += `<div>${logLines[logIndex]}</div>`;
      logIndex += 1;
    }
    if (progress >= 100) {
      clearInterval(timer);
      ui.launchStatus.textContent = 'ÓRBITA ALCANZADA';
      setTimeout(enterSpace, 650);
    }
  }, 130);
}

function enterSpace() {
  if (!spaceScene) {
    spaceScene = new SpaceScene(renderer, world, seed);
    spaceScene.onWarp = beginWarp;
  }
  state.mode = 'space';
  flash();
  ui.launch.classList.remove('is-visible');
  ui.spaceHud.classList.add('is-visible');
  ui.mobileUI.classList.add('is-visible');
  setSpaceTouchUI(true);
  const warpHint = ui.warpBtn.querySelector('small');
  if (warpHint) warpHint.textContent = state.warpCore ? 'NÚCLEO DE SALTO LISTO' : 'REQUIERE NÚCLEO DE SALTO';
  spaceScene.start();
}

function beginWarp() {
  if (state.mode !== 'space') return;
  state.mode = 'warp';
  ui.mobileUI.classList.remove('is-visible');
  setSpaceTouchUI(false);
  ui.warpOverlay.classList.add('on');
  ui.warpTitle.textContent = 'CALCULANDO RUTA';
  ui.warpSub.textContent = 'DESTINO // SISTEMA DESCONOCIDO';
  if (spaceScene) spaceScene.setWarping(true);
  setTimeout(() => {
    ui.warpTitle.textContent = 'IXAR-9';
    ui.warpSub.textContent = 'SALTO INTERESTELAR EN CURSO';
    flash();
  }, 1300);
  setTimeout(() => {
    ui.warpOverlay.classList.remove('on');
    ui.spaceHud.classList.remove('is-visible');
    ui.mobileUI.classList.remove('is-visible');
    ui.arrival.classList.add('is-visible');
    state.mode = 'arrival';
    if (spaceScene) spaceScene.setWarping(false);
  }, 3300);
}

function landOnNewWorld() {
  const nextSeed = seed + 1;
  window.location.href = `${window.location.pathname}?seed=${nextSeed}&autostart=1`;
}

/* ---------------- input ---------------- */
function updatePlayer(dt) {
  if (state.mode !== 'playing' || state.panelOpen) return;
  const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const rightInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let forward = forwardInput;
  let right = rightInput;
  if (touchMove.lengthSq() > 0.01) {
    forward += -touchMove.y;
    right += touchMove.x;
  }
  const length = Math.hypot(forward, right);
  if (length > 1) {
    forward /= length;
    right /= length;
  }
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprint ? 10.5 : 6.2;
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const desiredX = (forwardX * forward + rightX * right) * speed;
  const desiredZ = (forwardZ * forward + rightZ * right) * speed;
  player.velocity.x += (desiredX - player.velocity.x) * Math.min(1, dt * 10);
  player.velocity.z += (desiredZ - player.velocity.z) * Math.min(1, dt * 10);
  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  const ground = world.heightAt(player.position.x, player.position.z) + player.eye;
  player.moving = Math.abs(player.velocity.x) + Math.abs(player.velocity.z) > 0.6;

  if (player.onGround) {
    player.position.y = ground;
    if (keys.has('Space') || keys.has('TouchJump')) {
      player.verticalVelocity = 6.2;
      player.onGround = false;
      keys.delete('TouchJump');
    }
  } else {
    player.verticalVelocity -= 19 * dt;
    player.position.y += player.verticalVelocity * dt;
    if (player.position.y <= ground) {
      player.position.y = ground;
      player.verticalVelocity = 0;
      player.onGround = true;
    }
  }

  if (player.moving && player.onGround) player.bob += dt * (sprint ? 13 : 9.5);
  const bob = player.moving && player.onGround ? Math.sin(player.bob) * 0.035 : 0;
  camera.position.set(player.position.x, player.position.y + bob, player.position.z);
  camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob * 0.5) * 0.0025);

  const swayX = Math.sin(player.bob * 0.5) * (player.moving ? 0.007 : 0.0015);
  const swayY = Math.cos(player.bob) * (player.moving ? 0.006 : 0.0012);
  tool.position.x += (0.54 + swayX - tool.position.x) * dt * 8;
  tool.position.y += (-0.47 + swayY - tool.position.y) * dt * 8;
  tool.rotation.x = -0.08 + toolRecoil * 0.35;
  tool.rotation.z = 0.03 + Math.sin(player.bob * 0.5) * 0.006;
  tool.userData.muzzleGlow.material.opacity = 0.55 + Math.sin(performance.now() * 0.004) * 0.12 + (mining ? 0.3 : 0);
  toolRecoil = Math.max(0, toolRecoil - dt * 6);

  if (player.position.y < -30) {
    player.position.set(world.spawn.x, world.spawn.y + player.eye, world.spawn.z);
    player.verticalVelocity = 0;
  }
}

function updateSurvival(dt) {
  if (state.mode !== 'playing' || state.panelOpen) return;
  state.stormTimer -= dt;
  if (state.stormTimer <= 0) {
    state.storm = !state.storm;
    state.stormTimer = state.storm ? 17 : 52;
    if (state.storm) {
      notify('ALERTA METEOROLÓGICA', 'Tormenta de ceniza entrante. El escudo térmico se degradará.', true);
      document.body.classList.add('storm');
    } else {
      notify('TORMENTA DISIPADA', 'La atmósfera se estabiliza. Escudo térmico en recuperación.', false);
      document.body.classList.remove('storm');
    }
  }
  state.oxygen = Math.max(0, state.oxygen - dt * (0.62 + (state.storm ? 0.3 : 0)));
  if (state.storm) {
    state.shield = Math.max(0, state.shield - dt * 1.45);
    state.hazard = 0.78 + Math.sin(performance.now() * 0.002) * 0.12;
  } else {
    state.shield = Math.min(100, state.shield + dt * 0.26);
    state.hazard += (0.18 - state.hazard) * dt;
  }
  if (state.oxygen < 22 && state.resources.oxigeno > 0 && !state.panelOpen) {
    state.resources.oxigeno -= 1;
    state.oxygen = Math.min(100, state.oxygen + 38);
    updateResourcesUI();
    notify('RECARGA AUTOMÁTICA', 'Soporte vital reabastecido con oxígeno almacenado.', false);
  }
  if (state.oxygen <= 0.1 && !state.panelOpen) {
    state.oxygen = 0.1;
    if (!state.oxygenWarning) {
      state.oxygenWarning = true;
      notify('SOPORTE VITAL CRÍTICO', 'Busca oxígeno o pulsa R para recargar.', true);
      setTimeout(() => { state.oxygenWarning = false; }, 12000);
    }
  }
  if (state.shield < 12 && state.resources.sodio > 6 && !state.panelOpen) {
    state.resources.sodio -= 1;
    state.shield = Math.min(100, state.shield + 30);
    updateResourcesUI();
    notify('ESCUDO DE EMERGENCIA', 'Sodio consumido para estabilizar el escudo.', true);
  }
}

function updatePlaying(dt) {
  updatePlayer(dt);
  updateSurvival(dt);
  world.update(dt, player.position);
  updateSentinel(dt);
  updateParticles(dt);
  detectTarget();

  const canMine = (mining || mobileMining) && !state.panelOpen && state.mode === 'playing';
  const desktop = window.innerWidth > 760;
  tool.visible = desktop && canMine;
  if (canMine && (targetNode || targetSentinel)) {
    mineTarget(dt);
    toolRecoil = 1;
    const start = new THREE.Vector3();
    toolMuzzle.getWorldPosition(start);
    const targetPos = targetNode ? targetNode.position.clone().add(new THREE.Vector3(0, 0.7, 0)) : state.sentinel.position.clone();
    const direction = targetPos.clone().sub(start);
    const length = direction.length();
    direction.normalize();
    beam.visible = true;
    beam.position.copy(start).addScaledVector(direction, length / 2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    beam.scale.set(1, length, 1);
    beam.material.opacity = 0.48 + Math.random() * 0.24;
    impactGlow.visible = true;
    impactGlow.position.copy(targetPos);
    impactGlow.material.opacity = 0.5 + Math.random() * 0.4;
    impactGlow.scale.setScalar(0.55 + Math.random() * 0.5);
  } else {
    beam.visible = false;
    impactGlow.visible = false;
  }

  if (!canMine) {
    toolHeat = Math.max(0, toolHeat - dt * 22);
    if (overheatTimer > 0) overheatTimer = Math.max(0, overheatTimer - dt);
  } else if (overheatTimer > 0) {
    overheatTimer = Math.max(0, overheatTimer - dt);
  }

  state.scanCooldown = Math.max(0, state.scanCooldown - dt);
  if (state.scanPulse > 0) {
    state.scanPulse = Math.max(0, state.scanPulse - dt * 1.8);
    const ringScale = 1 + (1 - state.scanPulse) * 55;
    world.scanRing.scale.setScalar(ringScale);
    world.scanRing.material.opacity = state.scanPulse * 0.75;
    if (state.scanPulse <= 0) world.scanRing.visible = false;
  }

  updateVitalsUI();
  updateCompass();
  updateTargetUI();
  updateToolUI();
  drawRadar();
  updateMissionUI();

  const shipDistance = player.position.distanceTo(world.shipPosition);
  const monolithDistance = player.position.distanceTo(world.monolithPosition);
  if (shipDistance < 9.5) {
    ui.interactPrompt.classList.add('visible');
    ui.interactText.textContent = state.warpCore ? 'DESPEGAR DE KORVAX PRIME' : 'INSPECCIONAR NAVE // FALTA NÚCLEO';
  } else if (monolithDistance < 7) {
    ui.interactPrompt.classList.add('visible');
    ui.interactText.textContent = 'LEER MONOLITO KORVAX';
  } else {
    ui.interactPrompt.classList.remove('visible');
  }
}

/* ---------------- menu + start ---------------- */
function updateMenu(dt) {
  cinematicTime += dt;
  const angle = cinematicTime * 0.045;
  const radius = 43 + Math.sin(cinematicTime * 0.07) * 4;
  camera.position.set(Math.cos(angle) * radius, 15 + Math.sin(cinematicTime * 0.11) * 2.5, Math.sin(angle) * radius);
  camera.lookAt(2, 5, -9);
  world.update(dt, camera.position);
  updateParticles(dt);
}

function startGame() {
  if (state.started) return;
  state.started = true;
  state.mode = 'transition';
  ui.boot.classList.add('done');
  setSpaceTouchUI(false);
  flash();
  setTimeout(() => {
    ui.menu.classList.remove('is-visible');
    ui.hud.classList.add('is-visible');
    ui.mobileUI.classList.add('is-visible');
    tool.visible = false;
    state.mode = 'playing';
    player.position.set(world.spawn.x, world.heightAt(world.spawn.x, world.spawn.z) + player.eye, world.spawn.z);
    player.yaw = 0.04;
    player.pitch = -0.035;
    camera.position.copy(player.position);
    camera.rotation.set(player.pitch, player.yaw, 0);
    updateResourcesUI();
    updateMissionUI();
    updateCraftUI();
    setTimeout(() => notify('EXOTRAJE EN LÍNEA', 'Haz clic en la escena para capturar la cámara. C recolecta el inventario.', false), 700);
  }, 260);
}

/* ---------------- animation ---------------- */
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - state.lastFrame) / 1000, 0.05);
  state.lastFrame = now;

  if (state.mode === 'menu' || state.mode === 'transition') {
    if (state.mode === 'menu') updateMenu(dt);
    composer.render();
  } else if (state.mode === 'playing' || state.mode === 'launch') {
    if (state.mode === 'playing') updatePlaying(dt);
    else {
      world.update(dt, player.position);
      updateParticles(dt);
    }
    composer.render();
  } else if (state.mode === 'space' || state.mode === 'warp') {
    if (spaceScene) {
      spaceScene.setTouchSteer(touchMove.x, touchMove.y);
      spaceScene.update(dt);
      spaceScene.render();
      ui.spaceSpeed.textContent = `${Math.round(spaceScene.speed * 12)} u/s`;
    }
  }
}

/* ---------------- event wiring ---------------- */
$('#startBtn').addEventListener('click', startGame);
$('#codexBtn').addEventListener('click', () => {
  ui.codex.classList.add('is-visible');
});
$$('[data-close]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.close;
    if (target === 'panel') togglePanel(false);
    else ui[target].classList.remove('is-visible');
  });
});
$('#craftBtn').addEventListener('click', craftCore);
$('#warpBtn').addEventListener('click', beginWarp);
$('#landBtn').addEventListener('click', landOnNewWorld);

window.addEventListener('keydown', (event) => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyF') scan();
  if (event.code === 'KeyC' || event.code === 'Tab') togglePanel();
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyR') recharge();
  if (event.code === 'Escape') {
    if (state.panelOpen) togglePanel(false);
    else if (ui.codex.classList.contains('is-visible')) ui.codex.classList.remove('is-visible');
    else if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

canvas.addEventListener('mousedown', (event) => {
  if (state.mode !== 'playing' || state.panelOpen) return;
  if (document.pointerLockElement !== canvas && window.matchMedia('(pointer: fine)').matches) {
    canvas.requestPointerLock();
    return;
  }
  if (event.button === 0) mining = true;
});
window.addEventListener('mouseup', () => {
  mining = false;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) mining = false;
});
document.addEventListener('mousemove', (event) => {
  if (state.mode === 'space' || state.mode === 'warp') {
    if (spaceScene) spaceScene.look(event.movementX || 0, event.movementY || 0);
    return;
  }
  if (state.mode !== 'playing' || state.panelOpen) return;
  if (document.pointerLockElement === canvas || draggingLook) {
    player.yaw -= (event.movementX || 0) * 0.0021;
    player.pitch = clamp(player.pitch - (event.movementY || 0) * 0.0021, -1.32, 1.22);
  }
});
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' && state.mode === 'playing' && !state.panelOpen) {
    touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  } else if (event.pointerType === 'mouse' && event.button === 0 && state.mode === 'playing' && !state.panelOpen && document.pointerLockElement !== canvas) {
    draggingLook = true;
    canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' && touchLook && touchLook.id === event.pointerId) {
    const dx = event.clientX - touchLook.x;
    const dy = event.clientY - touchLook.y;
    player.yaw -= dx * 0.0042;
    player.pitch = clamp(player.pitch - dy * 0.0042, -1.32, 1.22);
    touchLook.x = event.clientX;
    touchLook.y = event.clientY;
  } else if (event.pointerType === 'mouse' && draggingLook) {
    player.yaw -= (event.movementX || 0) * 0.0021;
    player.pitch = clamp(player.pitch - (event.movementY || 0) * 0.0021, -1.32, 1.22);
  }
});
canvas.addEventListener('pointerup', (event) => {
  if (touchLook && touchLook.id === event.pointerId) touchLook = null;
  if (event.pointerType === 'mouse') draggingLook = false;
});
canvas.addEventListener('pointercancel', () => {
  touchLook = null;
  draggingLook = false;
});

// joystick
{
  const zone = $('#joyZone');
  const knob = $('#joyKnob');
  let pointerId = null;
  const setKnob = (x, y) => {
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };
  zone.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    try {
      zone.setPointerCapture(pointerId);
    } catch {
    }
    event.preventDefault();
  });
  zone.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = rect.width * 0.34;
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      dx = (dx / distance) * max;
      dy = (dy / distance) * max;
    }
    touchMove.set(dx / max, dy / max);
    setKnob(dx, dy);
    event.preventDefault();
  });
  const end = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    touchMove.set(0, 0);
    setKnob(0, 0);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

$('#touchScan').addEventListener('pointerdown', (event) => { event.preventDefault(); scan(); });
$('#touchCraft').addEventListener('pointerdown', (event) => { event.preventDefault(); togglePanel(); });
$('#touchJump').addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add('TouchJump'); });
$('#touchMine').addEventListener('pointerdown', (event) => { event.preventDefault(); mobileMining = true; });
$('#touchMine').addEventListener('pointerup', () => { mobileMining = false; });
$('#touchMine').addEventListener('pointercancel', () => { mobileMining = false; });

function bindSpaceHold(id, property) {
  const button = document.getElementById(id);
  if (!button) return;
  const press = (event) => {
    event.preventDefault();
    if (spaceScene) spaceScene[property] = true;
    try {
      button.setPointerCapture?.(event.pointerId);
    } catch {
    }
  };
  const release = () => {
    if (spaceScene) spaceScene[property] = false;
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

bindSpaceHold('touchThrust', 'touchThrust');
bindSpaceHold('touchBoost', 'touchBoost');

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  bloom.setSize(width, height);
  if (spaceScene) spaceScene.resize(width, height);
  if (state.started) tool.visible = false;
});

// scan ring visual
world.scanRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1.05, 64),
  new THREE.MeshBasicMaterial({ color: 0x62f5d5, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
);
world.scanRing.rotation.x = -Math.PI / 2;
world.scanRing.position.set(0, 0.25, 0);
world.scanRing.visible = false;
scene.add(world.scanRing);

/* ---------------- boot ---------------- */
let bootProgress = 0;
ui.bootStatus.textContent = 'GENERANDO SISTEMA KORVAX-7';
const bootTimer = setInterval(() => {
  bootProgress = Math.min(100, bootProgress + 4.5 + Math.random() * 5);
  ui.bootBar.style.width = `${bootProgress}%`;
  if (bootProgress > 42) ui.bootStatus.textContent = 'TERRAFORMANDO SUPERFICIE';
  if (bootProgress > 74) ui.bootStatus.textContent = 'SINCRONIZANDO EXOTRAJE';
  if (bootProgress >= 100) {
    clearInterval(bootTimer);
    ui.bootStatus.textContent = 'SEÑAL ESTABLE';
    setTimeout(() => {
      ui.boot.classList.add('done');
      if (autostart) startGame();
    }, 500);
  }
}, 70);

updateResourcesUI();
updateMissionUI();
updateCraftUI();
updateVitalsUI();
requestAnimationFrame(animate);

// expose a tiny debug surface for automated visual checks
window.__frontier = {
  startGame,
  scan,
  interact,
  mine(value) { mining = Boolean(value); },
  launch: beginLaunch,
  craft: craftCore,
  panel: togglePanel,
  warp: beginWarp,
  refreshMission,
  teleportToNode(type = 'ferrita') {
    const node = world.nodes.find((entry) => entry.type === type && !entry.depleted);
    if (!node) return null;
    const x = node.position.x;
    const z = node.position.z + 4.5;
    player.position.set(x, world.heightAt(x, z) + player.eye, z);
    const dx = node.position.x - player.position.x;
    const dz = node.position.z - player.position.z;
    player.yaw = Math.atan2(-dx, -dz);
    const targetY = node.position.y + 0.7;
    player.pitch = Math.atan2(targetY - player.position.y, Math.hypot(dx, dz));
    camera.position.copy(player.position);
    camera.rotation.set(player.pitch, player.yaw, 0);
    return { type: node.type, x, z };
  },
  state,
  world,
  player,
  get mode() { return state.mode; },
  get mining() { return mining; },
  get target() { return targetNode ? { type: targetNode.type, health: targetNode.health } : targetSentinel ? { type: 'sentinel', health: state.sentinel?.health } : null; },
  get heat() { return toolHeat; },
  get ready() { return state.started && state.mode === 'playing'; },
  space: () => spaceScene,
};
