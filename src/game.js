import * as THREE from 'three';
import { Universe, RESOURCES } from './universe.js';
import { World } from './world.js';
import { UI, fmt } from './ui.js';
import { RECIPES } from './recipes.js';
import { clamp } from './noise.js';

const SAVE_KEY = 'fractured-skies-save';
const START_RESOURCES = { CARBON: 18, FERRITE: 18, SODIUM: 12, OXYGEN: 10, DIHYDROGEN: 7 };

function freshResources() {
  const r = {};
  for (const k of Object.keys(RESOURCES)) r[k] = START_RESOURCES[k] || 0;
  return r;
}

export class Game {
  constructor() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(window.innerWidth / window.innerHeight < .9 ? 78 : 68, window.innerWidth / window.innerHeight, .08, 950);
    this.camera.rotation.order = 'YXZ';

    this.universe = new Universe();
    this.resources = freshResources();
    this.tech = { mining: 1, weapon: 1, hazard: 1 };
    this.stats = { health: 100, shield: 100, hazard: 100, oxygen: 100 };
    this.units = 2450;
    this.nanites = 12;
    this.warpCells = 1;
    this.launchFuel = 2;
    this.scanCharges = 3;
    this.scanned = 0;
    this.wanted = 0;
    this.visited = 1;
    this.mode = 'intro';
    this.started = false;
    this.modalOpen = false;
    this.flags = { scanned: false, craftedWarp: false, launched: false, warped: false };
    this.mapSelection = 1;
    this.player = { position: new THREE.Vector3(0, 0, 0), yaw: .69, pitch: -.045 };
    this.jet = 100;
    this.jetHeight = 0;
    this.bobTime = 0;
    this.bob = 0;
    this.keys = new Set();
    this.held = new Set();
    this.joy = { x: 0, y: 0, active: false, id: null };
    this.drag = null;
    this.mouseMining = false;
    this.mineProgress = 0;
    this.scanCooldown = 0;
    this.scanRecharge = 0;
    this.shootCd = 0;
    this.lastDamage = 99;
    this.combatTimer = 0;
    this.criticalWarned = false;
    this.targetNode = null;
    this.targetSentinel = null;
    this.warpTimer = 0;
    this.warpTarget = 0;
    this.saving = 0;
    this.time = 0;
    this.last = performance.now();
    this.lastHudUpdate = 0;

    this.system = this.universe.currentSystem();
    this.planet = this.universe.currentPlanet();
    this.buildWorld();
    this.ui = new UI(this);
    this.bindEvents();
    this.ui.update(this, 0);
    this.ui.drawRadar(this);
    requestAnimationFrame(t => this.loop(t));
  }

  buildWorld() {
    if (this.world) this.world.dispose();
    this.system = this.universe.currentSystem();
    this.planet = this.universe.currentPlanet();
    this.world = new World(this.planet, this.scene);
    this.player.position.set(0, this.world.heightAt(0, 0), 0);
    this.player.yaw = .69;
    this.player.pitch = -.045;
    this.jetHeight = 0;
    this.mineProgress = 0;
    this.targetNode = null;
    this.targetSentinel = null;
    this.updateCamera(0);
  }

  resetExpedition() {
    this.universe = new Universe();
    this.resources = freshResources();
    this.tech = { mining: 1, weapon: 1, hazard: 1 };
    this.stats = { health: 100, shield: 100, hazard: 100, oxygen: 100 };
    this.units = 2450;
    this.nanites = 12;
    this.warpCells = 1;
    this.launchFuel = 2;
    this.scanCharges = 3;
    this.scanned = 0;
    this.wanted = 0;
    this.visited = 1;
    this.flags = { scanned: false, craftedWarp: false, launched: false, warped: false };
    this.mapSelection = 1;
    this.buildWorld();
  }

  start(load) {
    this.ui.closeModal();
    if (load) {
      if (!this.load()) {
        this.resetExpedition();
        this.ui.toast('SEÑAL NO ENCONTRADA · NUEVA EXPEDICIÓN');
      }
    } else {
      this.resetExpedition();
    }
    this.mode = 'surface';
    this.started = true;
    this.ui.hideIntro();
    this.ui.showHud();
    this.ui.hideOrbit();
    this.ui.hideWarp();
    this.ui.toast(load ? 'SEÑAL RESTAURADA · EXPEDICIÓN EN CURSO' : 'EXOTRAJE ENLazADO · SUPERVIVENCIA ACTIVA');
    this.save();
  }

  save() {
    if (!this.started) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        systemIndex: this.system.index,
        planetIndex: this.universe.planetIndex,
        resources: this.resources,
        tech: this.tech,
        stats: this.stats,
        units: this.units,
        nanites: this.nanites,
        warpCells: this.warpCells,
        launchFuel: this.launchFuel,
        scanCharges: this.scanCharges,
        scanned: this.scanned,
        wanted: this.wanted,
        visited: this.visited,
        flags: this.flags,
      }));
    } catch (_) { /* storage may be unavailable */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.universe = new Universe();
      this.universe.selectSystem(data.systemIndex || 0);
      this.universe.selectPlanet(data.planetIndex || 0);
      this.resources = { ...freshResources(), ...(data.resources || {}) };
      this.tech = { mining: 1, weapon: 1, hazard: 1, ...(data.tech || {}) };
      this.stats = { health: 100, shield: 100, hazard: 100, oxygen: 100, ...(data.stats || {}) };
      this.units = data.units ?? 2450;
      this.nanites = data.nanites ?? 12;
      this.warpCells = data.warpCells ?? 1;
      this.launchFuel = data.launchFuel ?? 2;
      this.scanCharges = data.scanCharges ?? 3;
      this.scanned = data.scanned ?? 0;
      this.wanted = data.wanted ?? 0;
      this.visited = data.visited ?? 1;
      this.flags = { scanned: false, craftedWarp: false, launched: false, warped: false, ...(data.flags || {}) };
      this.buildWorld();
      return true;
    } catch (_) {
      return false;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('contextmenu', e => e.preventDefault());

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    canvas.addEventListener('pointerup', e => this.endPointer(e));
    canvas.addEventListener('pointercancel', e => this.endPointer(e));

    document.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      if (action === 'scan') btn.addEventListener('click', () => this.scan());
      else if (action === 'shoot') btn.addEventListener('click', () => this.shoot());
      else if (action === 'inventory') btn.addEventListener('click', () => this.openInventory());
      else {
        const down = e => { e.preventDefault(); this.held.add(action); btn.classList.add('held'); if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId); };
        const up = e => { this.held.delete(action); btn.classList.remove('held'); };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
      }
    });
    document.getElementById('inventory-btn').addEventListener('click', () => this.openInventory());

    const joy = this.ui.el.joystick;
    const knob = this.ui.el.knob;
    let jid = null;
    const setJoy = e => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * .34;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / max;
      this.joy.y = dy / max;
      this.joy.active = true;
    };
    joy.addEventListener('pointerdown', e => {
      e.preventDefault();
      jid = e.pointerId;
      joy.setPointerCapture(jid);
      setJoy(e);
    });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) setJoy(e); });
    const resetJoy = e => {
      if (e.pointerId !== jid) return;
      jid = null;
      knob.style.transform = '';
      this.joy.x = this.joy.y = 0;
      this.joy.active = false;
    };
    joy.addEventListener('pointerup', resetJoy);
    joy.addEventListener('pointercancel', resetJoy);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = this.camera.aspect < .9 ? 78 : 68;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onKey(e, down) {
    const code = e.code;
    if (down && code === 'Escape') {
      if (this.modalOpen) this.ui.closeModal();
      else if (this.mode === 'surface' && this.started) this.ui.openPause();
      return;
    }
    if (this.modalOpen || this.mode === 'intro' || this.mode === 'warp') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(code)) e.preventDefault();
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (!down) return;
    if (code === 'KeyE') this.scan();
    if (code === 'KeyF') this.shoot();
    if (code === 'KeyI' || code === 'Tab') { e.preventDefault(); this.openInventory(); }
    if (code === 'KeyC') this.ui.openCraft();
    if (code === 'KeyQ') this.ui.openCodex();
    if (code === 'KeyM') this.ui.openMap();
    if (code === 'KeyP') this.ui.openPause();
  }

  onPointerDown(e) {
    if (this.mode !== 'surface' || this.modalOpen) return;
    if (e.target !== this.renderer.domElement) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    if (e.pointerType === 'mouse') this.mouseMining = true;
  }

  onPointerMove(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
    if (this.drag.moved) this.mouseMining = false;
    this.player.yaw += dx * .0027;
    this.player.pitch = clamp(this.player.pitch - dy * .0023, -1.12, .72);
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  }

  endPointer(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.drag = null;
    this.mouseMining = false;
  }

  openInventory() { if (this.started) this.ui.openInventory(); }

  loop(now) {
    if (window.__freeze) {
      this.last = now;
      requestAnimationFrame(t => this.loop(t));
      return;
    }
    const dt = Math.min(.1, (now - this.last) / 1000) || 0;
    this.frames = (this.frames || 0) + 1;
    this.last = now;
    this.time = now;

    if (this.mode === 'surface' && this.started && !this.modalOpen) {
      this.update(dt);
      this.world.update(dt, now, this.camera, this.player, this);
      if (now - this.lastHudUpdate > 90) { this.ui.update(this, dt); this.lastHudUpdate = now; }
    } else if (this.mode === 'warp') {
      this.updateWarp(dt);
      this.world.update(dt * .35, now, this.camera, this.player, null);
    } else {
      this.world.update(dt * .55, now, this.camera, this.player, null);
      if (this.mode === 'intro') {
        this.camera.position.y += Math.sin(now * .0005) * .0007;
        this.camera.rotation.z = Math.sin(now * .0003) * .003;
      }
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.lastDamage += dt;
    this.combatTimer = Math.max(0, this.combatTimer - dt);
    if (this.combatTimer <= 0 && this.wanted > 0) {
      this.wanted = 0;
      for (const s of this.world.sentinels) s.userData.hostile = false;
    }

    this.scanRecharge += dt;
    if (this.scanRecharge > 26 && this.scanCharges < 3) {
      this.scanCharges++;
      this.scanRecharge = 0;
      this.ui.toast(`ESCÁNER RECARGADO · ${this.scanCharges}/3`);
    }

    this.updateMovement(dt);
    this.updateSurvival(dt);
    this.updateInteraction(dt);

    this.saving += dt;
    if (this.saving > 14) { this.saving = 0; this.save(); }
  }

  updateMovement(dt) {
    let ix = 0, iz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.joy.active) {
      ix += this.joy.x;
      iz -= this.joy.y;
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprint ? 8.2 : 5.2;
    const yaw = this.player.yaw;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = Math.sin(yaw);
    const dx = (fx * iz + rx * ix) * speed * dt;
    const dz = (fz * iz + rz * ix) * speed * dt;
    const nx = clamp(this.player.position.x + dx, -142, 142);
    const nz = clamp(this.player.position.z + dz, -142, 142);
    const ground = this.world.heightAt(nx, nz);
    const underwater = this.world.seaLevel > -900 && ground < this.world.seaLevel - .15;
    if (!underwater) {
      this.player.position.x = nx;
      this.player.position.z = nz;
      this.player.position.y = ground;
    }

    const moving = len > .05;
    if (moving) this.bobTime += dt * (sprint ? 12 : 8.5);
    this.bob += ((moving ? Math.sin(this.bobTime) * .055 : 0) - this.bob) * Math.min(1, dt * 10);

    const jetActive = (this.keys.has('Space') || this.held.has('jet')) && this.jet > .2;
    if (jetActive) {
      this.jet = Math.max(0, this.jet - 34 * dt);
      this.jetHeight = Math.min(3.5, this.jetHeight + 3.4 * dt);
    } else {
      this.jet = Math.min(100, this.jet + 16 * dt);
      this.jetHeight = Math.max(0, this.jetHeight - 4.1 * dt);
    }

    this.player.yaw = ((this.player.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.updateCamera(dt, ix);
  }

  updateCamera(dt, strafe = 0) {
    const bob = this.mode === 'surface' ? this.bob : 0;
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y + 1.72 + this.jetHeight + bob,
      this.player.position.z
    );
    this.camera.rotation.y = -this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.rotation.z = -strafe * .018;
  }

  updateSurvival(dt) {
    const drain = (this.planet.hazard.drain || 0) * .55 / (1 + (this.tech.hazard - 1) * .2);
    this.stats.hazard = clamp(this.stats.hazard - drain * dt, 0, 100);
    this.stats.oxygen = clamp(this.stats.oxygen - .075 * dt, 0, 100);
    if (this.stats.hazard <= 0 && this.stats.oxygen <= 0) {
      this.damage(2.8 * dt, false);
    } else if (this.stats.hazard <= 0) {
      this.damage(.75 * dt, false);
    }
    if (this.lastDamage > 7) this.stats.shield = clamp(this.stats.shield + .55 * dt, 0, 100);
    if (this.stats.hazard > 18 && this.stats.oxygen > 18 && this.lastDamage > 5) {
      this.stats.health = clamp(this.stats.health + .32 * dt, 0, 100);
    }
    if (this.stats.hazard < 20 && !this.criticalWarned) {
      this.criticalWarned = true;
      this.ui.toast('ESCUDO AMBIENTAL CRÍTICO · BUSCA SODIO', true);
    }
    if (this.stats.hazard > 30) this.criticalWarned = false;
    if (this.stats.health <= 0) this.respawn();
  }

  damage(amount, flash = true) {
    this.stats.shield -= amount;
    if (this.stats.shield < 0) {
      this.stats.health += this.stats.shield;
      this.stats.shield = 0;
    }
    this.lastDamage = 0;
  }

  respawn() {
    this.stats = { health: 100, shield: 85, hazard: 65, oxygen: 60 };
    this.player.position.set(0, this.world.heightAt(0, 0), 0);
    this.wanted = 0;
    for (const s of this.world.sentinels) s.userData.hostile = false;
    this.ui.toast('SEÑAL RECUPERADA POR EL ATLAS · EXOTRAJE RESTAURADO', true);
    this.save();
  }

  updateInteraction(dt) {
    const node = this.world.nearestNode(this.camera, 16, .68);
    this.targetNode = node;

    const mining = this.mouseMining || this.held.has('mine');
    if (mining && node) {
      const hit = node.group.position.clone();
      hit.y += node.visual === 'plant' ? 1.7 : .9;
      this.world.showBeam(this.camera.position, hit, 'mine');
      this.mineProgress += dt * (1 + (this.tech.mining - 1) * .25);
      if (this.mineProgress >= .5) {
        this.mineProgress = 0;
        const gain = 5 + this.tech.mining * 2 + Math.floor(Math.random() * 3);
        this.resources[node.key] = (this.resources[node.key] || 0) + gain;
        const depleted = this.world.damageNode(node, 9);
        this.units += 2;
        if (depleted) {
          this.ui.toast(`VETA AGOTADA · ${node.resource.label.toUpperCase()}`);
          this.targetNode = null;
          this.scanned = Math.min(100, this.scanned + 1.2);
        }
      }
    } else {
      this.mineProgress = 0;
      if (this.world.beam.visible) this.world.beam.visible = false;
    }

    if (this.wanted > 0) {
      this.targetSentinel = this.world.nearestSentinel(this.camera, 55, .5);
    } else {
      this.targetSentinel = null;
    }
  }

  scan() {
    if (this.mode !== 'surface' || this.modalOpen || this.scanCooldown > 0) return;
    if (this.scanCharges <= 0) { this.ui.toast('ESCÁNER SIN CARGAS · RECARGA EN CURSO', true); return; }
    this.scanCharges--;
    this.scanCooldown = 1.1;
    this.world.pulseScan(this.player.position);
    let found = 0;
    for (const node of this.world.nodes) {
      if (!node.alive || node.scanned) continue;
      const d = Math.hypot(node.group.position.x - this.player.position.x, node.group.position.z - this.player.position.z);
      if (d < 42) { node.scanned = true; found++; }
    }
    this.scanned = Math.min(100, this.scanned + 4 + found * 1.1);
    this.units += 24 + found * 3;
    if (found > 0) this.nanites += 1;
    this.flags.scanned = true;
    this.ui.toast(`BARRIDO COMPLETO · ${found} SEÑALES CATALOGADAS · +${24 + found * 3} u`);
    this.save();
  }

  shoot() {
    if (this.mode !== 'surface' || this.modalOpen || this.shootCd > 0) return;
    this.shootCd = .28;
    this.player.pitch = clamp(this.player.pitch + .009, -1.12, .72);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const target = this.world.nearestSentinel(this.camera, 62, .42);
    if (target) {
      const to = target.position.clone();
      this.world.showBeam(this.camera.position, to, 'laser');
      const damage = 22 + (this.tech.weapon - 1) * 14;
      const destroyed = this.world.damageSentinel(target, damage);
      this.wanted = Math.min(5, Math.max(1, this.wanted));
      this.combatTimer = 32;
      for (const s of this.world.sentinels) if (s.userData.alive) s.userData.hostile = true;
      if (destroyed) {
        this.nanites += 10;
        this.units += 90;
        this.ui.toast('CENTINELA NEUTRALIZADO · +10 NANITOS · +90 u');
        this.scanned = Math.min(100, this.scanned + 2);
      } else {
        this.ui.toast('IMPACTO DIRECTO · CENTINELA ALERTADO', true);
      }
    } else {
      const to = this.camera.position.clone().add(dir.multiplyScalar(36));
      this.world.showBeam(this.camera.position, to, 'laser');
    }
  }

  hitBySentinel(s) {
    if (this.wanted <= 0) return;
    this.stats.shield -= 9;
    if (this.stats.shield < 0) {
      this.stats.health += this.stats.shield;
      this.stats.shield = 0;
    }
    this.lastDamage = 0;
    this.combatTimer = 28;
    this.ui.toast('ATAQUE CENTINELA · ESCUDO COMPROMETIDO', true);
  }

  craft(id) {
    const recipe = RECIPES.find(r => r.id === id);
    if (!recipe) return;
    for (const [k, v] of Object.entries(recipe.cost)) {
      if ((this.resources[k] || 0) < v) { this.ui.toast('MATERIALES INSUFICIENTES', true); return; }
    }
    for (const [k, v] of Object.entries(recipe.cost)) this.resources[k] -= v;
    switch (id) {
      case 'repair': this.stats.health = clamp(this.stats.health + 35, 0, 100); break;
      case 'shield': this.stats.shield = clamp(this.stats.shield + 50, 0, 100); break;
      case 'oxygen': this.stats.oxygen = clamp(this.stats.oxygen + 55, 0, 100); break;
      case 'warpcell': this.warpCells++; this.flags.craftedWarp = true; break;
      case 'fuel': this.launchFuel += 2; break;
      case 'mining': this.tech.mining++; break;
      case 'weapon': this.tech.weapon++; break;
      case 'hazard': this.tech.hazard++; break;
    }
    this.ui.toast(`FABRICADO · ${recipe.name.toUpperCase()}`);
    this.scanned = Math.min(100, this.scanned + 1);
    this.save();
  }

  sell(key, qty) {
    const have = this.resources[key] || 0;
    const n = Math.min(qty, have);
    if (n <= 0) { this.ui.toast('SIN MATERIALES PARA VENDER', true); return; }
    this.resources[key] -= n;
    const value = Math.round(RESOURCES[key].price * n * (1 + this.system.wealth * .025));
    this.units += value;
    this.ui.toast(`VENTA · ${n} × ${RESOURCES[key].label} · +${fmt(value)} u`);
    this.save();
  }

  stationService(kind) {
    const costs = { heal: 250, warpcell: 400, fuel: 180, nanites: 500 };
    const cost = costs[kind];
    if (!cost || this.units < cost) { this.ui.toast('UNIDADES INSUFICIENTES', true); return; }
    this.units -= cost;
    if (kind === 'heal') {
      this.stats.shield = 100; this.stats.oxygen = Math.max(this.stats.oxygen, 85); this.stats.health = Math.max(this.stats.health, 85);
      this.ui.toast('ESCUDO Y SOPORTE VITAL RESTAURADOS');
    } else if (kind === 'warpcell') {
      this.warpCells++; this.flags.craftedWarp = true;
      this.ui.toast('CÉLULA DE DEFORMACIÓN ADQUIRIDA');
    } else if (kind === 'fuel') {
      this.launchFuel += 2;
      this.ui.toast('LANZADORES RECARGADOS · +2 DESPEGUES');
    } else if (kind === 'nanites') {
      this.nanites += 15;
      this.ui.toast('REFINADO · +15 NANITOS');
    }
    this.save();
  }

  launch() {
    if (this.mode !== 'surface' || this.modalOpen) return;
    const d = Math.hypot(this.player.position.x - this.world.shipPos.x, this.player.position.z - this.world.shipPos.z);
    if (d > 9) { this.ui.toast('ACÉRCATE A LA NAVE PARA DESPEGAR', true); return; }
    if (this.launchFuel <= 0) { this.ui.toast('SIN COMBUSTIBLE DE LANZAMIENTO', true); return; }
    this.launchFuel--;
    this.flags.launched = true;
    this.mode = 'orbit';
    this.ui.hideHud();
    this.ui.showOrbit(this);
    this.ui.toast('DESPEGUE COMPLETADO · ÓRBITA ESTABLE');
    this.save();
  }

  land() {
    if (this.mode !== 'orbit') return;
    this.mode = 'surface';
    this.ui.hideOrbit();
    this.ui.showHud();
    this.player.position.set(this.world.shipPos.x + 4, this.world.heightAt(this.world.shipPos.x + 4, this.world.shipPos.z + 3), this.world.shipPos.z + 3);
    this.updateCamera(0);
    this.ui.toast('ATERRIZAJE AUTOMÁTICO · SUPERFICIE');
  }

  startWarp(target) {
    if (this.mode === 'warp') return;
    if (target === this.system.index) return;
    if (this.warpCells <= 0) { this.ui.toast('SIN CÉLULAS DE DEFORMACIÓN · FABRICA UNA', true); return; }
    const to = this.universe.systemAt(target);
    this.warpCells--;
    this.mode = 'warp';
    this.warpTimer = 0;
    this.warpTarget = target;
    this.flags.launched = true;
    this.ui.closeModal();
    this.ui.hideOrbit();
    this.ui.hideHud();
    this.ui.showWarp(this.system, to);
    this.save();
  }

  updateWarp(dt) {
    this.warpTimer += dt;
    const p = Math.min(1, this.warpTimer / 2.65);
    const eased = p * p * (3 - 2 * p);
    this.ui.updateWarp(eased);
    if (p >= 1) {
      const to = this.universe.systemAt(this.warpTarget);
      this.universe.selectSystem(this.warpTarget);
      this.universe.selectPlanet(0);
      this.visited++;
      this.flags.warped = true;
      this.mapSelection = this.warpTarget + 1;
      this.system = this.universe.currentSystem();
      this.planet = this.universe.currentPlanet();
      this.buildWorld();
      this.mode = 'orbit';
      this.ui.hideWarp();
      this.ui.showOrbit(this);
      this.ui.toast(`LLEGADA · ${to.name.toUpperCase()} · ${to.planets.length} PLANETAS`);
      this.save();
    }
  }

  objectiveInfo() {
    if (!this.flags.scanned) return { text: 'Escanea el ecosistema local', progress: 10 };
    if ((this.resources.CARBON || 0) < 30) return { text: `Recolecta carbono (${Math.floor(this.resources.CARBON || 0)}/30)`, progress: 30 + (this.resources.CARBON || 0) / 30 * 18 };
    if (!this.flags.launched) return { text: 'Regresa a la nave y despega', progress: 58 };
    if (!this.flags.warped) return { text: 'Traza un salto interestelar desde la órbita', progress: 78 };
    return { text: `Explora ${this.system.name} · cataloga nuevas señales`, progress: Math.min(100, 62 + this.scanned * .38) };
  }
}
