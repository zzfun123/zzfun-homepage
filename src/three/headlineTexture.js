import * as THREE from 'three';

/**
 * 巨型标题透明层纹理：仅在第一屏 (#hero) 显示 "ZZFUN."，
 * 随鼠标向下滚动自然上移并淡出，绝不干扰下方章节阅读。
 */
export function createHeadlineTexture() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const state = {
    word: 'ZZFUN',
    sub: '— A PLAYGROUND BY ZZFUN —',
    shiftX: 0,
    shiftY: 0,
    heroScroll: 0, // 0 = 在第一屏顶部，1 = 第一屏已完全滚出视口
  };

  function draw() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, Math.round(W * dpr));
    const ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 滚出第一屏后不再绘制任何背景大字
    const fade = Math.max(0, 1 - state.heroScroll * 1.45);
    if (fade <= 0.005) {
      texture.needsUpdate = true;
      return;
    }

    const mobile = W < 768;
    const cx = W * 0.5 + state.shiftX * 12;
    // 随第一屏向上滚动同步上移
    const cy = H * (mobile ? 0.4 : 0.44) + state.shiftY * 8 - state.heroScroll * H * 0.95;

    let fs = Math.min(H * 0.26, W * (mobile ? 0.3 : 0.19));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${fs}px "Space Grotesk", sans-serif`;
    const maxW = W * (mobile ? 0.86 : 0.64);
    const wordWidth = ctx.measureText(state.word).width;
    if (wordWidth > maxW && wordWidth > 0) {
      fs *= maxW / wordWidth;
      ctx.font = `700 ${fs}px "Space Grotesk", sans-serif`;
    }

    const cap = fs * 0.7;
    const baseline = cy + cap / 2;
    const measuredW = ctx.measureText(state.word).width;

    ctx.save();
    ctx.globalAlpha = fade;

    // 柠檬黄硬阴影
    ctx.fillStyle = '#FFC940';
    ctx.fillText(state.word, cx + fs * 0.038, baseline + fs * 0.048);

    // 晴空蓝主体
    ctx.fillStyle = '#0E7FD8';
    ctx.fillText(state.word, cx, baseline);

    // 丝带红句点
    ctx.fillStyle = '#FF6154';
    const dotX = cx + measuredW / 2 + fs * 0.11;
    const dotY = baseline - fs * 0.045;
    const dotR = Math.max(5, fs * 0.048);
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 巨字下方小注
    ctx.save();
    ctx.globalAlpha = 0.68 * fade;
    ctx.fillStyle = '#0C3B66';
    ctx.font = `500 ${Math.max(11, Math.min(14, W * 0.011))}px "JetBrains Mono", monospace`;
    ctx.fillText(state.sub, cx, baseline + fs * 0.32);
    ctx.restore();

    texture.needsUpdate = true;
  }

  function setMotion(nx, ny, heroScroll) {
    const changed =
      Math.abs(state.shiftX - nx) > 0.002 ||
      Math.abs(state.shiftY - ny) > 0.002 ||
      Math.abs(state.heroScroll - heroScroll) > 0.001;
    state.shiftX = nx;
    state.shiftY = ny;
    state.heroScroll = heroScroll;
    if (changed) draw();
  }

  draw();
  window.addEventListener('resize', draw);
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', draw);
    document.fonts.ready.then(draw);
  }

  return { texture, setMotion, redraw: draw };
}
