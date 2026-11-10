import * as THREE from 'three';
import gsap from 'gsap';

const toyVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // 脉冲呼吸微形变
    vec3 pos = position * (1.0 + uPulse * 0.14 * sin(position.y * 6.0 + uTime * 8.0));
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vec4 mvPos = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPos;

    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewPosition = -mvPos.xyz;
  }
`;

const toyFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform vec3 uShadowColor;
  uniform float uPulse;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // 主光源与环境半球光
    vec3 lightDir = normalize(vec3(0.75, 1.0, 0.85));
    float ndotl = dot(n, lightDir);
    float diffuse = smoothstep(-0.25, 0.65, ndotl);

    // 基底色与阴影色插值
    vec3 color = mix(uShadowColor, uBaseColor, 0.32 + 0.68 * diffuse);

    // 半球天空反光
    float sky = clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);
    color += vec3(0.06, 0.10, 0.16) * sky * 0.25;

    // 镜面高光 (Blinn-Phong)
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(n, halfVec), 0.0), 42.0);
    color += vec3(1.0, 0.99, 0.94) * smoothstep(0.45, 0.85, spec) * 0.55;

    // 菲涅尔彩色边缘光 + 墨蓝轮廓线感
    float fresnel = clamp(1.0 - max(dot(n, viewDir), 0.0), 0.0, 1.0);
    color = mix(color, uRimColor, pow(fresnel, 2.6) * 0.65);

    // 外缘晴空墨蓝勾边 (#0C3B66) 与 UI 卡片 2.5px 描边呼应
    float inkEdge = smoothstep(0.74, 0.88, fresnel);
    color = mix(color, vec3(0.047, 0.231, 0.400), inkEdge * 0.72);

    // 点击/悬停脉冲高光
    color = mix(color, vec3(1.0, 0.92, 0.55), uPulse * 0.45);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function createToyMaterial(baseHex, rimHex, shadowHex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseHex) },
      uRimColor: { value: new THREE.Color(rimHex) },
      uShadowColor: { value: new THREE.Color(shadowHex) },
      uTime: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: toyVertexShader,
    fragmentShader: toyFragmentShader,
  });
}

/**
 * 构建 3D 饱满西红柿模型（带 6 瓣微棱果体 + 五角绿萼叶 + 弯曲果蒂）
 */
function createTomatoMeshGroup(toyIndex) {
  const tomatoGroup = new THREE.Group();

  const redMat = createToyMaterial('#FF4B3A', '#FFC940', '#B81D13');
  const greenMat = createToyMaterial('#2ECC71', '#B8FFCE', '#146B3A');

  // 1. 饱满带微棱与顶部凹窝的西红柿果体
  const bodyGeo = new THREE.SphereGeometry(0.36, 48, 36);
  const posAttr = bodyGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const angle = Math.atan2(v.z, v.x);
    const rXZ = Math.hypot(v.x, v.z);
    // 6 瓣西红柿自然微棱
    const lobe = 1.0 + 0.048 * Math.cos(angle * 6.0) * (rXZ / 0.36);
    v.x *= lobe;
    v.z *= lobe;
    // 略扁圆的身形 + 顶部与底部果蒂凹陷
    const dimple = Math.exp(-rXZ * rXZ * 26.0) * 0.065;
    v.y = v.y * 0.82 - Math.sign(v.y) * dimple;
    posAttr.setXYZ(i, v.x, v.y, v.z);
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, redMat);
  bodyMesh.userData.toyIndex = toyIndex;
  tomatoGroup.add(bodyMesh);

  // 2. 顶部 5 片星星状展开的绿萼叶 (Calyx sepals)
  const leafCount = 5;
  const leafBaseGeo = new THREE.ConeGeometry(0.075, 0.25, 16);
  leafBaseGeo.scale(1.0, 1.0, 0.32);
  // 让叶片底部在原点，向外微翘
  leafBaseGeo.translate(0, 0.11, 0);

  for (let i = 0; i < leafCount; i++) {
    const theta = (i / leafCount) * Math.PI * 2;
    const leafPivot = new THREE.Group();
    leafPivot.position.set(0, 0.245, 0);
    leafPivot.rotation.y = theta;

    const leafMesh = new THREE.Mesh(leafBaseGeo, greenMat);
    // 向外压平贴合西红柿肩部并微翘
    leafMesh.rotation.z = -Math.PI * 0.42;
    leafMesh.userData.toyIndex = toyIndex;

    leafPivot.add(leafMesh);
    tomatoGroup.add(leafPivot);
  }

  // 3. 中央小果蒂 (Stem)
  const stemGeo = new THREE.CylinderGeometry(0.022, 0.044, 0.15, 14);
  stemGeo.translate(0, 0.07, 0);
  const stemMesh = new THREE.Mesh(stemGeo, greenMat);
  stemMesh.position.set(0, 0.24, 0);
  stemMesh.rotation.z = 0.22;
  stemMesh.userData.toyIndex = toyIndex;
  tomatoGroup.add(stemMesh);

  tomatoGroup.userData.toyIndex = toyIndex;

  return {
    object: tomatoGroup,
    materials: [redMat, greenMat],
  };
}

/**
 * 创建环绕在 3D 舞台中的悬浮几何体微交互系统
 */
export function createFloatingToys() {
  const group = new THREE.Group();
  const meshes = [];
  const items = [];

  const configs = [
    {
      name: 'juicy-tomato',
      isTomato: true,
      orbitAroundCube: true,
      orbitRadius: 1.58,
      orbitSpeed: 0.62,
      basePos: new THREE.Vector3(1.58, 0.25, 0.95),
      baseScale: 1.18,
      rotSpeed: new THREE.Vector3(0.75, 1.15, 0.45),
      floatSpeed: 1.45,
      floatAmp: 0.17,
      parallaxFactor: 0.55,
      phase: 0.8,
    },
    {
      name: 'lemon-torus',
      geo: new THREE.TorusGeometry(0.32, 0.13, 28, 64),
      mat: createToyMaterial('#FFC940', '#FFF6CC', '#D98A00'),
      basePos: new THREE.Vector3(-2.35, 1.25, -1.2), // 玻璃后方左侧，滚过时可被折射
      baseScale: 1.0,
      rotSpeed: new THREE.Vector3(0.55, 0.8, 0.25),
      floatSpeed: 1.3,
      floatAmp: 0.18,
      parallaxFactor: 0.48,
      phase: 0.2,
    },
    {
      name: 'blue-knot',
      geo: new THREE.TorusKnotGeometry(0.24, 0.085, 84, 20, 2, 3),
      mat: createToyMaterial('#0E7FD8', '#7CE0FF', '#083D70'),
      basePos: new THREE.Vector3(-1.85, -1.35, 0.7), // 左下前景
      baseScale: 1.0,
      rotSpeed: new THREE.Vector3(0.65, -0.5, 0.75),
      floatSpeed: 1.15,
      floatAmp: 0.15,
      parallaxFactor: 0.55,
      phase: 3.1,
    },
    {
      name: 'paper-capsule',
      geo: new THREE.CapsuleGeometry(0.17, 0.34, 16, 32),
      mat: createToyMaterial('#FFFFFF', '#0E7FD8', '#B8D9F4'),
      basePos: new THREE.Vector3(2.2, -1.25, -1.35), // 右下背景层
      baseScale: 1.0,
      rotSpeed: new THREE.Vector3(0.45, 0.6, -0.8),
      floatSpeed: 1.45,
      floatAmp: 0.2,
      parallaxFactor: 0.4,
      phase: 4.4,
    },
    {
      name: 'lemon-ico',
      geo: new THREE.IcosahedronGeometry(0.26, 0),
      mat: createToyMaterial('#FFC940', '#FF6154', '#C97A05'),
      basePos: new THREE.Vector3(0.35, 1.65, -1.65), // 玻璃正后上方（穿过玻璃被折射）
      baseScale: 0.92,
      rotSpeed: new THREE.Vector3(-0.6, -0.85, 0.5),
      floatSpeed: 1.8,
      floatAmp: 0.22,
      parallaxFactor: 0.75,
      phase: 5.2,
    },
    {
      name: 'ribbon-gem',
      geo: new THREE.OctahedronGeometry(0.3, 0),
      mat: createToyMaterial('#FF6154', '#FFC940', '#B52B20'),
      basePos: new THREE.Vector3(-0.45, -1.68, -1.45), // 玻璃正后下方
      baseScale: 0.9,
      rotSpeed: new THREE.Vector3(-0.7, 0.95, 0.4),
      floatSpeed: 1.6,
      floatAmp: 0.16,
      parallaxFactor: 0.6,
      phase: 2.3,
    },
  ];

  configs.forEach((cfg, index) => {
    let mesh;
    let materials;

    if (cfg.isTomato) {
      const tomato = createTomatoMeshGroup(index);
      mesh = tomato.object;
      materials = tomato.materials;
      mesh.rotation.set(0.35, -0.4, 0.18);
    } else {
      mesh = new THREE.Mesh(cfg.geo, cfg.mat);
      materials = [cfg.mat];
      mesh.rotation.set(index * 0.8, index * 1.1, index * 0.5);
      mesh.userData.toyIndex = index;
    }

    mesh.position.copy(cfg.basePos);

    const item = {
      ...cfg,
      mesh,
      materials,
      pulseObj: { val: 0 },
      extraScale: 1,
      spinBoost: 0,
      scrollOffset: new THREE.Vector3(),
    };
    meshes.push(mesh);
    items.push(item);
    group.add(mesh);
  });

  let hoveredItem = null;

  function setItemPulse(item, v) {
    item.materials.forEach((m) => {
      m.uniforms.uPulse.value = v;
    });
  }

  function triggerBounce(item, strength = 1) {
    gsap.killTweensOf(item);
    gsap.killTweensOf(item.pulseObj);

    item.spinBoost = 6.5 * strength;
    gsap.to(item, {
      spinBoost: 0,
      duration: 1.2,
      ease: 'power3.out',
    });

    gsap.fromTo(
      item,
      { extraScale: 1.38 * strength },
      {
        extraScale: hoveredItem === item ? 1.16 : 1.0,
        duration: 0.85,
        ease: 'elastic.out(1.2, 0.4)',
      }
    );

    item.pulseObj.val = 1.0;
    setItemPulse(item, 1.0);
    gsap.to(item.pulseObj, {
      val: hoveredItem === item ? 0.25 : 0.0,
      duration: 0.75,
      ease: 'power2.out',
      onUpdate: () => setItemPulse(item, item.pulseObj.val),
    });
  }

  function triggerWaveAll() {
    items.forEach((item, idx) => {
      gsap.delayedCall(idx * 0.05, () => triggerBounce(item, 0.85));
    });
  }

  function resolveToyIndex(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.toyIndex !== undefined) {
        return cur.userData.toyIndex;
      }
      cur = cur.parent;
    }
    return undefined;
  }

  function setHovered(mesh) {
    const idx = resolveToyIndex(mesh);
    const nextItem = idx !== undefined ? items[idx] : null;
    if (nextItem === hoveredItem) return;

    if (hoveredItem) {
      const prev = hoveredItem;
      gsap.to(prev, { extraScale: 1.0, duration: 0.4, ease: 'power2.out' });
      gsap.to(prev.pulseObj, {
        val: 0.0,
        duration: 0.35,
        onUpdate: () => setItemPulse(prev, prev.pulseObj.val),
      });
    }
    hoveredItem = nextItem;
    if (hoveredItem) {
      const curr = hoveredItem;
      curr.spinBoost = Math.max(curr.spinBoost, 2.2);
      gsap.to(curr, { extraScale: 1.18, duration: 0.45, ease: 'back.out(2)' });
      gsap.to(curr.pulseObj, {
        val: 0.3,
        duration: 0.3,
        onUpdate: () => setItemPulse(curr, curr.pulseObj.val),
      });
      gsap.to(curr, { spinBoost: 0, duration: 0.8, ease: 'power2.out' });
    }
  }

  function onClickMesh(mesh) {
    const idx = resolveToyIndex(mesh);
    const item = idx !== undefined ? items[idx] : null;
    if (item) {
      triggerBounce(item, 1.05);
      return true;
    }
    return false;
  }

  function update(time, dt, pointerNDC, scrollProgress, isMobile, cubePos) {
    const spread = isMobile ? 0.62 : 1.0;
    const cx = cubePos ? cubePos.x : 0;
    const cy = cubePos ? cubePos.y : 0;

    items.forEach((item, idx) => {
      item.materials.forEach((m) => {
        m.uniforms.uTime.value = time;
      });

      // 自转 + 脉冲加速旋转
      const boost = 1 + item.spinBoost;
      item.mesh.rotation.x += item.rotSpeed.x * dt * boost;
      item.mesh.rotation.y += item.rotSpeed.y * dt * boost;
      item.mesh.rotation.z += item.rotSpeed.z * dt * boost;

      const px = pointerNDC.x * item.parallaxFactor;
      const py = pointerNDC.y * item.parallaxFactor;

      if (item.orbitAroundCube) {
        // 3D 环绕玻璃立方体公转 + 自转（转到后方 z<0 时还会被玻璃色散折射）
        const a = time * item.orbitSpeed + item.phase + scrollProgress * Math.PI;
        const r = item.orbitRadius * (isMobile ? 0.78 : 1.0);
        item.mesh.position.set(
          cx + Math.cos(a) * r + px * 0.4,
          cy + Math.sin(a * 1.6) * 0.42 + py * 0.4,
          Math.sin(a) * r
        );
      } else {
        // 悬浮呼吸 + 滚动轨道偏移 + 鼠标视差跟随
        const floatY = Math.sin(time * item.floatSpeed + item.phase) * item.floatAmp;
        const floatX = Math.cos(time * (item.floatSpeed * 0.75) + item.phase) * (item.floatAmp * 0.65);

        const orbitAngle = scrollProgress * Math.PI * 1.35 + idx * 0.4;
        const scrollY = Math.sin(orbitAngle) * 0.45;
        const scrollX = Math.cos(orbitAngle) * 0.35 * (idx % 2 === 0 ? 1 : -1);

        item.mesh.position.set(
          item.basePos.x * spread + floatX + scrollX + px,
          item.basePos.y * (isMobile ? 0.82 : 1.0) + floatY + scrollY + py,
          item.basePos.z
        );
      }

      const s = item.baseScale * (isMobile ? 0.76 : 1.0) * item.extraScale;
      item.mesh.scale.setScalar(s);
    });
  }

  return {
    group,
    meshes,
    update,
    setHovered,
    onClickMesh,
    triggerWaveAll,
  };
}
