import { RESOURCES, HAZARDS } from './universe.js';
import { RECIPES } from './recipes.js';

const $ = id => document.getElementById(id);
export const fmt = n => Math.floor(n).toLocaleString('es-ES');
const pct = n => `${Math.max(0, Math.min(100, Math.round(n)))}%`;

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      intro: $('intro'), hud: $('hud'), start: $('start-btn'), cont: $('continue-btn'), codex: $('codex-btn'),
      modal: $('modal'), modalContent: $('modal-content'), toast: $('toast'),
      orbit: $('orbit'), warp: $('warp-screen'),
      system: $('system-name'), planet: $('planet-line'), weather: $('weather-line'), star: $('star-chip'),
      units: $('units'), nanites: $('nanites'), warpLine: $('warp-cell-line'), wanted: $('wanted-stars'),
      objective: $('objective'), objBar: $('objective-bar'),
      health: $('health-bar'), healthVal: $('health-value'), shield: $('shield-bar'), shieldVal: $('shield-value'),
      hazard: $('hazard-bar'), hazardVal: $('hazard-value'), hazardLabel: $('hazard-label'),
      oxygen: $('oxygen-bar'), oxygenVal: $('oxygen-value'), jet: $('jet-bar'), jetVal: $('jet-value'),
      scanner: $('scanner-charges'), scanned: $('scan-percent'), sentinel: $('sentinel-status'),
      target: $('target'), targetSymbol: $('target-symbol'), targetName: $('target-name'), targetSub: $('target-sub'), targetProgress: $('target-progress'),
      heading: $('heading'), compass: $('compass-labels'), radar: $('radar'),
      touch: $('touch-ui'), joystick: $('joystick'), knob: $('joystick-knob'),
    };
    this.compassSpans = [];
    this.toastTimer = 0;
    this.lastHud = 0;
    this.lastRadar = 0;
    this.buildCompass();
    this.bindChrome();
    this.el.cont.hidden = !localStorage.getItem('fractured-skies-save');
  }

  buildCompass() {
    const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SO'], [270, 'O'], [315, 'NO']];
    const wrap = document.createDocumentFragment();
    for (let deg = 0; deg < 360; deg += 15) {
      const span = document.createElement('span');
      const label = labels.find(l => l[0] === deg);
      if (label) {
        span.textContent = label[1];
        span.className = 'major';
      } else {
        span.className = 'tick';
      }
      span.dataset.deg = deg;
      wrap.appendChild(span);
      this.compassSpans.push(span);
    }
    this.el.compass.appendChild(wrap);
  }

  bindChrome() {
    this.el.start.addEventListener('click', () => this.game.start(false));
    this.el.cont.addEventListener('click', () => this.game.start(true));
    this.el.codex.addEventListener('click', () => this.openCodex());
    $('menu-btn').addEventListener('click', () => this.openPause());
    $('orbit-close').addEventListener('click', () => this.game.land());
    $('orbit-map').addEventListener('click', () => this.openMap());
    $('orbit-station').addEventListener('click', () => this.openStation());
    $('orbit-warp').addEventListener('click', () => this.game.startWarp(this.game.systemIndex + 1));
    this.el.modal.addEventListener('click', e => {
      if (e.target === this.el.modal || e.target.closest('[data-close]')) this.closeModal();
    });
  }

  hideIntro() {
    this.el.intro.classList.add('out');
    setTimeout(() => { this.el.intro.style.display = 'none'; }, 900);
    this.el.hud.classList.remove('hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
  }

  showHud() {
    this.el.hud.classList.remove('hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
  }
  hideHud() {
    this.el.hud.classList.add('hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
  }

  toast(text, danger = false) {
    this.el.toast.textContent = text;
    this.el.toast.classList.toggle('danger', danger);
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 2900);
  }

  update(game, dt) {
    const p = game.planet, s = game.system;
    this.el.system.textContent = s.name.toUpperCase();
    this.el.planet.textContent = `${p.name.toUpperCase()} · ${p.biome.label.toUpperCase()}`;
    this.el.weather.textContent = `${p.weather.toUpperCase()} · ${p.hazard.label.toUpperCase()}`;
    this.el.star.textContent = `${s.starClass.label}-${s.index}`;
    this.el.star.style.color = s.starClass.css;
    this.el.star.style.borderColor = s.starClass.css + '55';
    this.el.units.textContent = fmt(game.units);
    this.el.nanites.textContent = fmt(game.nanites);
    this.el.warpLine.textContent = `SALTO ${game.warpCells} · LANZAMIENTO ${game.launchFuel}`;
    this.el.wanted.textContent = game.wanted > 0 ? '★'.repeat(Math.min(5, game.wanted)) + ' BUSCADO' : '';

    const o = game.objectiveInfo();
    this.el.objective.textContent = o.text;
    this.el.objBar.style.width = `${o.progress}%`;

    this.el.health.style.width = pct(game.stats.health);
    this.el.healthVal.textContent = pct(game.stats.health);
    this.el.shield.style.width = pct(game.stats.shield);
    this.el.shieldVal.textContent = pct(game.stats.shield);
    this.el.hazard.style.width = pct(game.stats.hazard);
    this.el.hazardVal.textContent = pct(game.stats.hazard);
    this.el.oxygen.style.width = pct(game.stats.oxygen);
    this.el.oxygenVal.textContent = pct(game.stats.oxygen);
    this.el.jet.style.width = pct(game.jet);
    this.el.jetVal.textContent = pct(game.jet);
    this.el.hazardLabel.textContent = `${p.hazard.icon} ${p.hazard.label.toUpperCase()}`;
    this.el.hazardLabel.style.color = p.hazard.tint;

    this.el.scanner.textContent = `${game.scanCharges} ${game.scanCharges === 1 ? 'CARGA' : 'CARGAS'}`;
    this.el.scanned.textContent = `${Math.min(100, Math.round(game.scanned))}%`;
    this.el.sentinel.textContent = game.wanted > 0 ? 'HOSTILES' : 'EN CALMA';
    this.el.sentinel.className = game.wanted > 0 ? 'orange' : 'cyan';

    this.updateTarget(game);
    this.updateCompass(game);
    if (performance.now() - this.lastRadar > 100) {
      this.drawRadar(game);
      this.lastRadar = performance.now();
    }
  }

  updateTarget(game) {
    const node = game.targetNode;
    if (!node || !node.alive) {
      this.el.target.classList.add('hidden');
      return;
    }
    this.el.target.classList.remove('hidden');
    this.el.targetSymbol.textContent = node.resource.symbol;
    this.el.targetSymbol.style.color = node.resource.css;
    this.el.targetName.textContent = node.resource.label.toUpperCase();
    this.el.targetName.style.color = node.resource.css;
    const d = Math.round(game.camera.position.distanceTo(node.group.position));
    this.el.targetSub.textContent = `${node.scanned ? 'ANALIZADO' : 'SIN ANALIZAR'} · ${d} m · ${Math.ceil(node.amount)} u`;
    this.el.targetProgress.style.width = `${Math.min(100, game.mineProgress / .5 * 100)}%`;
  }

  updateCompass(game) {
    const heading = ((game.player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    for (const span of this.compassSpans) {
      const deg = Number(span.dataset.deg);
      let delta = ((deg - heading + 540) % 360) - 180;
      const visible = Math.abs(delta) < 118;
      span.style.display = visible ? '' : 'none';
      if (visible) span.style.left = `${50 + delta / 120 * 50}%`;
    }
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const dir = dirs[Math.round(heading / 45) % 8];
    this.el.heading.textContent = `${String(Math.round(heading)).padStart(3, '0')}° · ${dir}`;
  }

  drawRadar(game) {
    const canvas = this.el.radar;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, R = w * .43;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0, 'rgba(10,36,40,.55)'); bg.addColorStop(1, 'rgba(2,8,12,.7)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(55,242,212,.13)'; ctx.lineWidth = 1;
    for (const r of [R * .33, R * .66, R]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    const yaw = game.player.yaw;
    const world = (x, z) => {
      const dx = x - game.player.position.x, dz = z - game.player.position.z;
      const c = Math.cos(-yaw), s = Math.sin(-yaw);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      return [cx + rx / 82 * R, cy + rz / 82 * R];
    };
    const blip = (x, z, color, size = 3, shape = 'dot') => {
      const [px, py] = world(x, z);
      if (Math.hypot(px - cx, py - cy) > R) return;
      ctx.fillStyle = color; ctx.strokeStyle = color;
      if (shape === 'diamond') {
        ctx.beginPath(); ctx.moveTo(px, py - size); ctx.lineTo(px + size, py); ctx.lineTo(px, py + size); ctx.lineTo(px - size, py); ctx.closePath(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
      }
    };
    for (const n of game.world.nodes) if (n.alive) blip(n.group.position.x, n.group.position.z, n.resource.css, n.scanned ? 2.7 : 1.8, n.scanned ? 'dot' : 'diamond');
    blip(game.world.monolithPos.x, game.world.monolithPos.z, '#37f2d4', 4, 'diamond');
    blip(game.world.shipPos.x, game.world.shipPos.z, '#ffd85e', 4.5, 'diamond');
    for (const s of game.world.sentinels) if (s.userData.alive) blip(s.position.x, s.position.z, s.userData.hostile ? '#ff5e5e' : '#b8c6d9', 2.6);
    ctx.fillStyle = '#f5e9c8';
    ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 5, cy + 5); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx - 5, cy + 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(55,242,212,.35)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  }

  openModal(html) {
    this.el.modalContent.innerHTML = html;
    this.el.modal.classList.remove('hidden');
    this.el.modal.setAttribute('aria-hidden', 'false');
    this.game.modalOpen = true;
    this.el.modalContent.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModal()));
  }

  closeModal() {
    if (this.el.modal.classList.contains('hidden')) return;
    this.el.modal.classList.add('hidden');
    this.el.modal.setAttribute('aria-hidden', 'true');
    this.game.modalOpen = false;
    this.el.modalContent.innerHTML = '';
  }

  modalHead(kicker, title, description) {
    return `<div class="modal-head"><div><span class="panel-label">${kicker}</span><h2>${title}</h2><p>${description}</p></div><button class="modal-close" data-close aria-label="Cerrar">×</button></div>`;
  }

  openInventory() {
    const g = this.game;
    const resources = Object.entries(RESOURCES).map(([key, r]) => `
      <div class="res-card" style="color:${r.css}">
        <div class="res-symbol">${r.symbol}</div>
        <div class="res-copy"><b>${r.label.toUpperCase()}</b><span>${r.blurb.toUpperCase()}</span></div>
        <div class="res-amount">${fmt(g.resources[key] || 0)}</div>
      </div>`).join('');
    const tech = [
      ['MINERO DE FASE', `Nv. ${g.tech.mining}`, 'Extracción +' + (g.tech.mining - 1) * 25 + '%'],
      ['BLASTER DE FOTONES', `Nv. ${g.tech.weapon}`, 'Daño +' + (g.tech.weapon - 1) * 40 + '%'],
      ['TRAJE AMBIENTAL', `Nv. ${g.tech.hazard}`, 'Resistencia +' + (g.tech.hazard - 1) * 20 + '%'],
      ['ESCÁNER DE CAMPO', `${g.scanCharges} cargas`, 'Barrido de 42 m'],
      ['HIPERIMPULSOR', g.warpCells ? 'OPERATIVO' : 'SIN CÉLULAS', `${g.warpCells} célula(s) de deformación`],
      ['PROPULSORES', 'OPERATIVO', `${g.launchFuel} lanzamiento(s) disponibles`],
    ].map(([a, b, c]) => `<div class="tech-row"><div><b>${a}</b><span>${c}</span></div><span class="cyan">${b}</span></div>`).join('');
    this.openModal(`<div class="modal-inner">
      ${this.modalHead('EXOTRAJE // INVENTARIO', 'CARGA DE EXPEDICIÓN', 'Materiales recolectados, módulos instalados y estado del traje. La capacidad aumenta al reparar cápsulas de carga.')}
      <div class="modal-grid">
        <section class="inv-section"><h3>MATERIALES · ${Object.values(g.resources).reduce((a, b) => a + b, 0)} UNIDADES</h3><div class="res-grid">${resources}</div></section>
        <section class="inv-section"><h3>MÓDULOS INSTALADOS</h3>${tech}
          <div class="stat-grid" style="margin-top:14px">
            <div class="stat-box"><span>UNIDADES</span><b>${fmt(g.units)}</b></div>
            <div class="stat-box"><span>NANITOS</span><b>${fmt(g.nanites)}</b></div>
            <div class="stat-box"><span>CATALOGADO</span><b>${Math.round(g.scanned)}%</b></div>
            <div class="stat-box"><span>CENTINELAS</span><b>${g.wanted ? 'HOSTILES' : 'EN CALMA'}</b></div>
          </div>
        </section>
      </div>
      <div class="modal-actions"><button class="modal-btn primary" data-close>VOLVER AL EXOTRAJE</button><button class="modal-btn" id="inventory-craft">FABRICAR</button></div>
    </div>`);
    $('inventory-craft').addEventListener('click', () => this.openCraft());
  }

  canCraft(recipe) {
    return Object.entries(recipe.cost).every(([k, v]) => (this.game.resources[k] || 0) >= v);
  }

  openCraft() {
    const g = this.game;
    const rows = RECIPES.map(r => {
      const enough = this.canCraft(r);
      const cost = Object.entries(r.cost).map(([k, v]) => {
        const have = g.resources[k] || 0;
        const color = have >= v ? RESOURCES[k].css : '#ff5e5e';
        return `<span class="cost-chip" style="color:${color}">${RESOURCES[k].symbol} ${v} / ${have}</span>`;
      }).join('');
      return `<div class="craft-row ${enough ? '' : 'no'}">
        <div><b>${r.name.toUpperCase()}</b><span>${r.desc}</span><div class="cost-chips">${cost}</div></div>
        <button class="craft-btn" data-craft="${r.id}" ${enough ? '' : 'disabled'}>FABRICAR</button>
      </div>`;
    }).join('');
    this.openModal(`<div class="modal-inner">
      ${this.modalHead('UNIDAD DE FABRICACIÓN // PORTÁTIL', 'ENSAMBLAJE', 'Combina materiales para reparar el traje, mejorar la herramienta o preparar el siguiente salto.')}
      <div class="craft-list">${rows}</div>
      <div class="modal-actions"><button class="modal-btn" data-close>VOLVER</button><button class="modal-btn" id="craft-inventory">INVENTARIO</button></div>
    </div>`);
    this.el.modalContent.querySelectorAll('[data-craft]').forEach(btn => btn.addEventListener('click', () => {
      g.craft(btn.dataset.craft);
      if (g.modalOpen) this.openCraft();
    }));
    $('craft-inventory').addEventListener('click', () => this.openInventory());
  }

  openCodex() {
    const g = this.game, p = g.planet, s = g.system;
    const resourceList = p.resources.map(k => `<div class="fauna-line"><span>${RESOURCES[k].label}</span><span>${RESOURCES[k].symbol}</span></div>`).join('');
    const faunaList = p.faunaNames.map(n => `<div class="fauna-line"><span>${n}</span><span>${p.fauna} ESPECIES</span></div>`).join('');
    this.openModal(`<div class="modal-inner">
      ${this.modalHead('ARCHIVO DEL ATLAS // CÓDICE', 'REGISTRO DE SEMILLA', `Entrada ${String(s.index + 1).padStart(4, '0')} · datos reconstruidos con la semilla ${s.seed.toString(16).toUpperCase()}.`)}
      <div class="codex-grid">
        <div class="codex-col">
          <h3>SISTEMA ${s.name.toUpperCase()}</h3>
          <p>Estrella clase ${s.starClass.label} · ${s.economy} · ${s.wealthLabel}. ${s.starClass.description}. La señal local pertenece a una expedición anterior del Atlas. No hay respuesta.</p>
          <h3 style="margin-top:18px">PLANETA ${p.name.toUpperCase()}</h3>
          <p>${p.biome.description} Gravedad 0.${8 + (p.seed % 9)} g · radio ${fmt(p.radiusKm)} km · ${p.weather.toLowerCase()}.</p>
          <p class="quote">«El universo no está vacío. Está esperando a ser leído.»</p>
        </div>
        <div class="codex-col">
          <h3>BIOMA</h3>
          <p>${p.biome.label.toUpperCase()}<br>${p.flora} especies de flora<br>${p.fauna} especies de fauna<br>${p.sentinelLevel > 2 ? 'Presencia centinela elevada' : 'Patrullas centinelas dispersas'}</p>
          <h4>RECURSOS DETECTADOS</h4>
          ${resourceList}
          <h4>FAUNA REGISTRADA</h4>
          ${faunaList || '<p>Sin firmas biológicas.</p>'}
        </div>
        <div class="codex-col">
          <h3>PELIGRO AMBIENTAL</h3>
          <p style="color:${p.hazard.tint}">${p.hazard.icon} ${p.hazard.label.toUpperCase()}</p>
          <p>Drenaje estimado ${p.hazard.drain}%/ciclo. Mantén el escudo ambiental por encima del 25%.</p>
          <h4>ESTADO DE LA EXPEDICIÓN</h4>
          <div class="fauna-line"><span>CATALOGADO</span><span>${Math.round(g.scanned)}%</span></div>
          <div class="fauna-line"><span>SISTEMAS VISITADOS</span><span>${g.visited}</span></div>
          <div class="fauna-line"><span>UNIDADES</span><span>${fmt(g.units)}</span></div>
          <div class="fauna-line"><span>NANITOS</span><span>${fmt(g.nanites)}</span></div>
          <h4>NOTA DE CAMPO</h4>
          <p>Las ruinas monolíticas responden a la herramienta de escaneo. Mantén distancia de los centinelas si no puedes sostener un combate.</p>
        </div>
      </div>
      <div class="modal-actions"><button class="modal-btn primary" data-close>CERRAR ARCHIVO</button></div>
    </div>`);
  }

  openPause() {
    this.openModal(`<div class="modal-inner">
      ${this.modalHead('PROTOCOLO DE PAUSA // EXPEDICIÓN', 'SEÑAL EN ESPERA', 'La simulación permanece activa. Abre una interfaz o guarda el estado local.')}
      <div class="modal-grid">
        <div class="inv-section"><h3>INTERFACES</h3>
          <div class="modal-actions" style="margin-top:0">
            <button class="modal-btn" data-menu="inventory">INVENTARIO</button>
            <button class="modal-btn" data-menu="craft">FABRICAR</button>
            <button class="modal-btn" data-menu="codex">CÓDICE</button>
            <button class="modal-btn" data-menu="map">MAPA</button>
          </div>
        </div>
        <div class="inv-section"><h3>EXPEDICIÓN</h3>
          <p style="font:9px/1.7 var(--mono);color:rgba(143,164,170,.8);margin:0">Sistema ${this.game.system.name.toUpperCase()} · ${this.game.planet.name.toUpperCase()}<br>Visitados: ${this.game.visited} · Catalogado: ${Math.round(this.game.scanned)}%</p>
          <div class="modal-actions">
            <button class="modal-btn primary" data-menu="resume">CONTINUAR</button>
            <button class="modal-btn" data-menu="save">GUARDAR SEÑAL</button>
          </div>
        </div>
      </div>
    </div>`);
    this.el.modalContent.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
      const menu = b.dataset.menu;
      if (menu === 'resume') this.closeModal();
      if (menu === 'inventory') this.openInventory();
      if (menu === 'craft') this.openCraft();
      if (menu === 'codex') this.openCodex();
      if (menu === 'map') this.openMap();
      if (menu === 'save') { this.game.save(); this.toast('SEÑAL DE EXPEDICIÓN GUARDADA'); this.el.cont.hidden = false; this.closeModal(); }
    }));
  }

  openStation() {
    const g = this.game, s = g.system;
    const tradables = Object.keys(RESOURCES).filter(k => (g.resources[k] || 0) > 0).slice(0, 7);
    const rows = tradables.map(k => `<div class="trade-row">
      <div class="res-symbol" style="color:${RESOURCES[k].css}">${RESOURCES[k].symbol}</div>
      <div class="res-copy"><b>${RESOURCES[k].label.toUpperCase()}</b><span>${g.resources[k]} en inventario</span></div>
      <div class="price">${RESOURCES[k].price} u · ud.</div>
      <button class="trade-btn" data-sell="${k}">VENDER 10</button>
    </div>`).join('');
    this.openModal(`<div class="modal-inner">
      ${this.modalHead('ESTACIÓN ESPACIAL // COMERCIO', s.stationName.toUpperCase(), `${s.economy} · ${s.wealthLabel} · ${s.conflictLabel}. Los precios fluctúan con la economía local.`)}
      <div class="trade-grid">
        <section class="inv-section"><h3>MERCADO DE MATERIALES</h3>${rows || '<p style="font:9px/1.6 var(--mono);color:rgba(143,164,170,.7)">No hay materiales vendibles.</p>'}</section>
        <section class="inv-section"><h3>SERVICIOS</h3>
          <div class="service-row"><b>RECARGA DE ESCUDO</b><span>Restaura escudo y soporte vital.</span><button data-service="heal">250 u</button></div>
          <div class="service-row"><b>CÉLULA DE DEFORMACIÓN</b><span>Añade 1 salto al hiperimpulsor.</span><button data-service="warpcell">400 u</button></div>
          <div class="service-row"><b>REPARAR LANZADORES</b><span>Añade 2 cargas de despegue.</span><button data-service="fuel">180 u</button></div>
          <div class="service-row"><b>REFINAR NANITOS</b><span>Convierte 500 unidades en 15 nanitos.</span><button data-service="nanites">500 u</button></div>
          <div class="stat-grid" style="margin-top:14px"><div class="stat-box"><span>UNIDADES</span><b>${fmt(g.units)}</b></div><div class="stat-box"><span>NANITOS</span><b>${fmt(g.nanites)}</b></div></div>
        </section>
      </div>
      <div class="modal-actions"><button class="modal-btn" data-close>DESATRACAR</button></div>
    </div>`);
    this.el.modalContent.querySelectorAll('[data-sell]').forEach(b => b.addEventListener('click', () => {
      g.sell(b.dataset.sell, 10); this.openStation();
    }));
    this.el.modalContent.querySelectorAll('[data-service]').forEach(b => b.addEventListener('click', () => {
      g.stationService(b.dataset.service); if (g.modalOpen) this.openStation();
    }));
  }

  openMap() {
    const g = this.game;
    const systems = g.universe.nearby(9);
    if (g.mapSelection == null || g.mapSelection < systems[0].index) g.mapSelection = systems[0].index + 1;
    const cards = systems.map(s => `<button class="map-card ${s.index === g.mapSelection ? 'selected' : ''}" data-system="${s.index}" style="color:${s.starClass.css}">
      <span class="map-star"></span><b>${s.name.toUpperCase()}</b><span>${s.starClass.label} · ${s.economy.toUpperCase()}</span><span>${s.planets.length} PLANETAS · ${s.distance.toFixed(2)} AL</span>
    </button>`).join('');
    const sel = g.universe.systemAt(g.mapSelection);
    const canJump = g.mapSelection !== g.systemIndex && g.warpCells > 0;
    const jumpLabel = g.mapSelection === g.systemIndex ? 'SISTEMA ACTUAL' : (g.warpCells > 0 ? 'TRAZAR SALTO' : 'SIN CÉLULAS DE DEFORMACIÓN');
    const body = `<div class="modal-inner">
      ${this.modalHead('ATLAS // MAPA GALÁCTICO', 'RUTA AL NÚCLEO', 'Cada nodo es una simulación completa. El hiperimpulsor consume una célula de deformación por salto.')}
      <div class="map-grid">${cards}</div>
      <div class="map-detail"><div><h3>${sel.name.toUpperCase()}</h3><p>${sel.starClass.description} · ${sel.economy} · ${sel.wealthLabel} · ${sel.conflictLabel}<br>Semilla ${sel.seed.toString(16).toUpperCase()} · ${sel.planets.length} planetas · distancia ${sel.distance.toFixed(2)} AL</p></div><button class="modal-btn primary" data-warp="${sel.index}" ${canJump ? '' : 'disabled'}>${jumpLabel}</button></div>
      <div class="modal-actions"><button class="modal-btn" data-close>CERRAR MAPA</button></div>
    </div>`;
    this.openModal(body);
    this.el.modalContent.querySelectorAll('[data-system]').forEach(b => b.addEventListener('click', () => {
      g.mapSelection = Number(b.dataset.system);
      this.openMap();
    }));
    const warpBtn = this.el.modalContent.querySelector('[data-warp]');
    if (warpBtn) warpBtn.addEventListener('click', () => {
      if (Number(warpBtn.dataset.warp) === g.systemIndex) return;
      g.startWarp(Number(warpBtn.dataset.warp));
    });
  }

  showWarp(from, to) {
    $('warp-route').textContent = `${from.name.toUpperCase()} → ${to.name.toUpperCase()}`;
    $('warp-progress').style.width = '0%';
    $('warp-percent').textContent = '0%';
    this.el.warp.classList.remove('hidden');
    this.el.warp.setAttribute('aria-hidden', 'false');
  }

  updateWarp(progress) {
    $('warp-progress').style.width = `${progress * 100}%`;
    $('warp-percent').textContent = `${Math.round(progress * 100)}%`;
  }

  hideWarp() {
    this.el.warp.classList.add('hidden');
    this.el.warp.setAttribute('aria-hidden', 'true');
  }

  showOrbit(game) {
    const s = game.system;
    $('orbit-system').textContent = s.name.toUpperCase();
    $('orbit-meta').textContent = `${s.starClass.label} · ${s.economy.toUpperCase()} · ${s.wealthLabel.toUpperCase()} · ${s.planets.length} PLANETAS`;
    $('orbit-seed').textContent = s.seed.toString(16).toUpperCase();
    const warpBtn = $('orbit-warp');
    warpBtn.disabled = game.warpCells <= 0;
    const sub = warpBtn.querySelector('small');
    if (sub) sub.textContent = game.warpCells > 0 ? 'CONSUME 1 CÉLULA DE DEFORMACIÓN' : 'SIN CÉLULAS · FABRICA UNA';
    this.el.orbit.classList.remove('hidden');
    this.el.orbit.setAttribute('aria-hidden', 'false');
  }

  hideOrbit() {
    this.el.orbit.classList.add('hidden');
    this.el.orbit.setAttribute('aria-hidden', 'true');
  }
}
