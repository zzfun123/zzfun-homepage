import * as THREE from 'three';

const glassVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vEye;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPos = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPos;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vEye = normalize(mvPos.xyz);
  }
`;

const glassFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uIorR;
  uniform float uIorY;
  uniform float uIorG;
  uniform float uIorC;
  uniform float uIorB;
  uniform float uIorP;
  uniform float uRefractPower;
  uniform float uChromatic;
  uniform float uSaturation;
  uniform float uShininess;
  uniform float uDiffuseness;
  uniform float uFresnelPower;
  uniform vec3 uLight;
  uniform float uBackside;

  varying vec3 vNormal;
  varying vec3 vEye;
  varying vec3 vWorldNormal;

  float specular(vec3 light, float shininess, float diffuseness, vec3 n, vec3 eye) {
    vec3 lightVec = normalize(-light);
    vec3 viewVec = -eye;
    vec3 halfVec = normalize(viewVec + lightVec);
    return pow(max(dot(n, halfVec), 0.0), shininess) + max(0.0, dot(n, lightVec)) * diffuseness;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 n = normalize(vNormal);
    if (uBackside > 0.5) n = -n;
    vec3 eye = normalize(vEye);

    const int LOOP = 16;
    vec3 color = vec3(0.0);

    vec3 refrR = refract(eye, n, 1.0 / uIorR);
    vec3 refrY = refract(eye, n, 1.0 / uIorY);
    vec3 refrG = refract(eye, n, 1.0 / uIorG);
    vec3 refrC = refract(eye, n, 1.0 / uIorC);
    vec3 refrB = refract(eye, n, 1.0 / uIorB);
    vec3 refrP = refract(eye, n, 1.0 / uIorP);

    for (int i = 0; i < LOOP; i++) {
      float slide = float(i) / float(LOOP) * 0.05;

      vec3 texR = texture2D(uTexture, clamp(uv + refrR.xy * (uRefractPower + slide * 1.0) * uChromatic, 0.002, 0.998)).rgb;
      vec3 texY = texture2D(uTexture, clamp(uv + refrY.xy * (uRefractPower + slide * 1.2) * uChromatic, 0.002, 0.998)).rgb;
      vec3 texG = texture2D(uTexture, clamp(uv + refrG.xy * (uRefractPower + slide * 2.0) * uChromatic, 0.002, 0.998)).rgb;
      vec3 texC = texture2D(uTexture, clamp(uv + refrC.xy * (uRefractPower + slide * 2.6) * uChromatic, 0.002, 0.998)).rgb;
      vec3 texB = texture2D(uTexture, clamp(uv + refrB.xy * (uRefractPower + slide * 3.2) * uChromatic, 0.002, 0.998)).rgb;
      vec3 texP = texture2D(uTexture, clamp(uv + refrP.xy * (uRefractPower + slide * 1.4) * uChromatic, 0.002, 0.998)).rgb;

      float r = texR.x * 0.5;
      float y = (texY.x * 2.0 + texY.y * 2.0 - texY.z) / 6.0;
      float g = texG.y * 0.5;
      float c = (texC.y * 2.0 + texC.z * 2.0 - texC.x) / 6.0;
      float b = texB.z * 0.5;
      float p = (texP.z * 2.0 + texP.x * 2.0 - texP.y) / 6.0;

      float R = r + (2.0 * p + 2.0 * y - c) / 3.0;
      float G = g + (2.0 * y + 2.0 * c - p) / 3.0;
      float B = b + (2.0 * c + 2.0 * p - y) / 3.0;

      color += vec3(R, G, B);
    }

    color /= float(LOOP);

    // 饱和度强化（不压暗白色，只让折射出的晴空蓝、柠檬黄、丝带红棱镜色散更鲜亮）
    float luma = dot(color, vec3(0.2125, 0.7154, 0.0721));
    color = clamp(mix(vec3(luma), color, uSaturation), 0.0, 1.0);

    // 菲涅尔边缘：晴空蓝 (#0E7FD8) 与柠檬黄 (#FFC940) 清透棱边，不混入任何灰黑色
    float ndotv = clamp(1.0 + dot(eye, n), 0.0, 1.0);
    float fresnelRim = pow(ndotv, 3.2);
    float fresnelSharp = pow(ndotv, uFresnelPower);

    vec3 skyBlue = vec3(0.055, 0.498, 0.847);
    vec3 lemonYellow = vec3(1.0, 0.788, 0.251);
    vec3 iridescence = mix(skyBlue, lemonYellow, clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0));

    if (uBackside < 0.5) {
      color = mix(color, iridescence, fresnelRim * 0.38);
      color = mix(color, skyBlue, pow(ndotv, 6.0) * 0.45);
    } else {
      color = mix(color, iridescence, fresnelRim * 0.16);
    }

    // 双光源 Blinn-Phong 镜面高光
    float spec1 = specular(uLight, uShininess, uDiffuseness, n, eye);
    float spec2 = specular(vec3(1.2, -0.9, -1.0), uShininess * 0.55, uDiffuseness * 0.5, n, eye);
    color += vec3(1.0) * (spec1 + 0.65 * spec2) * (uBackside > 0.5 ? 0.35 : 1.0);

    // 锐利纯白高光边
    color = mix(color, vec3(1.0), fresnelSharp * (uBackside > 0.5 ? 0.2 : 0.5));

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function createGlassMaterial(isBack, renderTargetTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: renderTargetTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uIorR: { value: 1.14 },
      uIorY: { value: 1.16 },
      uIorG: { value: 1.19 },
      uIorC: { value: 1.23 },
      uIorB: { value: 1.26 },
      uIorP: { value: 1.29 },
      uRefractPower: { value: isBack ? 0.24 : 0.34 },
      uChromatic: { value: 0.56 },
      uSaturation: { value: 1.22 },
      uShininess: { value: 85.0 },
      uDiffuseness: { value: 0.02 },
      uFresnelPower: { value: 4.8 },
      uLight: { value: new THREE.Vector3(-1.0, 1.1, 1.0) },
      uBackside: { value: isBack ? 1.0 : 0.0 },
    },
    vertexShader: glassVertexShader,
    fragmentShader: glassFragmentShader,
    side: isBack ? THREE.BackSide : THREE.FrontSide,
  });
}
