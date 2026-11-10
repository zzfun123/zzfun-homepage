import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from './three/stage.js';

gsap.registerPlugin(ScrollTrigger);

// 1. 初始化 Lenis 丝滑滚动并与 GSAP ScrollTrigger 同步
const lenis = new Lenis({
  lerp: 0.09,
  smoothWheel: true,
  wheelMultiplier: 1.0,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// 导航平滑锚点跳转
document.querySelectorAll('[data-scroll-to]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const targetSelector = link.getAttribute('data-scroll-to');
    const targetEl = targetSelector ? document.querySelector(targetSelector) : null;
    if (targetEl) {
      e.preventDefault();
      lenis.scrollTo(targetEl, { offset: 0, duration: 1.25 });
    }
  });
});

// 2. 自定义弹簧光标
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

  document.querySelectorAll('[data-hover], #dragZone').forEach((el) => {
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

// 3. 启动 Three.js WebGL 舞台
const canvas = document.getElementById('gl');
const dragZone = document.getElementById('dragZone');

let stageReady = false;
let onStageReadyCallback = null;

const stage = createStage({
  canvas,
  dragZone,
  onHoverChange(isHover) {
    glHoverActive = isHover;
    syncCursorHover();
  },
  onReady() {
    stageReady = true;
    if (onStageReadyCallback) onStageReadyCallback();
  },
});

// 4. 预载器动画与揭幕
const preloaderEl = document.getElementById('preloader');
const preCountEl = document.getElementById('preCount');
const preBarEl = document.getElementById('preBar');

function runPreloader() {
  const progressObj = { val: 0 };

  const updatePreUI = () => {
    const v = Math.round(progressObj.val);
    if (preCountEl) preCountEl.textContent = String(v).padStart(2, '0');
    if (preBarEl) preBarEl.style.width = `${v}%`;
  };

  const tl = gsap.timeline();
  tl.to(progressObj, {
    val: 78,
    duration: 0.7,
    ease: 'power2.out',
    onUpdate: updatePreUI,
  });

  const finishPreloader = () => {
    gsap.to(progressObj, {
      val: 100,
      duration: 0.45,
      ease: 'power2.inOut',
      onUpdate: updatePreUI,
      onComplete() {
        gsap.to(preloaderEl, {
          yPercent: -100,
          duration: 0.85,
          ease: 'expo.inOut',
          onStart() {
            const heroSection = document.getElementById('hero');
            if (heroSection) heroSection.classList.add('in-view');
            stage.pulseCube(1.1);
            stage.triggerWaveAll();
          },
          onComplete() {
            if (preloaderEl) preloaderEl.style.display = 'none';
          },
        });
      },
    });
  };

  if (stageReady) {
    tl.call(finishPreloader);
  } else {
    onStageReadyCallback = () => {
      tl.call(finishPreloader);
    };
  }
}

runPreloader();

// 5. 章节入场揭示（3D 动效与巨字仅保留在第一屏 #hero，下滑时清爽不干扰内容）
['#hero', '#about', '#links', '#contact'].forEach((id) => {
  const el = document.querySelector(id);
  if (!el) return;

  ScrollTrigger.create({
    trigger: el,
    start: 'top 68%',
    onEnter() {
      el.classList.add('in-view');
    },
    onEnterBack() {
      el.classList.add('in-view');
    },
  });
});
