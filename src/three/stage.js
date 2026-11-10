import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import gsap from 'gsap';
import { createHeadlineTexture } from './headlineTexture.js';
import { createGlassMaterial } from './glassMaterial.js';
import { createFloatingToys } from './floatingToys.js';

const MODEL_URL = 'https://motionsites.org/assets/prompt-media/fa96096e78c8153a70d2.glb';

function normalizeGeometry(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  geometry.translate(-center.x, -center.y, -center.z);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  geometry.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
  return geometry;
}

export function createStage({ canvas, dragZone, onHoverChange, onReady }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0xffffff, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // 1. 背景巨型标题画布 + 白到绿喷枪颗粒弥散渐变 Shader 场景
  const headline = createHeadlineTexture();
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.Camera();
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: headline.texture },
      uScroll: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uScroll;
      uniform float uTime;
      varying vec2 vUv;

      // 高频伪随机哈希噪声（生成喷枪散点颗粒）
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        // 双尺度颗粒噪声：细砂粒 + 中颗粒（零均值 -0.5 ~ +0.5）
        float g1 = hash(floor(gl_FragCoord.xy * 0.92));
        float g2 = hash(floor(gl_FragCoord.xy * 0.45 + 19.7));
        float grain = (g1 * 0.68 + g2 * 0.32) - 0.5;

        // 用颗粒直接抖动 UV 坐标（让白->绿交界处形成真实的喷枪散点互渗，顶部纯白区域不受影响）
        vec2 jUv = vUv + vec2(grain * 0.075, grain * 0.115);

        // 有机波浪曲线高度（静止柔和，不随滚动上涌干扰阅读）
        float wave1 = sin(jUv.x * 3.2 + uTime * 0.18) * 0.045
                    + cos(jUv.x * 1.7 - 0.6) * 0.035;
        float yCoord = jUv.y - wave1;

        // 色彩定义：顶部 100% 纯白 -> 嫩黄绿 -> 鲜草绿 -> 底部深翠绿叶片弧
        vec3 pureWhite  = vec3(1.0, 1.0, 1.0);
        vec3 softLime   = vec3(0.84, 0.95, 0.66); // 浅嫩黄绿
        vec3 warmMustard= vec3(0.76, 0.87, 0.38); // 右侧暖黄绿
        vec3 freshGreen = vec3(0.38, 0.82, 0.41); // 鲜绿
        vec3 deepEmerald= vec3(0.07, 0.67, 0.33); // 参考图中的高饱和深翠绿

        // 第一层：纯白 -> 嫩黄绿（页面上半部保持 100% 纯白 #FFFFFF）
        float m1 = smoothstep(0.48, 0.12, yCoord);
        vec3 baseLime = mix(softLime, warmMustard, smoothstep(0.25, 0.92, jUv.x));
        vec3 bgColor = mix(pureWhite, baseLime, m1);

        // 第二层：中下部鲜绿弥散层
        float m2 = smoothstep(0.28, -0.05, yCoord + sin(jUv.x * 2.5) * 0.04);
        bgColor = mix(bgColor, freshGreen, m2 * 0.88);

        // 第三层：参考图标志性的斜向深翠绿有机叶片弧块
        vec2 leafP = jUv - vec2(0.46, 0.12);
        float ang = -0.48;
        mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        leafP = rot * leafP;
        // 下边界略收紧、上边界宽弥散
        float yScale = leafP.y < 0.0 ? 2.4 : 1.55;
        float leafDist = length(vec2(leafP.x * 0.78, leafP.y * yScale));
        float leafMask = smoothstep(0.34, 0.04, leafDist);
        bgColor = mix(bgColor, deepEmerald, leafMask * 0.92);

        // 在有色区域叠加微妙的纸张颗粒质感与极少量白点纤维（纯白区权重为 0，确保白底绝对纯净）
        float greenWeight = clamp(m1 + leafMask, 0.0, 1.0);
        bgColor += grain * 0.055 * greenWeight;
        float speck = step(0.9965, g1) * greenWeight;
        bgColor = mix(bgColor, vec3(0.98, 1.0, 0.92), speck * 0.55);
        bgColor = clamp(bgColor, 0.0, 1.0);

        // 合成前景巨型标题文字纹理 (uTex)
        vec4 tex = texture2D(uTex, vUv);
        vec3 finalColor = mix(bgColor, tex.rgb, tex.a);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false;
  bgScene.add(bgQuad);

  // 2. 双通道折射 RenderTargets
  const rtParams = {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  };
  const rtBack = new THREE.WebGLRenderTarget(1, 1, rtParams);
  const rtFront = new THREE.WebGLRenderTarget(1, 1, rtParams);

  const backMat = createGlassMaterial(true, rtBack.texture);
  const frontMat = createGlassMaterial(false, rtFront.texture);

  // 3. 主 3D 舞台（玻璃立方体 + 悬浮玩具卫星）
  const mainScene = new THREE.Scene();

  const pivot = new THREE.Group();
  const scrollGroup = new THREE.Group();
  const spinner = new THREE.Group();
  spinner.rotation.set(-0.42, 0.62, 0.18);

  scrollGroup.add(spinner);
  pivot.add(scrollGroup);
  mainScene.add(pivot);

  // 先用高质量圆角立方体立即可用，随后若远程 GLB 加载成功则无缝替换几何体
  const fallbackGeo = normalizeGeometry(new RoundedBoxGeometry(1, 1, 1, 10, 0.13));
  const cubeMesh = new THREE.Mesh(fallbackGeo, frontMat);
  spinner.add(cubeMesh);

  // 悬浮 3D 几何体微交互系统
  const toys = createFloatingToys();
  mainScene.add(toys.group);

  // 尝试加载远程高精度圆角立方体 GLB
  let readyFired = false;
  const fireReady = () => {
    if (!readyFired) {
      readyFired = true;
      if (onReady) onReady();
    }
  };

  const gltfLoader = new GLTFLoader();
  const loadTimer = setTimeout(fireReady, 1200);
  gltfLoader.load(
    MODEL_URL,
    (gltf) => {
      clearTimeout(loadTimer);
      try {
        gltf.scene.updateMatrixWorld(true);
        const parts = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh && child.geometry) {
            let g = child.geometry.clone();
            g.deleteAttribute('uv');
            g.deleteAttribute('color');
            g.deleteAttribute('tangent');
            g = mergeVertices(g, 1e-4);
            g.computeVertexNormals();
            g.applyMatrix4(child.matrixWorld);
            parts.push(g);
          }
        });
        if (parts.length > 0) {
          const merged = normalizeGeometry(mergeGeometries(parts, false));
          cubeMesh.geometry.dispose();
          cubeMesh.geometry = merged;
        }
      } catch (_) {
        // 保持 fallbackGeo
      }
      fireReady();
    },
    undefined,
    () => {
      clearTimeout(loadTimer);
      fireReady();
    }
  );

  // 4. 视口与滚动状态
  let visW = 10;
  let visH = 6;
  let baseScale = 2.2;
  let isMobile = false;

  // 滚动驱动状态（由 GSAP ScrollTrigger 控制）
  const scrollState = {
    progress: 0,
    screenX: 0.56, // 屏幕水平比例 (0..1)
    screenY: 0.47, // 屏幕垂直比例 (0..1)
    scaleMult: 1.0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    chromatic: 0.56,
  };

  const cubeBounce = { scale: 1.0 };

  function pulseCube(strength = 1) {
    gsap.killTweensOf(cubeBounce);
    gsap.fromTo(
      cubeBounce,
      { scale: 1 + 0.16 * strength },
      { scale: 1.0, duration: 0.85, ease: 'elastic.out(1.2, 0.38)' }
    );
    gsap.fromTo(
      frontMat.uniforms.uChromatic,
      { value: 0.92 },
      { value: scrollState.chromatic, duration: 0.75, ease: 'power2.out' }
    );
  }

  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);

    const drawW = Math.max(1, Math.round(W * dpr));
    const drawH = Math.max(1, Math.round(H * dpr));
    rtBack.setSize(drawW, drawH);
    rtFront.setSize(drawW, drawH);

    backMat.uniforms.uResolution.value.set(drawW, drawH);
    frontMat.uniforms.uResolution.value.set(drawW, drawH);

    const aspect = W / Math.max(1, H);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    visH = 2 * Math.tan(fovRad / 2) * camera.position.z;
    visW = visH * aspect;

    isMobile = W < 768 || aspect < 1;
    const px = Math.min(H * 0.43, W * (isMobile ? 0.46 : 0.285));
    baseScale = (px / H) * visH;
  }

  layout();
  window.addEventListener('resize', layout);

  // 5. 鼠标视差、Raycaster 微交互与拖拽旋转
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  const qTmp = new THREE.Quaternion();

  function applyWorldRotation(dx, dy) {
    if (dx !== 0) {
      qTmp.setFromAxisAngle(axisY, dx);
      spinner.quaternion.premultiply(qTmp);
    }
    if (dy !== 0) {
      qTmp.setFromAxisAngle(axisX, dy);
      spinner.quaternion.premultiply(qTmp);
    }
    spinner.quaternion.normalize();
  }

  const pointerNDC = new THREE.Vector2(0, 0);
  const pointerTargetNDC = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();

  let isDragging = false;
  let activePointerId = null;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastMoveTime = 0;
  let velX = 0;
  let velY = 0;
  let releaseTime = -10;

  window.addEventListener(
    'pointermove',
    (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerTargetNDC.set(nx, ny);

      if (!isDragging) {
        const heroScroll = window.scrollY / Math.max(1, window.innerHeight);
        if (heroScroll > 0.75) {
          toys.setHovered(null);
          if (onHoverChange) onHoverChange(false);
          return;
        }
        raycaster.setFromCamera(pointerTargetNDC, camera);
        const hits = raycaster.intersectObjects([...toys.meshes, cubeMesh], true);
        if (hits.length > 0) {
          const hitMesh = hits[0].object;
          if (hitMesh !== cubeMesh) {
            toys.setHovered(hitMesh);
          } else {
            toys.setHovered(null);
          }
          if (onHoverChange) onHoverChange(true);
        } else {
          toys.setHovered(null);
          if (onHoverChange) onHoverChange(false);
        }
      }
    },
    { passive: true }
  );

  // 全局点击检测（仅在第一屏响应 3D 悬浮几何体点击弹跳）
  window.addEventListener('pointerdown', (e) => {
    if (window.scrollY > window.innerHeight * 0.75) return;
    const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (tag === 'a' || tag === 'button' || (e.target && e.target.closest && e.target.closest('a, button'))) {
      return;
    }
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const toyHits = raycaster.intersectObjects(toys.meshes, true);
    if (toyHits.length > 0) {
      toys.onClickMesh(toyHits[0].object);
      velX += (Math.random() - 0.5) * 0.04;
      velY += (Math.random() - 0.5) * 0.04;
    }
  });

  // 拖拽热区与玻璃立方体交互
  const dragEl = dragZone || canvas;
  dragEl.addEventListener('pointerdown', (e) => {
    isDragging = true;
    activePointerId = e.pointerId;
    if (dragEl.setPointerCapture) {
      try {
        dragEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    dragEl.classList.add('dragging');
    downX = e.clientX;
    downY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveTime = performance.now();
    velX = 0;
    velY = 0;
  });

  dragEl.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    const now = performance.now();
    const dtMs = Math.max(1, now - lastMoveTime);
    const dx = (e.clientX - lastX) * 0.0085;
    const dy = (e.clientY - lastY) * 0.0085;
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveTime = now;

    applyWorldRotation(dx, dy);

    const frameScale = 16.67 / dtMs;
    velX = dx * frameScale;
    velY = dy * frameScale;
  });

  function endDrag(e) {
    if (!isDragging || e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    dragEl.classList.remove('dragging');

    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist < 6) {
      // 轻点立方体：触发 Q 弹色散脉冲 + 卫星齐跳
      pulseCube(1.0);
      toys.triggerWaveAll();
      velX = 0.042;
      velY = -0.024;
    } else if (performance.now() - lastMoveTime > 90) {
      velX = 0;
      velY = 0;
    }
    releaseTime = performance.now() * 0.001;
  }

  dragEl.addEventListener('pointerup', endDrag);
  dragEl.addEventListener('pointercancel', endDrag);

  // 6. 渲染循环
  let prevTime = performance.now() * 0.001;

  function renderFrame() {
    requestAnimationFrame(renderFrame);

    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.0001, now - prevTime));
    prevTime = now;
    const frames = dt * 60;

    // 计算第一屏滚动进度：0 = 第一屏顶部，>= 1 = 第一屏已滚出视口
    const heroScroll = Math.max(0, window.scrollY / Math.max(1, window.innerHeight));

    // 鼠标视差平滑插值
    pointerNDC.x += (pointerTargetNDC.x - pointerNDC.x) * Math.min(1, dt * 6);
    pointerNDC.y += (pointerTargetNDC.y - pointerNDC.y) * Math.min(1, dt * 6);
    headline.setMotion(pointerNDC.x, pointerNDC.y, heroScroll);

    // 更新背景喷枪颗粒渐变着色器的时间参数
    bgMat.uniforms.uScroll.value = 0;
    bgMat.uniforms.uTime.value = now;

    // 如果已经滚出第一屏 (#hero)，隐藏全部 3D 动效物体，仅渲染干净背景，杜绝视觉冗杂
    if (heroScroll >= 1.15) {
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(bgScene, bgCamera);
      return;
    }

    // 立方体惯性与待机自转
    if (!isDragging) {
      if (Math.abs(velX) > 1e-6 || Math.abs(velY) > 1e-6) {
        applyWorldRotation(velX * frames, velY * frames);
        const damping = Math.pow(0.94, frames);
        velX *= damping;
        velY *= damping;
      }

      const sinceRelease = now - releaseTime;
      if (sinceRelease > 0.5) {
        const blend = Math.min(1, (sinceRelease - 0.5) / 1.0);
        applyWorldRotation(0.0038 * frames * blend, 0.0014 * frames * blend);
      }
    }

    // 3D 舞台整体随第一屏自然上移滚出视口
    mainScene.position.y = heroScroll * visH * 1.05;
    const heroFadeScale = Math.max(0.001, 1 - Math.max(0, heroScroll - 0.15) * 0.85);

    const sx = isMobile ? 0.5 : scrollState.screenX;
    const sy = isMobile ? 0.44 : scrollState.screenY;
    const targetX = (sx - 0.5) * visW + pointerNDC.x * 0.22;
    const targetY = (0.5 - sy) * visH + pointerNDC.y * 0.18 + Math.sin(now * 1.5) * 0.08;

    pivot.position.x += (targetX - pivot.position.x) * Math.min(1, dt * 8);
    pivot.position.y += (targetY - pivot.position.y) * Math.min(1, dt * 8);

    const finalScale = baseScale * cubeBounce.scale * heroFadeScale;
    pivot.scale.setScalar(finalScale);

    // 更新 3D 悬浮几何体（固定在第一屏，不随滚动乱飞）
    toys.update(now, dt, pointerNDC, 0, isMobile, pivot.position);
    toys.group.scale.setScalar(heroFadeScale);

    // ===== 双通道色散折射管线 =====
    // 背面折射只采样位于立方体后方 (z < 0) 的悬浮几何体
    cubeMesh.visible = false;
    toys.meshes.forEach((m) => {
      m.visible = m.position.z < 0;
    });

    // Pass 1: 背景画布 + 后景 3D 玩具 -> rtBack
    renderer.setRenderTarget(rtBack);
    renderer.autoClear = true;
    renderer.render(bgScene, bgCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(mainScene, camera);

    // Pass 2: 背景画布 + 后景 3D 玩具 + 玻璃立方体背面 -> rtFront
    renderer.setRenderTarget(rtFront);
    renderer.autoClear = true;
    renderer.render(bgScene, bgCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(mainScene, camera);

    cubeMesh.visible = true;
    cubeMesh.material = backMat;
    renderer.render(mainScene, camera);

    // Pass 3: 背景画布 + 全部 3D 玩具 + 玻璃立方体正面 -> 屏幕
    toys.meshes.forEach((m) => {
      m.visible = true;
    });
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.render(bgScene, bgCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    cubeMesh.material = frontMat;
    renderer.render(mainScene, camera);
  }

  renderFrame();

  return {
    headline,
    scrollState,
    pulseCube,
    triggerWaveAll: toys.triggerWaveAll,
  };
}
