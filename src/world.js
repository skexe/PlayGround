import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import {
  clamp,
  lerp,
  makeCloudTexture,
  makeGlowTexture,
  makeGlyphTexture,
  makePlanetTexture,
  makeRingTexture,
  mulberry32,
  smoothstep,
} from './utils.js';

const RESOURCE_DATA = {
  ferrita: { name: 'FERRITA', color: 0xff8a4c, glow: '#ff8a4c', amount: 6 },
  carbono: { name: 'CARBONO', color: 0xff6f4f, glow: '#ff6f4f', amount: 7 },
  sodio: { name: 'SODIO', color: 0xffdd7a, glow: '#ffdd7a', amount: 5 },
  oxigeno: { name: 'OXÍGENO', color: 0x6ffff0, glow: '#6ffff0', amount: 6 },
};

const TREE_COLORS = [0xff668d, 0xff8f4a, 0x6cf0c9, 0xb67cff, 0xffd27a];
const ROCK_COLORS = [0x4a2d2b, 0x5c3931, 0x392e2d, 0x6a4538];

function makeWingGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    2.2, 0, 0.7,
    0.6, 0, -0.6,
    0, 0, 0,
    -2.2, 0, 0.7,
    -0.6, 0, -0.6,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class World {
  constructor(scene, seed = 7) {
    this.scene = scene;
    this.seed = seed;
    this.random = mulberry32(seed * 7919 + 17);
    this.noiseA = createNoise2D(mulberry32(seed + 11));
    this.noiseB = createNoise2D(mulberry32(seed + 921));
    this.noiseC = createNoise2D(mulberry32(seed + 6301));
    this.elapsed = 0;
    this.interactables = [];
    this.nodes = [];
    this.scanned = new Set();
    this.clouds = [];
    this.birds = [];
    this.spores = null;
    this.glowTexture = makeGlowTexture(128);
    this.cloudTexture = makeCloudTexture(256);
    this.palette = {
      skyTop: new THREE.Color('#173d63'),
      skyHorizon: new THREE.Color('#f2a06d'),
      skyLow: new THREE.Color('#c86f56'),
      fog: new THREE.Color('#c78062'),
      sun: new THREE.Color('#ffd1a1'),
      low: new THREE.Color('#9a5237'),
      mid: new THREE.Color('#bc774a'),
      high: new THREE.Color('#d9b27d'),
      peak: new THREE.Color('#e9d5a9'),
      moss: new THREE.Color('#507c61'),
      rock: new THREE.Color('#4d3230'),
    };
    this.spawn = new THREE.Vector3(0, this.heightAt(0, 12), 12);
    this.shipPosition = new THREE.Vector3(7.5, this.heightAt(7.5, -8), -8);
    this.monolithPosition = new THREE.Vector3(-37, this.heightAt(-37, -39), -39);

    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildRocks();
    this.buildFlora();
    this.buildSpores();
    this.buildShip();
    this.buildMonolith();
    this.buildResources();
    this.buildBirds();
    this.buildClouds();
  }

  heightAt(x, z) {
    const n1 = this.noiseA(x * 0.0062, z * 0.0062);
    const n2 = this.noiseB(x * 0.018 + 42, z * 0.018 - 17);
    const n3 = this.noiseC(x * 0.048 - 8, z * 0.048 + 31);
    const ridge = 1 - Math.abs(this.noiseB(x * 0.011 + 90, z * 0.011 + 74));
    let h = n1 * 17 + n2 * 6.2 + n3 * 1.6 + Math.pow(ridge, 3.2) * 17;
    const distance = Math.hypot(x, z);
    const flat = smoothstep(23, 66, distance);
    h = lerp(0.15, h, flat);
    const basin = Math.exp(-Math.pow(distance / 58, 2)) * -2.1;
    return h + basin;
  }

  buildSky() {
    const uniforms = {
      uTop: { value: this.palette.skyTop },
      uHorizon: { value: this.palette.skyHorizon },
      uLow: { value: this.palette.skyLow },
      uSun: { value: this.palette.sun },
      uSunDir: { value: new THREE.Vector3(-0.46, 0.34, -0.82).normalize() },
    };
    const vertex = /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = normalize(world.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `;
    const fragment = /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uLow;
      uniform vec3 uSun;
      uniform vec3 uSunDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        v += noise(p) * 0.5;
        v += noise(p * 2.03) * 0.25;
        v += noise(p * 4.11) * 0.125;
        v += noise(p * 8.17) * 0.0625;
        return v;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float y = dir.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.72, y));
        col = mix(uLow, col, smoothstep(-0.48, 0.03, y));

        float sun = max(dot(dir, uSunDir), 0.0);
        col += uSun * pow(sun, 380.0) * 2.2;
        col += uSun * pow(sun, 12.0) * 0.13;
        col += uSun * pow(sun, 3.0) * 0.025;

        vec2 cloudUv = dir.xz / max(0.18, y + 0.2) * 1.45;
        float cloud = fbm(cloudUv * 1.25 + vec2(3.1, 8.7));
        cloud = smoothstep(0.54, 0.78, cloud) * smoothstep(0.0, 0.28, y) * 0.16;
        col = mix(col, uSun * 1.15, cloud);

        float band = sin((y + fbm(dir.xz * 3.0) * 0.035) * 130.0) * 0.5 + 0.5;
        col += vec3(0.015, 0.01, 0.008) * band * smoothstep(0.0, 0.5, y);

        col += (hash(gl_FragCoord.xy) - 0.5) * 0.008;
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(880, 48, 32),
      new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    sky.renderOrder = -10;
    this.scene.add(sky);

    this.scene.fog = new THREE.FogExp2(this.palette.fog, 0.0042);

    const planetTexture = makePlanetTexture(['#e8c9a8', '#c28b70', '#7f6670', '#293747'], 87);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(64, 48, 32),
      new THREE.MeshBasicMaterial({ map: planetTexture, fog: false }),
    );
    planet.position.set(178, 104, -306);
    planet.rotation.z = 0.28;
    this.scene.add(planet);

    const atmosphere = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffc59b,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    atmosphere.position.copy(planet.position);
    atmosphere.scale.setScalar(192);
    this.scene.add(atmosphere);

    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      uniforms: { uMap: { value: makeRingTexture(13) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vLocal;
        void main() {
          vUv = uv;
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vLocal;
        uniform sampler2D uMap;
        void main() {
          float radius = length(vLocal.xy);
          float t = smoothstep(84.0, 94.0, radius) * (1.0 - smoothstep(132.0, 142.0, radius));
          vec4 map = texture2D(uMap, vec2((radius - 84.0) / 58.0, 0.5));
          gl_FragColor = vec4(map.rgb, map.a * t * 0.72);
        }
      `,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(84, 142, 160, 2), ringMaterial);
    ring.position.copy(planet.position);
    ring.rotation.x = 1.14;
    ring.rotation.z = 0.34;
    this.scene.add(ring);
    this.ring = ring;

    const moonTexture = makePlanetTexture(['#b8c6c3', '#81908f', '#4d5b5f', '#202b31'], 301);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(17, 24, 16), new THREE.MeshBasicMaterial({ map: moonTexture, fog: false }));
    moon.position.set(-266, 168, -410);
    this.scene.add(moon);

    const farMoon = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc7b49b, fog: false }));
    farMoon.position.set(-120, 240, -340);
    this.scene.add(farMoon);

    this.planet = planet;
    this.sky = sky;
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x9ecfff, 0x9a4a2d, 1.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.55);
    sun.position.set(-95, 130, -170);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 310;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    sun.target.position.set(0, 0, -10);
    const rim = new THREE.DirectionalLight(0x5de2d0, 0.45);
    rim.position.set(90, 35, 120);
    this.scene.add(rim);
    this.sun = sun;
  }

  buildTerrain() {
    const size = 430;
    const segments = 220;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = this.heightAt(x, z);
      position.setY(i, y);
      colors.push(0, 0, 0);
    }
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = position.getY(i);
      const slope = normals.getY(i);
      const variation = this.noiseC(x * 0.06, z * 0.06) * 0.5 + 0.5;
      const moss = this.noiseB(x * 0.026 + 19, z * 0.026 - 7);
      const t = clamp((y + 5) / 42, 0, 1);
      if (slope < 0.69) {
        color.copy(this.palette.rock).lerp(this.palette.mid, clamp((slope - 0.38) / 0.31, 0, 1) * 0.32);
      } else {
        color.copy(this.palette.low).lerp(this.palette.mid, smoothstep(0.02, 0.42, t));
        color.lerp(this.palette.high, smoothstep(0.4, 0.82, t));
        color.lerp(this.palette.peak, smoothstep(0.76, 1, t));
        if (moss > 0.24) color.lerp(this.palette.moss, clamp((moss - 0.24) * 1.3, 0, 0.65));
      }
      color.multiplyScalar(0.82 + variation * 0.3);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.01,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.terrain = terrain;
  }

  buildRocks() {
    const count = 170;
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.04, color: 0xffffff, flatShading: true });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      let x;
      let z;
      do {
        x = (this.random() - 0.5) * 330;
        z = (this.random() - 0.5) * 330;
      } while (Math.hypot(x, z) < 23);
      const y = this.heightAt(x, z);
      const scale = 0.5 + Math.pow(this.random(), 2.4) * 4.6;
      dummy.position.set(x, y + scale * 0.25, z);
      dummy.rotation.set(this.random() * 2, this.random() * 6, this.random() * 2);
      dummy.scale.set(scale * (0.7 + this.random() * 0.7), scale * (0.45 + this.random() * 0.7), scale * (0.7 + this.random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(ROCK_COLORS[Math.floor(this.random() * ROCK_COLORS.length)]);
      color.multiplyScalar(0.75 + this.random() * 0.4);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.rocks = mesh;

    const pebbleCount = 340;
    const pebbleGeometry = new THREE.DodecahedronGeometry(0.16, 0);
    const pebbleMaterial = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0.03, color: 0xffffff, flatShading: true });
    const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, pebbleCount);
    for (let i = 0; i < pebbleCount; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 3 + Math.sqrt(this.random()) * 52;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.heightAt(x, z);
      const scale = 0.3 + Math.pow(this.random(), 2) * 1.4;
      dummy.position.set(x, y + scale * 0.08, z);
      dummy.rotation.set(this.random() * 3, this.random() * 6, this.random() * 3);
      dummy.scale.set(scale, scale * 0.55, scale);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      color.setHex(ROCK_COLORS[Math.floor(this.random() * ROCK_COLORS.length)]).multiplyScalar(0.62 + this.random() * 0.35);
      pebbles.setColorAt(i, color);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.instanceColor.needsUpdate = true;
    this.scene.add(pebbles);
  }

  buildFlora() {
    const treeCount = 88;
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.38, 1, 5);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
    const canopyGeometry = new THREE.IcosahedronGeometry(1, 1);
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, emissive: 0x130b0d, emissiveIntensity: 0.7, flatShading: true });
    const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount * 2);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let canopyIndex = 0;
    for (let i = 0; i < treeCount; i += 1) {
      let x;
      let z;
      do {
        x = (this.random() - 0.5) * 300;
        z = (this.random() - 0.5) * 300;
      } while (Math.hypot(x, z) < 20 || Math.hypot(x - this.shipPosition.x, z - this.shipPosition.z) < 13);
      const y = this.heightAt(x, z);
      const height = 3 + this.random() * 7;
      const lean = (this.random() - 0.5) * 0.16;
      dummy.position.set(x, y + height / 2, z);
      dummy.rotation.set(lean, this.random() * Math.PI * 2, lean * 0.6);
      dummy.scale.set(1 + this.random() * 0.8, height, 1 + this.random() * 0.8);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      color.setHex(0x5b3b30).multiplyScalar(0.7 + this.random() * 0.4);
      trunks.setColorAt(i, color);

      const canopyColor = new THREE.Color(TREE_COLORS[Math.floor(this.random() * TREE_COLORS.length)]);
      for (let c = 0; c < 2; c += 1) {
        const spread = c === 0 ? 1 : 0.56;
        dummy.position.set(x + (this.random() - 0.5) * 1.2 * spread, y + height + (c === 0 ? 0 : 1.15), z + (this.random() - 0.5) * 1.2 * spread);
        dummy.rotation.set(this.random() * 0.5, this.random() * 6, this.random() * 0.5);
        dummy.scale.set((2 + this.random() * 1.6) * spread, (0.8 + this.random() * 0.7) * spread, (2 + this.random() * 1.6) * spread);
        dummy.updateMatrix();
        canopies.setMatrixAt(canopyIndex, dummy.matrix);
        canopies.setColorAt(canopyIndex, canopyColor.clone().multiplyScalar(c === 0 ? 1 : 0.85));
        canopyIndex += 1;
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    trunks.instanceColor.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    canopies.instanceColor.needsUpdate = true;
    trunks.castShadow = true;
    canopies.castShadow = true;
    this.scene.add(trunks, canopies);
    this.trees = [trunks, canopies];

    const grassCount = 2100;
    const grassGeometry = new THREE.ConeGeometry(0.12, 1, 3);
    grassGeometry.translate(0, 0.5, 0);
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0x0c1f1b, emissiveIntensity: 0.6 });
    const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
    for (let i = 0; i < grassCount; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 4 + Math.sqrt(this.random()) * 92;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.heightAt(x, z);
      const scale = 0.3 + this.random() * 0.75;
      dummy.position.set(x, y, z);
      dummy.rotation.set((this.random() - 0.5) * 0.3, this.random() * 6, (this.random() - 0.5) * 0.3);
      dummy.scale.set(scale, scale * (0.8 + this.random() * 0.9), scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(this.random() > 0.35 ? 0xb86b45 : 0x5c9a78).multiplyScalar(0.55 + this.random() * 0.6);
      grass.setColorAt(i, c);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.instanceColor.needsUpdate = true;
    this.scene.add(grass);
    this.grass = grass;
  }

  buildSpores() {
    const count = 650;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (this.random() - 0.5) * 150;
      positions[i * 3 + 1] = this.random() * 28 + 0.5;
      positions[i * 3 + 2] = (this.random() - 0.5) * 150;
      speeds[i] = 0.15 + this.random() * 0.55;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffd6a0,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.userData.speeds = speeds;
    this.scene.add(points);
    this.spores = points;

    const glowCount = 28;
    const glowGroup = new THREE.Group();
    for (let i = 0; i < glowCount; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: this.random() > 0.5 ? 0xffbd74 : 0x6cf0c9,
        transparent: true,
        opacity: 0.18 + this.random() * 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      sprite.position.set((this.random() - 0.5) * 90, 1 + this.random() * 15, (this.random() - 0.5) * 90);
      sprite.scale.setScalar(0.8 + this.random() * 2.5);
      glowGroup.add(sprite);
    }
    this.scene.add(glowGroup);
    this.sporeGlows = glowGroup;
  }

  buildShip() {
    const ship = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.58, metalness: 0.18 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xc65e31, roughness: 0.52, metalness: 0.22 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x263338, roughness: 0.65, metalness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x092c31, emissive: 0x39e8d2, emissiveIntensity: 1.4, roughness: 0.12, metalness: 0.65 });
    const engine = new THREE.MeshStandardMaterial({ color: 0xffb15d, emissive: 0xff6d2d, emissiveIntensity: 2.4, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.9, 4, 10), cream);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 1.2, 0);
    body.castShadow = true;
    ship.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.6, 10), cream);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 1.2, -2.3);
    nose.castShadow = true;
    ship.add(nose);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.5), orange);
    spine.position.set(0, 1.68, 0.3);
    ship.add(spine);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(3.1, 0.7);
    wingShape.lineTo(3.7, 1.25);
    wingShape.lineTo(0.35, 1.35);
    wingShape.closePath();
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: false });
    wingGeometry.rotateX(Math.PI / 2);
    const wingLeft = new THREE.Mesh(wingGeometry, cream);
    wingLeft.position.set(0.35, 1.28, 0.4);
    wingLeft.rotation.y = 0;
    wingLeft.castShadow = true;
    ship.add(wingLeft);
    const wingRight = wingLeft.clone();
    wingRight.scale.x = -1;
    wingRight.position.x = -0.35;
    ship.add(wingRight);

    const wingTipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 1.05), orange);
    wingTipLeft.position.set(3.72, 1.6, 0.9);
    wingTipLeft.rotation.z = -0.12;
    ship.add(wingTipLeft);
    const wingTipRight = wingTipLeft.clone();
    wingTipRight.position.x = -3.72;
    wingTipRight.rotation.z = 0.12;
    ship.add(wingTipRight);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 8), glass);
    cockpit.scale.set(0.9, 0.58, 1.45);
    cockpit.position.set(0, 1.65, -0.72);
    ship.add(cockpit);

    for (const x of [-0.7, 0.7]) {
      const engineCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.3, 8), dark);
      engineCasing.rotation.x = Math.PI / 2;
      engineCasing.position.set(x, 1.13, 1.85);
      ship.add(engineCasing);
      const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(0.31, 12), engine);
      engineGlow.position.set(x, 1.13, 2.51);
      ship.add(engineGlow);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xff7a36,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      halo.position.set(x, 1.13, 2.65);
      halo.scale.setScalar(0.92);
      ship.add(halo);
    }

    for (const [x, z] of [[-1.1, -0.9], [1.1, -0.9], [0, 1.2]]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 5), dark);
      strut.position.set(x, 0.35, z);
      strut.rotation.z = x * 0.18;
      ship.add(strut);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 8), orange);
      foot.position.set(x, -0.28, z);
      ship.add(foot);
    }

    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffb15d,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    beacon.position.set(0, 3.3, 0);
    beacon.scale.setScalar(1.2);
    ship.add(beacon);
    this.shipBeacon = beacon;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.12, 18, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff9a58, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.set(0, 9, 0);
    ship.add(beam);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x2a3332, roughness: 0.86, metalness: 0.3, transparent: true, opacity: 0.9 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(this.shipPosition.x, this.shipPosition.y + 0.08, this.shipPosition.z);
    this.scene.add(pad);
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(6.4, 6.6, 64),
      new THREE.MeshBasicMaterial({ color: 0xff8f4c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.copy(pad.position).y += 0.03;
    this.scene.add(padRing);
    for (let i = 0; i < 6; i += 1) {
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 1.4),
        new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      mark.rotation.x = -Math.PI / 2;
      const angle = (i / 6) * Math.PI * 2;
      mark.position.set(this.shipPosition.x + Math.cos(angle) * 4.8, pad.position.y + 0.04, this.shipPosition.z + Math.sin(angle) * 4.8);
      mark.rotation.z = -angle;
      this.scene.add(mark);
    }

    const shipLight = new THREE.PointLight(0xffc58f, 18, 22, 2);
    shipLight.position.set(0, 5.5, 1.5);
    ship.add(shipLight);

    ship.position.copy(this.shipPosition);
    ship.rotation.y = -0.52;
    ship.rotation.z = 0.035;
    ship.scale.setScalar(1.28);
    this.scene.add(ship);
    this.ship = ship;
    this.engineHalos = [];
    ship.traverse((child) => {
      if (child.isSprite && child.material.color.getHex() === 0xff7a36) this.engineHalos.push(child);
    });
  }

  buildMonolith() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x171e20, roughness: 0.72, metalness: 0.28 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 9.5, 0.85), stone);
    slab.position.y = 4.75;
    slab.rotation.z = -0.035;
    slab.castShadow = true;
    group.add(slab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 1.2), stone);
    cap.position.y = 9.55;
    group.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.4, 0.6, 6), stone);
    base.position.y = 0.3;
    group.add(base);
    const glyphs = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 6.4),
      new THREE.MeshBasicMaterial({ map: makeGlyphTexture(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    glyphs.position.set(0, 5.2, 0.46);
    group.add(glyphs);
    this.monolithGlyphs = glyphs;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xff7a36,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(0, 5, 0.6);
    glow.scale.setScalar(8);
    group.add(glow);
    group.position.copy(this.monolithPosition);
    group.rotation.y = 0.4;
    this.scene.add(group);
    this.monolith = group;
  }

  buildResources() {
    const near = [
      ['ferrita', -11, -14], ['ferrita', 14, -19], ['ferrita', -22, 9], ['ferrita', 22, 15], ['ferrita', -17, -28],
      ['carbono', 4, -28], ['carbono', -14, 25], ['carbono', 30, -5], ['carbono', -31, -7], ['carbono', 12, 31],
      ['sodio', -7, -34], ['sodio', 27, 20], ['sodio', -33, 18],
      ['oxigeno', 7, 19], ['oxigeno', -20, 31], ['oxigeno', 17, -31],
      ['sodio', 1, -11], ['oxigeno', -6, -5],
    ];
    for (const [type, x, z] of near) this.addResource(type, x, z, true);
    const types = ['ferrita', 'carbono', 'sodio', 'oxigeno'];
    for (let i = 0; i < 42; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 38 + Math.sqrt(this.random()) * 118;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      this.addResource(types[Math.floor(this.random() * types.length)], x, z, false);
    }
  }

  addResource(type, x, z, nearSpawn) {
    const info = RESOURCE_DATA[type];
    const group = new THREE.Group();
    const ground = this.heightAt(x, z);
    group.position.set(x, ground, z);
    group.rotation.y = this.random() * Math.PI * 2;

    const glowColor = new THREE.Color(info.color);
    if (type === 'ferrita') {
      const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x714331, emissive: 0x2a0f07, emissiveIntensity: 0.8, roughness: 0.82, metalness: 0.22, flatShading: true });
      const shardMaterial = new THREE.MeshStandardMaterial({ color: 0xb35a37, emissive: 0xff6f32, emissiveIntensity: 1.1, roughness: 0.4 });
      for (let i = 0; i < 4; i += 1) {
        const size = 0.55 + this.random() * 0.75;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMaterial);
        rock.position.set((this.random() - 0.5) * 1.2, size * 0.55, (this.random() - 0.5) * 1.2);
        rock.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3);
        group.add(rock);
      }
      for (let i = 0; i < 4; i += 1) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.65, 4), shardMaterial);
        shard.position.set((this.random() - 0.5) * 1.1, 0.7 + this.random() * 0.3, (this.random() - 0.5) * 1.1);
        shard.rotation.set((this.random() - 0.5) * 1.1, this.random() * 3, (this.random() - 0.5) * 1.1);
        group.add(shard);
      }
    } else if (type === 'carbono') {
      const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5a332d, roughness: 0.8 });
      const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xe06a4c, emissive: 0xff5f34, emissiveIntensity: 1.05, roughness: 0.5 });
      for (let i = 0; i < 5; i += 1) {
        const height = 1.1 + this.random() * 1.9;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, height, 4), stemMaterial);
        stem.position.set((this.random() - 0.5) * 1.1, height / 2, (this.random() - 0.5) * 1.1);
        stem.rotation.z = (this.random() - 0.5) * 0.35;
        group.add(stem);
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + this.random() * 0.13, 1), bulbMaterial);
        bulb.position.copy(stem.position);
        bulb.position.y += height / 2;
        group.add(bulb);
      }
    } else if (type === 'sodio') {
      const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0xd7a63f, emissive: 0xffc13b, emissiveIntensity: 1.0, roughness: 0.28, metalness: 0.3, flatShading: true });
      for (let i = 0; i < 5; i += 1) {
        const height = 0.8 + this.random() * 1.7;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24 + this.random() * 0.2, 0), crystalMaterial);
        crystal.scale.y = height / 0.4;
        crystal.position.set((this.random() - 0.5) * 1.1, height * 0.45, (this.random() - 0.5) * 1.1);
        crystal.rotation.set((this.random() - 0.5) * 0.4, this.random() * 3, (this.random() - 0.5) * 0.4);
        group.add(crystal);
      }
    } else {
      const stalkMaterial = new THREE.MeshStandardMaterial({ color: 0x225b55, roughness: 0.7 });
      const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0x60f0df, emissive: 0x42ffe4, emissiveIntensity: 1.2, roughness: 0.4 });
      for (let i = 0; i < 4; i += 1) {
        const height = 0.8 + this.random() * 1.4;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, height, 4), stalkMaterial);
        stalk.position.set((this.random() - 0.5) * 1, height / 2, (this.random() - 0.5) * 1);
        stalk.rotation.z = (this.random() - 0.5) * 0.45;
        group.add(stalk);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.23 + this.random() * 0.15, 10, 8), bulbMaterial);
        bulb.position.copy(stalk.position);
        bulb.position.y += height / 2;
        group.add(bulb);
      }
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.3, 36),
      new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: info.color,
      transparent: true,
      opacity: nearSpawn ? 0.28 : 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.y = 1.3;
    glow.scale.setScalar(nearSpawn ? 3.6 : 3.1);
    group.add(glow);

    const node = {
      type,
      name: info.name,
      group,
      ring,
      glow,
      health: 100,
      maxHealth: 100,
      amount: info.amount,
      nearSpawn,
      depleted: false,
      scanned: false,
      position: new THREE.Vector3(x, ground, z),
      baseGlowScale: glow.scale.x,
    };
    group.userData.node = node;
    group.traverse((child) => {
      if (child.isMesh) child.userData.node = node;
    });
    this.scene.add(group);
    this.nodes.push(node);
    group.children.filter((c) => c.isMesh).forEach((mesh) => this.interactables.push(mesh));
  }

  buildBirds() {
    const wingGeometry = makeWingGeometry();
    const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xffb36a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 5; i += 1) {
      const group = new THREE.Group();
      const left = new THREE.Mesh(wingGeometry, wingMaterial);
      const right = new THREE.Mesh(wingGeometry, wingMaterial);
      right.scale.x = -1;
      group.add(left, right);
      group.scale.setScalar(0.7 + this.random() * 0.7);
      group.userData = {
        radius: 30 + this.random() * 55,
        height: 19 + this.random() * 25,
        speed: 0.035 + this.random() * 0.05,
        phase: this.random() * Math.PI * 2,
        flap: 0.5 + this.random() * 0.6,
        left,
        right,
      };
      this.scene.add(group);
      this.birds.push(group);
    }
  }

  buildClouds() {
    for (let i = 0; i < 11; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.cloudTexture,
        color: 0xffd5b1,
        transparent: true,
        opacity: 0.25 + this.random() * 0.2,
        depthWrite: false,
        fog: false,
      }));
      const angle = this.random() * Math.PI * 2;
      const radius = 100 + this.random() * 240;
      sprite.position.set(Math.cos(angle) * radius, 42 + this.random() * 58, Math.sin(angle) * radius);
      sprite.scale.set(48 + this.random() * 90, 14 + this.random() * 30, 1);
      this.scene.add(sprite);
      this.clouds.push(sprite);
    }
  }

  scan(origin, radius = 62) {
    const found = [];
    for (const node of this.nodes) {
      if (node.depleted) continue;
      const distance = node.position.distanceTo(origin);
      if (distance < radius) {
        node.scanned = true;
        node.glow.material.opacity = 0.95;
        node.glow.scale.setScalar(node.baseGlowScale * 1.75);
        node.scanUntil = this.elapsed + 8;
        found.push(node);
      }
    }
    return found;
  }

  update(dt, playerPosition) {
    this.elapsed += dt;
    const t = this.elapsed;
    this.ring.rotation.z += dt * 0.006;
    this.planet.rotation.y += dt * 0.0025;

    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.9;
      if (cloud.position.x > 340) cloud.position.x = -340;
    }

    if (this.spores) {
      const positions = this.spores.geometry.attributes.position;
      const speeds = this.spores.userData.speeds;
      for (let i = 0; i < positions.count; i += 1) {
        let y = positions.getY(i) + speeds[i] * dt;
        let x = positions.getX(i) + Math.sin(t * 0.35 + i) * dt * 0.08;
        if (y > 30) y = 0.4;
        if (x > 76) x = -76;
        positions.setY(i, y);
        positions.setX(i, x);
      }
      positions.needsUpdate = true;
    }

    for (const bird of this.birds) {
      const data = bird.userData;
      const angle = t * data.speed + data.phase;
      bird.position.set(Math.cos(angle) * data.radius, data.height + Math.sin(t * 0.5 + data.phase) * 2.2, Math.sin(angle) * data.radius - 10);
      bird.rotation.y = -angle + Math.PI / 2;
      bird.rotation.z = Math.sin(angle) * 0.1;
      const flap = Math.sin(t * data.flap * 5 + data.phase) * 0.55;
      data.left.rotation.z = flap;
      data.right.rotation.z = -flap;
    }

    if (this.shipBeacon) {
      const pulse = 0.6 + Math.sin(t * 2.6) * 0.22;
      this.shipBeacon.material.opacity = pulse;
      this.shipBeacon.scale.setScalar(1.05 + pulse * 0.35);
    }
    for (let i = 0; i < this.engineHalos.length; i += 1) {
      this.engineHalos[i].material.opacity = 0.48 + Math.sin(t * 3.2 + i) * 0.13;
    }
    if (this.monolithGlyphs) {
      this.monolithGlyphs.material.opacity = 0.66 + Math.sin(t * 1.8) * 0.22;
    }

    for (const node of this.nodes) {
      if (node.depleted) continue;
      const pulse = 0.28 + Math.sin(t * 2 + node.position.x) * 0.07;
      if (!node.scanUntil || this.elapsed > node.scanUntil) {
        node.glow.material.opacity = pulse;
        node.glow.scale.setScalar(node.baseGlowScale);
        node.scanned = false;
      }
      node.ring.material.opacity = 0.18 + Math.sin(t * 1.7 + node.position.z) * 0.08;
    }

    if (this.sporeGlows) {
      this.sporeGlows.children.forEach((sprite, index) => {
        sprite.position.y += dt * (0.12 + (index % 5) * 0.03);
        if (sprite.position.y > 18) sprite.position.y = 0.5;
      });
    }
    if (playerPosition) {
      this.sun.position.x = playerPosition.x - 95;
      this.sun.position.z = playerPosition.z - 170;
      this.sun.target.position.set(playerPosition.x, 0, playerPosition.z);
    }
  }
}
