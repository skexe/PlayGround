# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/skexe/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/skexe/PlayGround)

- 🎮 [Open the project](https://omgithub.com/skexe/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=skexe%2FPlayGround).
- 💻 [Explore the source](https://github.com/skexe/PlayGround).
- 🛠️ [Check build runs](https://github.com/skexe/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/skexe/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/skexe).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## Fractured Skies

Prototipo fan de exploración espacial procedural inspirado en el GDD de **No Man's Sky**. Incluye dos frentes:

- **Android nativo en Kotlin**: motor 2D/3D por software sobre `SurfaceView` + `Canvas`, sin AndroidX ni assets externos.
- **Demo web Three.js**: misma semilla, universo y bucle de juego, pensada para previsualización rápida en navegador.

No utiliza recursos oficiales de No Man's Sky. Es una demo técnica independiente.

## Jugabilidad implementada

- Universo determinista con sistemas estelares, clases de estrella, economías, conflictos y planetas.
- Planetas con biomas, clima, peligro ambiental, flora, fauna, recursos y centinelas.
- Exploración en primera persona, escaneo de ecosistema, minería de vetas, combate y jetpack.
- Inventario, fabricación, comercio, mejoras de traje/herramienta, combustible y células de deformación.
- Despegue, órbita, estación espacial, mapa galáctico, hipersalto y llegada a nuevos sistemas.
- HUD diegético, brújula, radar, objetivos, guardado local y persistencia de expedición.

## Web

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # genera dist/
npm run preview
```

Controles de escritorio: `WASD` mover, arrastrar ratón mirar, `E` escanear, mantener clic minar, `Espacio` jetpack, `F` disparar, `I` inventario, `C` fabricar, `Q` códice, `M` mapa, `Esc` pausa.

En móvil se activan joystick y botones táctiles. El lienzo admite arrastre para mirar.

Archivos principales:

- `index.html`: estructura de la interfaz.
- `src/main.js`: arranque y manejo de errores WebGL.
- `src/game.js`: estados, controles, supervivencia, combate, guardado y viaje.
- `src/world.js`: terreno, cielo, vegetación, recursos, nave, centinelas y efectos.
- `src/universe.js`: generación procedural y configuración de biomas/recursos.
- `src/ui.js`: HUD, radar, brújula, inventario, crafteo, códice, mapa y estación.
- `src/noise.js`, `src/recipes.js`: ruido determinista y recetas.

## Android

Requisitos: JDK 17 y Android SDK con `compileSdk 36`.

```bash
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

APK de depuración: `app/build/outputs/apk/debug/app-debug.apk`.

La app se abre en horizontal, a pantalla completa. El control izquierdo mueve, el derecho mira, y los botones inferiores ejecutan escanear, minar, jetpack, disparar e inventario. El progreso se guarda en `SharedPreferences`; desde la demo web se guarda en `localStorage`.

Código nativo principal:

- `app/src/main/java/com/omgithub/fracturedskies/Game.kt`: bucle y reglas.
- `.../GameRenderer.kt`: render y todas las pantallas.
- `.../SurfaceWorld.kt`: simulación planetaria.
- `.../Universe.kt`, `.../Noise.kt`, `.../Player.kt`: generación, ruido e inventario.
- `.../DrawKit.kt`, `.../GameView.kt`, `.../MainActivity.kt`: UI Canvas, entrada y actividad.

## Notas y límites

- Es un prototipo: no incluye multijugador, audio, misiones narrativas largas ni el contenido completo del GDD.
- La versión Android compila y genera APK, pero no se ha validado visualmente en un emulador/dispositivo dentro de este entorno.
- La demo web usa `three@0.180.0` y `vite@7.1.12`.
- El guardado web es local; borrar los datos del navegador reinicia la expedición.
