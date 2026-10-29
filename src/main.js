import './style.css';
import { Game } from './game.js';

try {
  const game = new Game();
  window.__game = game;
} catch (error) {
  console.error(error);
  const app = document.getElementById('app');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:#05070d;color:#f5e9c8;font:12px/1.8 monospace;text-align:center;padding:30px';
  const msg = document.createElement('div');
  msg.innerHTML = '<h1 style="font:72px/1 sans-serif;margin:0 0 12px;color:#37f2d4">SEÑAL PERDIDA</h1><p>El renderizador no pudo iniciar. Comprueba que WebGL esté disponible.</p>';
  const pre = document.createElement('pre');
  pre.style.cssText = 'max-width:80vw;overflow:auto;color:#ff7b4d;font-size:10px';
  pre.textContent = String(error && error.stack ? error.stack : error);
  box.append(msg, pre);
  app.appendChild(box);
}
