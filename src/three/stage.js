import * as THREE from 'three';
import gsap from 'gsap';

const tomatoVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;

  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;

    // 点击时的果冻 Q 弹波纹形变
    float wave = sin(position.y * 5.5 - uTime * 14.0) * uPulse * 0.085;
    vec3 displaced = position * (1.0 + wave * vec3(1.0, -0.8, 1.0));

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vec4 mvPos = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPos;

    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewPos = -mvPos.xyz;
  }
`;

const tomatoFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uDeepColor;
  uniform vec3 uSubsurfaceColor;
  uniform vec3 uRimColor;
  uniform float uRoughness;
  uniform float uPulse;

  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPos);

    // 画廊三点布光：主柔光箱 + 侧逆暖光 + 顶部天光
    vec3 keyLight = normalize(vec3(0.68, 0.92, 0.85));
    vec3 fillLight = normalize(vec3(-0.85, -0.35, 0.55));

    float ndotl = dot(n, keyLight);
    float diffuse = smoothstep(-0.35, 0.85, ndotl);

    // 基础漫反射与暗部层次
    vec3 color = mix(uDeepColor, uBaseColor, 0.25 + 0.75 * diffuse);

    // 次表面散射感 (SSS)：让西红柿果肉呈现出饱满透亮的汁水感
    float sss = smoothstep(-0.6, 0.4, ndotl) * (1.0 - max(0.0, dot(n, viewDir)));
    color += uSubsurfaceColor * sss * 0.35;

    // 侧补光
    float fill = max(0.0, dot(n, fillLight));
    color += uBaseColor * fill * 0.14;

    // 画廊顶部漫射反光
    float sky = clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);
    color += vec3(0.05, 0.06, 0.08) * sky;

    // 主光源柔光箱镜面高光 (Blinn-Phong)
    vec3 halfKey = normalize(keyLight + viewDir);
    float specPower = mix(96.0, 28.0, uRoughness);
    float spec1 = pow(max(dot(n, halfKey), 0.0), specPower);
    float crispSpec = smoothstep(0.42, 0.88, spec1);
    color += vec3(1.0, 0.98, 0.96) * crispSpec * (1.0 - uRoughness * 0.55);

    // 次级边缘反光点
    vec3 backLight = normalize(vec3(-0.55, 0.8, -0.45));
    vec3 halfBack = normalize(backLight + viewDir);
    float spec2 = pow(max(dot(n, halfBack), 0.0), 36.0);
    color += uRimColor * spec2 * 0.28;

    // 菲涅尔边缘光泽
    float fresnel = clamp(1.0 - max(dot(n, viewDir), 0.0), 0.0, 1.0);
    color = mix(color, uRimColor, pow(fresnel, 3.2) * 0.42);

    // 极细腻的画廊深色外轮廓收边
    float contour = smoothstep(0.80, 0.92, fresnel);
    color = mix(color, vec3(0.08, 0.09, 0.12), contour * 0.38);

    // 点击脉冲亮泽反馈
    color = mix(color, vec3(1.0, 0.92, 0.82), uPulse * 0.28);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function createStudioMaterial({ base, deep, sss, rim, roughness }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(base) },
      uDeepColor: { value: new THREE.Color(deep) },
      uSubsurfaceColor: { value: new THREE.Color(sss) },
      uRimColor: { value: new THREE.Color(rim) },
      uRoughness: { value: roughness },
      uTime: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: tomatoVertexShader,
    fragmentShader: tomatoFragmentShader,
  });
}

/**
 * 构建高精度画廊级 3D 西红柿模型
 */
function buildGalleryTomato() {
  const group = new THREE.Group();

  const fleshMat = createStudioMaterial({
    base: '#FF432E',
    deep: '#A8160C',
    sss: '#FF8A5B',
    rim: '#FFE5D9',
    roughness: 0.16,
  });

  const calyxMat = createStudioMaterial({
    base: '#27AE60',
    deep: '#0F522B',
    sss: '#6EE798',
    rim: '#D4FFDF',
    roughness: 0.42,
  });

  // 1. 饱满 8 瓣微棱西红柿果体
  const bodyGeo = new THREE.SphereGeometry(1.0, 96, 64);
  const pos = bodyGeo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    const rXZ = Math.hypot(v.x, v.z);

    // 8 瓣自然圆润果棱
    const rib = 1.0 + 0.038 * Math.cos(angle * 8.0) * Math.sin(rXZ * Math.PI * 0.85);
    v.x *= rib;
    v.z *= rib;

    // 顶部与底部果蒂自然凹窝
    const topDimple = v.y > 0 ? Math.exp(-rXZ * rXZ * 5.8) * 0.17 : 0.0;
    const botDimple = v.y < 0 ? Math.exp(-rXZ * rXZ * 7.5) * 0.09 : 0.0;
    v.y = v.y * 0.79 - topDimple + botDimple;

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, fleshMat);
  group.add(bodyMesh);

  // 2. 顶部 6 片舒展微翘的绿萼叶 (Sepals)
  const sepalCount = 6;
  const sepalGeo = new THREE.SphereGeometry(0.16, 28, 20);
  const sPos = sepalGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    v.fromBufferAttribute(sPos, i);
    // 拉伸为叶片形：由根部向叶尖渐尖，并在叶尖向上微翘
    const t = (v.x + 0.16) / 0.32; // 0 (根部) -> 1 (叶尖)
    const lengthX = t * 0.62;
    const widthZ = v.z * (1.15 - t * 0.88) * 0.85;
    const archY = v.y * 0.24 - Math.sin(t * Math.PI) * 0.06 + Math.pow(t, 2.4) * 0.14;
    sPos.setXYZ(i, lengthX, archY, widthZ);
  }
  sepalGeo.computeVertexNormals();

  for (let i = 0; i < sepalCount; i++) {
    const theta = (i / sepalCount) * Math.PI * 2 + (i % 2) * 0.08;
    const leafMesh = new THREE.Mesh(sepalGeo, calyxMat);
    leafMesh.position.set(0, 0.65, 0);
    leafMesh.rotation.y = theta;
    leafMesh.rotation.z = -0.08;
    group.add(leafMesh);
  }

  // 3. 自然微弯的中央果蒂 (Stem)
  const stemGeo = new THREE.CylinderGeometry(0.042, 0.088, 0.44, 24, 18);
  const stPos = stemGeo.attributes.position;
  for (let i = 0; i < stPos.count; i++) {
    v.fromBufferAttribute(stPos, i);
    const h = (v.y + 0.22) / 0.44; // 0 -> 1
    v.x += Math.pow(h, 1.9) * 0.14;
    v.y = h * 0.42;
    stPos.setXYZ(i, v.x, v.y, v.z);
  }
  stemGeo.computeVertexNormals();

  const stemMesh = new THREE.Mesh(stemGeo, calyxMat);
  stemMesh.position.set(0, 0.61, 0);
  group.add(stemMesh);

  return {
    group,
    materials: [fleshMat, calyxMat],
  };
}

/**
 * 构建西红柿底部的画廊柔和呼吸投影
 */
function buildContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  grad.addColorStop(0, 'rgba(6, 26, 18, 0.22)');
  grad.addColorStop(0.45, 'rgba(6, 26, 18, 0.09)');
  grad.addColorStop(1, 'rgba(6, 26, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function createStage({ canvas, dragZone, onHoverChange }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // 舞台层级：stageRoot（位置与整体缩放） -> spinner（360°旋转） -> bounceGroup（Q弹缩放） -> 西红柿
  const stageRoot = new THREE.Group();
  const spinner = new THREE.Group();
  const bounceGroup = new THREE.Group();

  // 初始优雅倾角：露出翠绿五角果蒂与高光肩部
  spinner.rotation.set(0.42, -0.35, 0.14);

  const tomato = buildGalleryTomato();
  bounceGroup.add(tomato.group);
  spinner.add(bounceGroup);
  stageRoot.add(spinner);

  // 底部接触软阴影
  const shadowMesh = buildContactShadow();
  shadowMesh.position.set(0, -1.28, -0.2);
  stageRoot.add(shadowMesh);

  scene.add(stageRoot);

  // 入场弹性展开动画
  const state = {
    scaleX: 0.001,
    scaleY: 0.001,
    scaleZ: 0.001,
    pulse: 0,
  };

  gsap.to(state, {
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    duration: 1.25,
    delay: 0.08,
    ease: 'elastic.out(1.05, 0.5)',
  });

  function triggerJellyBounce(strength = 1) {
    gsap.killTweensOf(state);
    const tl = gsap.timeline();
    tl.to(state, {
      scaleX: 1 + 0.22 * strength,
      scaleY: 1 - 0.18 * strength,
      scaleZ: 1 + 0.22 * strength,
      pulse: 1.0,
      duration: 0.11,
      ease: 'power2.out',
    })
      .to(state, {
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        duration: 0.95,
        ease: 'elastic.out(1.25, 0.35)',
      })
      .to(
        state,
        {
          pulse: 0,
          duration: 0.65,
          ease: 'power2.out',
        },
        0.11
      );
  }

  // 视口自适应布局
  let visH = 5;
  let baseScale = 1;

  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);

    const aspect = W / Math.max(1, H);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const fovRad = THREE.MathUtils.degToRad(camera.fov);
    visH = 2 * Math.tan(fovRad / 2) * camera.position.z;

    const isMobile = W < 640 || aspect < 0.85;
    // 西红柿位于屏幕中心偏上（约 34% 高度处），下方留给「网站正在施工」标题
    const sy = isMobile ? 0.33 : 0.34;
    stageRoot.position.set(0, (0.5 - sy) * visH, 0);

    const targetPx = Math.min(H * (isMobile ? 0.25 : 0.29), W * (isMobile ? 0.42 : 0.22));
    baseScale = (targetPx / H) * visH * 0.55;
  }

  layout();
  window.addEventListener('resize', layout);

  // 拖拽旋转与惯性物理
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
  let velX = 0.012;
  let velY = 0;
  let releaseTime = -10;

  window.addEventListener(
    'pointermove',
    (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerTargetNDC.set(nx, ny);

      if (!isDragging && onHoverChange) {
        raycaster.setFromCamera(pointerTargetNDC, camera);
        const hits = raycaster.intersectObject(tomato.group, true);
        onHoverChange(hits.length > 0);
      }
    },
    { passive: true }
  );

  const dragEl = dragZone || canvas;

  dragEl.addEventListener('pointerdown', (e) => {
    isDragging = true;
    activePointerId = e.pointerId;
    if (dragEl.setPointerCapture) {
      try {
        dragEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
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
    const dx = (e.clientX - lastX) * 0.009;
    const dy = (e.clientY - lastY) * 0.009;
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

    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist < 6) {
      // 轻点西红柿：触发 Q 弹果冻弹跳与欢快自转
      triggerJellyBounce(1.0);
      velX = 0.055;
      velY = -0.022;
    } else if (performance.now() - lastMoveTime > 90) {
      velX = 0;
      velY = 0;
    }
    releaseTime = performance.now() * 0.001;
  }

  dragEl.addEventListener('pointerup', endDrag);
  dragEl.addEventListener('pointercancel', endDrag);

  // 渲染循环
  let prevTime = performance.now() * 0.001;

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.0001, now - prevTime));
    prevTime = now;
    const frames = dt * 60;

    pointerNDC.x += (pointerTargetNDC.x - pointerNDC.x) * Math.min(1, dt * 6);
    pointerNDC.y += (pointerTargetNDC.y - pointerNDC.y) * Math.min(1, dt * 6);

    if (!isDragging) {
      if (Math.abs(velX) > 1e-6 || Math.abs(velY) > 1e-6) {
        applyWorldRotation(velX * frames, velY * frames);
        const damping = Math.pow(0.95, frames);
        velX *= damping;
        velY *= damping;
      }

      const sinceRelease = now - releaseTime;
      if (sinceRelease > 0.4) {
        const blend = Math.min(1, (sinceRelease - 0.4) / 1.0);
        applyWorldRotation(0.0042 * frames * blend, Math.sin(now * 0.7) * 0.0006 * frames * blend);
      }
    }

    // 柔和悬浮呼吸 + 鼠标微视差
    const floatY = Math.sin(now * 1.65) * 0.075;
    bounceGroup.position.x = pointerNDC.x * 0.08;
    bounceGroup.position.y = floatY + pointerNDC.y * 0.06;
    bounceGroup.scale.set(
       baseScale * state.scaleX,
      baseScale * state.scaleY,
      baseScale * state.scaleZ
    );

    // 底部软阴影随悬浮高度同步缩放浓淡
    const shadowScale = baseScale * (1.0 - floatY * 0.65);
    shadowMesh.scale.setScalar(Math.max(0.001, shadowScale));
    shadowMesh.position.x = bounceGroup.position.x;
    shadowMesh.position.y = -baseScale * 1.18;

    tomato.materials.forEach((mat) => {
      mat.uniforms.uTime.value = now;
      mat.uniforms.uPulse.value = state.pulse;
    });

    renderer.render(scene, camera);
  }

  animate();

  return {
    triggerJellyBounce,
  };
}
