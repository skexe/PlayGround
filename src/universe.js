import { Rng } from './noise.js';

export const RESOURCES = {
  CARBON:     { label: 'Carbono', symbol: 'C', color: 0xff7b4d, css: '#ff7b4d', price: 24, blurb: 'Combustible orgánico' },
  FERRITE:    { label: 'Ferrita', symbol: 'Fe', color: 0xb8c6d9, css: '#b8c6d9', price: 32, blurb: 'Aleaciones y blindaje' },
  SODIUM:     { label: 'Sodio', symbol: 'Na', color: 0xffd85e, css: '#ffd85e', price: 42, blurb: 'Escudos ambientales' },
  OXYGEN:     { label: 'Oxígeno', symbol: 'O₂', color: 0x57d9ff, css: '#57d9ff', price: 38, blurb: 'Soporte vital' },
  DIHYDROGEN: { label: 'Dihidrógeno', symbol: 'H₂', color: 0xb78cff, css: '#b78cff', price: 46, blurb: 'Combustible de nave' },
  COPPER:     { label: 'Cobre', symbol: 'Cu', color: 0xff9d5c, css: '#ff9d5c', price: 76, blurb: 'Conductores avanzados' },
  COBALT:     { label: 'Cobalto', symbol: 'Co', color: 0x5c8cff, css: '#5c8cff', price: 88, blurb: 'Tecnología de salto' },
  URANIUM:    { label: 'Uranio', symbol: 'U', color: 0xb4ff5c, css: '#b4ff5c', price: 120, blurb: 'Núcleos de energía' },
  EMERIL:     { label: 'Emerilio', symbol: 'Em', color: 0x5cffc8, css: '#5cffc8', price: 165, blurb: 'Aleación exótica' },
  GOLD:       { label: 'Oro', symbol: 'Au', color: 0xffe27a, css: '#ffe27a', price: 205, blurb: 'Comercio de lujo' },
  PARAFINIUM: { label: 'Parafinio', symbol: 'Pf', color: 0xff6ec8, css: '#ff6ec8', price: 190, blurb: 'Combustible de hiperimpulsor' },
  CHROMATIC:  { label: 'Cromo', symbol: 'Ch', color: 0xcf7bff, css: '#cf7bff', price: 240, blurb: 'Material de élite' },
};

export const HAZARDS = {
  NONE:      { label: 'Templado', icon: '◌', drain: 0, tint: '#57d9ff' },
  HEAT:      { label: 'Calor extremo', icon: '☀', drain: 4.5, tint: '#ff7b4d' },
  COLD:      { label: 'Frío criogénico', icon: '❄', drain: 4.0, tint: '#6ec8ff' },
  TOXIC:     { label: 'Atmósfera tóxica', icon: '☣', drain: 5.0, tint: '#b4ff5c' },
  RADIATION: { label: 'Radiación', icon: '☢', drain: 5.5, tint: '#b78cff' },
  STORM:     { label: 'Tormenta iónica', icon: 'ϟ', drain: 7.0, tint: '#ffd85e' },
};

export const BIOMES = {
  LUSH: {
    label: 'Jardín exuberante', description: 'Vida fotosintética densa y océanos poco profundos.',
    skyTop: 0x061625, skyMid: 0x1b5260, skyHorizon: 0xe5956d, fog: 0x8d7b86,
    low: 0x223b32, mid: 0x3d8a5d, high: 0xe8d77b, accent: 0x69f0ae,
    hazard: 'NONE', weather: ['Brisa fresca', 'Lluvia ligera', 'Niebla esporádica'],
    resources: ['CARBON', 'OXYGEN', 'DIHYDROGEN', 'COPPER'], water: true,
  },
  SCORCHED: {
    label: 'Mundo abrasado', description: 'Corteza fracturada por siglos de radiación solar.',
    skyTop: 0x1a0d0b, skyMid: 0x6b2a19, skyHorizon: 0xff9b5b, fog: 0xd56b45,
    low: 0x4a211b, mid: 0x9c462a, high: 0xffc46b, accent: 0xff6b4a,
    hazard: 'HEAT', weather: ['Calor abrasador', 'Vientos de ceniza', 'Tormenta térmica'],
    resources: ['FERRITE', 'SODIUM', 'COPPER', 'URANIUM'], water: false,
  },
  FROZEN: {
    label: 'Tundra criogénica', description: 'Glaciares azules y formas de vida crioprotectoras.',
    skyTop: 0x06101e, skyMid: 0x1d3e5c, skyHorizon: 0xbfe7f2, fog: 0x9cc6d8,
    low: 0x29465c, mid: 0x6e9eb8, high: 0xe8fbff, accent: 0x6ec8ff,
    hazard: 'COLD', weather: ['Nieve cristalina', 'Ventisca', 'Frío profundo'],
    resources: ['DIHYDROGEN', 'SODIUM', 'COBALT', 'EMERIL'], water: true,
  },
  TOXIC: {
    label: 'Pantano tóxico', description: 'Esporas corrosivas flotan sobre mares ácidos.',
    skyTop: 0x101a0a, skyMid: 0x354d18, skyHorizon: 0xb7c76b, fog: 0x76864a,
    low: 0x24351a, mid: 0x5a7c2e, high: 0xd7e86b, accent: 0xb4ff5c,
    hazard: 'TOXIC', weather: ['Lluvia ácida', 'Niebla de esporas', 'Aire corrosivo'],
    resources: ['CARBON', 'FERRITE', 'SODIUM', 'EMERIL'], water: true,
  },
  RADIOACTIVE: {
    label: 'Páramo irradiado', description: 'Isótopos inestables iluminan la noche con un verde imposible.',
    skyTop: 0x0c0e1a, skyMid: 0x293765, skyHorizon: 0x8b9cff, fog: 0x6675b8,
    low: 0x252a45, mid: 0x4b5685, high: 0xc6d2ff, accent: 0xb78cff,
    hazard: 'RADIATION', weather: ['Tormenta de partículas', 'Aurora radiactiva', 'Viento iónico'],
    resources: ['URANIUM', 'FERRITE', 'COBALT', 'CHROMATIC'], water: false,
  },
  EXOTIC: {
    label: 'Anomalía cromática', description: 'La física local presenta lecturas que no deberían existir.',
    skyTop: 0x1a0b23, skyMid: 0x5a1d70, skyHorizon: 0xff86c8, fog: 0xb86aa0,
    low: 0x30173d, mid: 0x6e2e7c, high: 0xffb7e8, accent: 0xff6ec8,
    hazard: 'STORM', weather: ['Tormenta anómala', 'Distorsión temporal', 'Lluvia de cristales'],
    resources: ['GOLD', 'CHROMATIC', 'PARAFINIUM', 'COBALT'], water: true,
  },
  BARREN: {
    label: 'Luna estéril', description: 'Polvo antiguo, cráteres silenciosos y ecos de máquinas.',
    skyTop: 0x111318, skyMid: 0x343a45, skyHorizon: 0xc2c7d0, fog: 0x8a8f9a,
    low: 0x2a2d34, mid: 0x5d626c, high: 0xd5d9e0, accent: 0xb8c6d9,
    hazard: 'NONE', weather: ['Vacío tenue', 'Polvo lunar', 'Silencio absoluto'],
    resources: ['FERRITE', 'COPPER', 'GOLD', 'CHROMATIC'], water: false,
  },
};

export const STAR_CLASSES = {
  YELLOW: { label: 'G', color: 0xffd27a, css: '#ffd27a', warp: 0, description: 'Estrella amarilla · rutas seguras' },
  RED:    { label: 'K', color: 0xff6b5e, css: '#ff6b5e', warp: 1, description: 'Enana roja · metales raros' },
  GREEN:  { label: 'E', color: 0x5ef2a1, css: '#5ef2a1', warp: 2, description: 'Estrella esmeralda · biología exótica' },
  BLUE:   { label: 'B', color: 0x6ec8ff, css: '#6ec8ff', warp: 3, description: 'Gigante azul · tecnología ancestral' },
};

export const ECONOMIES = ['Minería', 'Tecnología', 'Energía', 'Agricultura', 'Comercio', 'Investigación'];
const NAMES = ['Ae', 'Ori', 'Nyx', 'Kal', 'Ve', 'Zan', 'Tor', 'Ly', 'Ura', 'Xen', 'Hel', 'Rho', 'Cy', 'Aur', 'Mor', 'Ix', 'Vael', 'Sol', 'Nara', 'Ty', 'Oth', 'Quel', 'Eos', 'Dra', 'Ily', 'Vex', 'Nor', 'Tal', 'Zen', 'Oma', 'Ryn', 'Cae', 'Ul', 'Mira', 'Sable', 'Vey'];
const ENDINGS = ['ion', 'ara', 'eth', 'os', 'ys', 'um', 'ax', 'is', 'or', 'a', 'ei', 'un', 'ara', 'esh'];
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Sigma', 'Omega'];
const FAUNA_A = ['Ryl', 'Vex', 'Thal', 'Ora', 'Kesh', 'Uln', 'Tir', 'Nai', 'Quo', 'Sel'];
const FAUNA_B = ['ak', 'oth', 'eri', 'ux', 'ana', 'ide', 'ora', 'yn', 'esh'];

function buildName(rng, parts = 2) {
  let name = '';
  for (let i = 0; i < parts; i++) name += NAMES[rng.int(NAMES.length)];
  return name + ENDINGS[rng.int(ENDINGS.length)];
}

function toSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const GALAXY_SEED = 0x4e4d5321;

export class Universe {
  constructor(seed = GALAXY_SEED) {
    this.galaxySeed = seed >>> 0;
    this.systems = new Map();
    this.systemIndex = 0;
    this.planetIndex = 0;
    this.discovered = 0;
  }

  systemAt(index) {
    const i = Math.max(0, Math.floor(index));
    if (!this.systems.has(i)) this.systems.set(i, this.generateSystem(i));
    return this.systems.get(i);
  }

  currentSystem() { return this.systemAt(this.systemIndex); }
  currentPlanet() {
    const sys = this.currentSystem();
    return sys.planets[Math.min(this.planetIndex, sys.planets.length - 1)];
  }

  nearby(count = 9) {
    return Array.from({ length: count }, (_, i) => this.systemAt(this.systemIndex + i));
  }

  selectSystem(index) {
    this.systemIndex = Math.max(0, Math.floor(index));
    this.planetIndex = 0;
    return this.currentSystem();
  }

  selectPlanet(index) {
    const sys = this.currentSystem();
    this.planetIndex = Math.max(0, Math.min(index, sys.planets.length - 1));
    return this.currentPlanet();
  }

  generateSystem(index) {
    const rng = new Rng(BigInt((this.galaxySeed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0));
    const starKey = index === 0 ? 'YELLOW' : rng.pick(['YELLOW', 'YELLOW', 'YELLOW', 'RED', 'RED', 'GREEN', 'BLUE']);
    const starClass = STAR_CLASSES[starKey];
    const name = buildName(rng, 2);
    const economy = ECONOMIES[rng.int(ECONOMIES.length)];
    const wealth = 1 + rng.int(3);
    const conflict = 1 + rng.int(3);
    const count = 2 + rng.int(4);
    const biomeKeys = Object.keys(BIOMES);
    const planets = [];
    for (let p = 0; p < count; p++) {
      const biomeKey = (p === 0 && index === 0) ? 'LUSH' : rng.pick(biomeKeys);
      const biome = BIOMES[biomeKey];
      const hazard = HAZARDS[biome.hazard];
      const resources = rng.shuffle(biome.resources).slice(0, 3 + rng.int(2));
      const fauna = biomeKey === 'BARREN' ? rng.int(3) : 3 + rng.int(12);
      const faunaNames = Array.from({ length: Math.min(fauna, 4) }, () => FAUNA_A[rng.int(FAUNA_A.length)] + FAUNA_B[rng.int(FAUNA_B.length)]);
      planets.push({
        name: p === 0 ? name : `${name} ${GREEK[p % GREEK.length]}`,
        seed: (toSeed(name) ^ Math.imul(index + 11, 2654435761) ^ Math.imul(p + 7, 40503)) >>> 0,
        biomeKey, biome, hazard,
        weather: rng.pick(biome.weather),
        sentinelLevel: 1 + rng.int(3) + (biome.hazard === 'STORM' ? 1 : 0),
        flora: biomeKey === 'BARREN' ? rng.int(3) : 5 + rng.int(15),
        fauna, faunaNames, resources,
        radiusKm: 1800 + rng.int(9800),
        discovered: false,
      });
    }
    const stationPrefix = rng.pick(['Estación', 'Puesto', 'Anclaje', 'Nexo', 'Faro']);
    return {
      index, name, seed: (toSeed(name + index) ^ this.galaxySeed) >>> 0,
      starKey, starClass, economy, wealth, conflict, planets,
      stationName: `${stationPrefix} ${buildName(rng, 1)}`,
      distance: 0.12 + index * 0.037,
      wealthLabel: ['Pobre', 'Estable', 'Próspero'][wealth - 1],
      conflictLabel: ['Pacífico', 'Inestable', 'Guerra'][conflict - 1],
    };
  }
}
