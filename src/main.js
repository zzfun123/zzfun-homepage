import './style.css';
import gsap from 'gsap';
import { createStage } from './three/stage.js';

// 1. 自定义弹簧光标
const cursorEl = document.getElementById('cursor');
let domHoverCount = 0;
let glHoverActive = false;

function syncCursorHover() {
  if (!cursorEl) return;
  cursorEl.classList.toggle('is-hover', domHoverCount > 0 || glHoverActive);
}

if (cursorEl) {
  const cursorPos = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  const targetPos = { x: cursorPos.x, y: cursorPos.y };

  window.addEventListener(
    'pointermove',
    (e) => {
      targetPos.x = e.clientX;
      targetPos.y = e.clientY;
    },
    { passive: true }
  );

  gsap.ticker.add(() => {
    cursorPos.x += (targetPos.x - cursorPos.x) * 0.28;
    cursorPos.y += (targetPos.y - cursorPos.y) * 0.28;
    cursorEl.style.setProperty('--cx', `${cursorPos.x.toFixed(1)}px`);
    cursorEl.style.setProperty('--cy', `${cursorPos.y.toFixed(1)}px`);
  });

  window.addEventListener('pointerdown', () => cursorEl.classList.add('is-down'));
  window.addEventListener('pointerup', () => cursorEl.classList.remove('is-down'));

  document.querySelectorAll('[data-hover]').forEach((el) => {
    el.addEventListener('pointerenter', () => {
      domHoverCount++;
      syncCursorHover();
    });
    el.addEventListener('pointerleave', () => {
      domHoverCount = Math.max(0, domHoverCount - 1);
      syncCursorHover();
    });
  });
}

// 2. 启动画廊级单颗 3D 西红柿 WebGL 舞台
const canvas = document.getElementById('gl');
const dragZone = document.getElementById('dragZone');

createStage({
  canvas,
  dragZone,
  onHoverChange(isHover) {
    glHoverActive = isHover;
    syncCursorHover();
  },
});
