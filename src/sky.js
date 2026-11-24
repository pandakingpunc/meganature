import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

export const sun = new Vector3(-0.99, 0.116, -0.075).normalize();

export const noiseGLSL = `
float hash21(vec2 p) {
  vec3 q = fract(p.xyx * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  return 0.57*noise2(p) + 0.28*noise2(p*2.05+17.0) + 0.15*noise2(p*4.21-9.0);
}
`;

export const atmosphereGLSL = `
uniform vec3 uSun;
uniform float uTime;
vec3 horizon(vec3 dir) {
  float warmth = pow(max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(uSun.x, 0.0, uSun.z)))), 4.0);
  return mix(vec3(0.37,0.47,0.52), vec3(0.85,0.57,0.38), warmth * 0.88);
}
vec3 haze(vec3 color, vec3 world) {
  vec3 offset = world-cameraPosition;
  float distanceToEye = length(offset);
  vec3 direction = offset / max(distanceToEye,1.0);
  vec3 mist = horizon(direction);
  float a = 1.0-exp(-distanceToEye*0.000056);
  color = mix(color,mist,a);
  // Integrate a pair of thin, drifting mist layers only over the visible ray segment.
  float y = direction.y < 0.0 ? min(direction.y,-0.001) : max(direction.y,0.001);
  float coverage = 0.0;
  for (int layer=0; layer<2; ++layer) {
    float base = 28.0+float(layer)*44.0;
    float top = base+38.0;
    float t0 = (base-cameraPosition.y)/y, t1 = (top-cameraPosition.y)/y;
    float start = clamp(min(t0,t1),0.0,distanceToEye);
    float end = clamp(max(t0,t1),0.0,distanceToEye);
    vec2 point = cameraPosition.xz + direction.xz*mix(start,end,0.65);
    float patches = fbm(point*vec2(0.00071,0.00139)+vec2(uTime*0.011,-uTime*0.006)+float(layer)*8.2);
    float density = smoothstep(0.34,0.71,patches);
    coverage += (end-start)*density*(layer==0 ? 0.0025 : 0.0019);
  }
  return mix(color, mist*0.74+vec3(0.13,0.16,0.17), (1.0-exp(-coverage))*0.73);
}
`;

export function sky(time) {
  const mesh = new Mesh(new SphereGeometry(67_000, 32, 18), new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uTime: time, uSun: { value: sun } },
    vertexShader: `
      varying vec3 vSky;
      void main() {
        vSky = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSky;
      ${noiseGLSL}
      ${atmosphereGLSL}
      void main() {
        vec3 d = normalize(vSky);
        float up = max(d.y,0.0);
        vec3 rim = horizon(d);
        vec3 color = mix(rim,vec3(0.111,0.235,0.34),smoothstep(0.0,0.65,pow(up,0.69)));
        color = mix(color,vec3(0.23,0.28,0.32),smoothstep(0.0,0.24,-d.y));
        float s = max(dot(d,uSun),0.0);
        color += vec3(1.0,0.45,0.16)*(0.31*pow(s,13.0)+0.57*pow(s,68.0));
        float projection = max(d.y+0.12,0.12);
        vec2 p = d.xz/projection*vec2(2.0,3.8) + vec2(uTime*0.009,0.0);
        vec2 billows = p + vec2(fbm(p*0.8),fbm(p*0.53+11.0))*1.9;
        float cloud = fbm(billows)*0.89 + noise2(billows*8.0)*0.11;
        float cloudAlpha = smoothstep(0.42,0.71,cloud)*smoothstep(0.005,0.095,d.y);
        vec3 cloudColor = mix(vec3(0.215,0.24,0.32),vec3(0.79,0.55,0.43),0.18+pow(s,4.0)*0.7);
        cloudColor += smoothstep(0.48,0.64,cloud)*vec3(0.18,0.12,0.09);
        color = mix(color,cloudColor,cloudAlpha*0.69);
        color += smoothstep(0.99989,0.99995,s)*vec3(1.85,0.97,0.48)*(1.0-cloudAlpha*0.8);
        color += (hash21(gl_FragCoord.xy)-0.5)*0.004;
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
