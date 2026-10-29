import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, makeGlowTexture, makePlanetTexture, makeRingTexture, mulberry32 } from './utils.js';

export class SpaceScene {
  constructor(renderer, world, seed = 7) {
    this.renderer = renderer;
    this.world = world;
    this.seed = seed;
    this.random = mulberry32(seed + 4409);
    this.active = false;
    this.warping = false;
    this.speed = 1.8;
    this.targetSpeed = 1.8;
    this.yaw = 0.16;
    this.pitch = -0.08;
    this.roll = 0;
    this.keys = new Set();
    this.touchSteer = new THREE.Vector2();
    this.touchThrust = false;
    this.touchBoost = false;
    this.glowTexture = makeGlowTexture(128);
    this.shipPosition = new THREE.Vector3(0, 0, 0);
    this.cameraPosition = new THREE.Vector3(0, 5, 24);
    this.cameraTarget = new THREE.Vector3();
    this.onWarp = null;
    this.time = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.copy(this.cameraPosition);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.72, 0.6, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.buildLights();
    this.buildStars();
    this.buildNebulae();
    this.buildPlanet();
    this.buildStation();
    this.buildShip();

    this.canvas = document.querySelector('#scene');
    this.canvas.addEventListener('mousedown', () => {
      if (this.active && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
    });
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0x93b7d6, 0.58));
    const sun = new THREE.DirectionalLight(0xffe1bd, 4.2);
    sun.position.set(420, 240, -320);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x5ecfe1, 1.1);
    fill.position.set(-300, -80, 220);
    this.scene.add(fill);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffdfb2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sunSprite.position.set(520, 280, -560);
    sunSprite.scale.setScalar(150);
    this.scene.add(sunSprite);
  }

  buildStars() {
    const count = 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const theta = this.random() * Math.PI * 2;
      const phi = Math.acos(2 * this.random() - 1);
      const radius = 460 + this.random() * 900;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      const tint = this.random();
      color.setHSL(tint > 0.82 ? 0.08 : tint > 0.64 ? 0.52 : 0.58, 0.35 + this.random() * 0.4, 0.6 + this.random() * 0.35);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.stars);

    const closeCount = 280;
    const closePositions = new Float32Array(closeCount * 3);
    for (let i = 0; i < closeCount; i += 1) {
      closePositions[i * 3] = (this.random() - 0.5) * 260;
      closePositions[i * 3 + 1] = (this.random() - 0.5) * 150;
      closePositions[i * 3 + 2] = -20 - this.random() * 330;
    }
    const closeGeo = new THREE.BufferGeometry();
    closeGeo.setAttribute('position', new THREE.BufferAttribute(closePositions, 3));
    this.nearStars = new THREE.Points(closeGeo, new THREE.PointsMaterial({
      color: 0xffe4c0,
      size: 0.85,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.nearStars);
  }

  buildNebulae() {
    const colors = [0x7251a8, 0x2b7f87, 0xb45248, 0x3c4d9a];
    for (let i = 0; i < 9; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: colors[Math.floor(this.random() * colors.length)],
        transparent: true,
        opacity: 0.06 + this.random() * 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const angle = this.random() * Math.PI * 2;
      const radius = 280 + this.random() * 400;
      sprite.position.set(Math.cos(angle) * radius, (this.random() - 0.5) * 240, Math.sin(angle) * radius - 180);
      sprite.scale.set(320 + this.random() * 420, 180 + this.random() * 260, 1);
      this.scene.add(sprite);
    }
  }

  buildPlanet() {
    const texture = makePlanetTexture(['#d9b990', '#b9785b', '#574e5b', '#152330'], 411);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(320, 72, 48),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0.02 }),
    );
    planet.position.set(30, -365, -360);
    planet.rotation.z = 0.24;
    this.scene.add(planet);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffa46d,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.copy(planet.position);
    glow.scale.setScalar(900);
    this.scene.add(glow);

    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { uMap: { value: makeRingTexture(77) } },
      vertexShader: /* glsl */ `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vLocal;
        uniform sampler2D uMap;
        void main() {
          float radius = length(vLocal.xy);
          float t = smoothstep(390.0, 420.0, radius) * (1.0 - smoothstep(620.0, 650.0, radius));
          vec4 map = texture2D(uMap, vec2((radius - 390.0) / 260.0, 0.5));
          gl_FragColor = vec4(map.rgb, map.a * t * 0.48);
        }
      `,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(390, 650, 180, 2), ringMaterial);
    ring.position.copy(planet.position);
    ring.rotation.x = 1.18;
    ring.rotation.z = 0.22;
    this.scene.add(ring);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshStandardMaterial({ map: makePlanetTexture(['#b6c3c2', '#7d8d8d', '#455458', '#1c282e'], 990), roughness: 1 }),
    );
    moon.position.set(-180, 110, -260);
    this.scene.add(moon);

    this.planet = planet;
    this.planetRing = ring;
  }

  buildStation() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x273136, roughness: 0.5, metalness: 0.7 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xc9bda4, emissive: 0x3b2d20, emissiveIntensity: 0.9, roughness: 0.55, metalness: 0.25 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xc75c30, emissive: 0xff6d35, emissiveIntensity: 1.4, roughness: 0.4 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x7ffff0, transparent: true, opacity: 0.9 });

    const torus = new THREE.Mesh(new THREE.TorusGeometry(23, 3.3, 10, 64), dark);
    torus.rotation.x = Math.PI / 2;
    group.add(torus);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(17, 0.8, 6, 64), cream);
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 11, 12), cream);
    group.add(hub);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.5, 6, 12), dark);
    cap.position.y = 8;
    group.add(cap);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 20, 6), dark);
    antenna.position.y = 15;
    group.add(antenna);
    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2;
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.5), windowMat);
      window.position.set(Math.cos(angle) * 23, Math.sin(angle) * 23, 0);
      window.rotation.z = angle;
      group.add(window);
    }
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.1, 2.8), cream);
      pod.position.set(Math.cos(angle) * 27, Math.sin(angle) * 27, 0);
      pod.rotation.z = angle;
      group.add(pod);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), orange);
      light.position.set(Math.cos(angle) * 30, Math.sin(angle) * 30, 0.4);
      group.add(light);
    }
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xff8f4a,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    beacon.position.y = 26;
    beacon.scale.setScalar(10);
    group.add(beacon);
    this.stationBeacon = beacon;

    const stationLight = new THREE.PointLight(0xffc78e, 900, 190, 2);
    stationLight.position.set(0, 0, 0);
    group.add(stationLight);

    group.position.set(-148, 38, -225);
    group.rotation.set(0.38, 0.7, 0.18);
    this.scene.add(group);
    this.station = group;
  }

  buildShip() {
    const group = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.45, metalness: 0.35 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xc85f31, roughness: 0.42, metalness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2a2f, roughness: 0.5, metalness: 0.65 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b3035, emissive: 0x35e7d0, emissiveIntensity: 2.4, roughness: 0.15, metalness: 0.8 });
    const engine = new THREE.MeshStandardMaterial({ color: 0xffbb6c, emissive: 0xff6a2c, emissiveIntensity: 5, roughness: 0.25 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 3.3, 4, 12), cream);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, 0);
    group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.8, 12), cream);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, -2.55);
    group.add(nose);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 3.2), dark);
    belly.position.set(0, -0.45, 0.25);
    group.add(belly);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(3.7, 0.8);
    wingShape.lineTo(4.25, 1.4);
    wingShape.lineTo(0.4, 1.65);
    wingShape.closePath();
    const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.13, bevelEnabled: false });
    wingGeometry.rotateX(Math.PI / 2);
    const wing = new THREE.Mesh(wingGeometry, cream);
    wing.position.set(0.35, 0.08, 0.25);
    group.add(wing);
    const wingR = wing.clone();
    wingR.scale.x = -1;
    wingR.position.x = -0.35;
    group.add(wingR);
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 1.1), orange);
      tip.position.set(side * 4.28, 0.42, 0.85);
      tip.rotation.z = side * -0.15;
      group.add(tip);
    }

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 9), glass);
    cockpit.scale.set(0.9, 0.52, 1.5);
    cockpit.position.set(0, 0.42, -0.7);
    group.add(cockpit);

    for (const x of [-0.72, 0.72]) {
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.42, 1.5, 10), dark);
      casing.rotation.x = Math.PI / 2;
      casing.position.set(x, -0.08, 2.15);
      group.add(casing);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), engine);
      disc.position.set(x, -0.08, 2.92);
      group.add(disc);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xff7335,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      halo.position.set(x, -0.08, 3.08);
      halo.scale.setScalar(2.4);
      group.add(halo);
      this.engineHalo = this.engineHalo || [];
      this.engineHalo.push(halo);
    }

    for (let i = 0; i < 5; i += 1) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0x8ffff1 }));
      light.position.set(-1.5 + i * 0.75, -0.05, 0.25);
      group.add(light);
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0x5ce7d2,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.scale.setScalar(6);
    group.add(glow);

    group.position.copy(this.shipPosition);
    group.scale.setScalar(1.3);
    this.scene.add(group);
    this.ship = group;
  }

  start() {
    this.active = true;
    this.speed = 1.8;
    this.targetSpeed = 1.8;
    this.yaw = 0.16;
    this.pitch = -0.08;
    this.shipPosition.set(0, 0, 0);
    this.cameraPosition.set(0, 5.5, 25);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(0, 0, -15);
    if (this.ship) {
      this.ship.position.copy(this.shipPosition);
      this.ship.rotation.set(this.pitch, this.yaw, 0);
    }
  }

  look(dx, dy) {
    if (!this.active) return;
    this.yaw -= dx * 0.0019;
    this.pitch = clamp(this.pitch - dy * 0.0019, -0.8, 0.72);
  }

  setTouchSteer(x, y) {
    this.touchSteer.set(x, y);
  }

  setWarping(value) {
    this.warping = value;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const steerX = this.touchSteer.x;
    const steerY = this.touchSteer.y;
    if (Math.abs(steerX) > 0.04) this.yaw -= steerX * dt * 1.15;
    if (Math.abs(steerY) > 0.04) {
      this.pitch = clamp(this.pitch - steerY * dt * 0.95, -0.8, 0.72);
    }
    const thrust = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touchThrust || this.touchBoost;
    const brake = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchBoost;
    const target = this.warping ? 38 : thrust ? (boost ? 18 : 9) : brake ? 0 : 2.4;
    this.targetSpeed = target;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 1.8);
    this.roll += ((this.keys.has('KeyA') ? 0.32 : 0) - (this.keys.has('KeyD') ? 0.32 : 0) - steerX * 0.26 - this.roll) * Math.min(1, dt * 2.5);

    const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
    this.shipPosition.addScaledVector(forward, this.speed * dt);
    this.ship.position.copy(this.shipPosition);
    this.ship.rotation.set(this.pitch, this.yaw, this.roll);

    const desiredCamera = this.shipPosition.clone()
      .addScaledVector(forward, -18)
      .add(new THREE.Vector3(0, 5.8, 0));
    this.cameraPosition.lerp(desiredCamera, Math.min(1, dt * 4.5));
    this.camera.position.copy(this.cameraPosition);
    this.cameraTarget.lerp(this.shipPosition.clone().addScaledVector(forward, 14), Math.min(1, dt * 5));
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov = 62 + (this.speed / 18) * 7;
    this.camera.updateProjectionMatrix();

    this.stars.rotation.y += dt * 0.0035;
    this.nearStars.position.z = ((this.nearStars.position.z + this.speed * dt * 2) % 160);
    this.planet.rotation.y += dt * 0.004;
    this.planetRing.rotation.z += dt * 0.002;
    this.station.rotation.y += dt * 0.025;
    this.stationBeacon.material.opacity = 0.55 + Math.sin(this.time * 2.4) * 0.25;
    if (this.engineHalo) {
      for (const halo of this.engineHalo) {
        halo.material.opacity = 0.5 + Math.min(0.4, this.speed * 0.03) + Math.sin(this.time * 9) * 0.06;
      }
    }
    this.ship.rotation.z = this.roll + Math.sin(this.time * 0.8) * 0.012;
    if (this.warping) {
      this.shipPosition.z -= dt * 15;
    }
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}
