import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { atmosphereGLSL, noiseGLSL, sun } from './sky.js';

export function water(field, time) {
  const plane = new Mesh(new PlaneGeometry(134_000, 134_000).rotateX(-Math.PI / 2), new ShaderMaterial({
    uniforms: {
      uTime: time,
      uSun: { value: sun },
      uShore: { value: field.shorelineTexture() },
      uSpan: { value: field.meta.spanMeters },
      uTexel: { value: 1 / field.size },
      uSpacing: { value: field.spacing },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uShore;
      uniform float uSpan, uTexel, uSpacing;
      varying vec3 vWorld;
      ${noiseGLSL}
      ${atmosphereGLSL}
      void main() {
        vec2 p = vWorld.xz;
        vec3 ray = vWorld-cameraPosition;
        float distanceToEye = length(ray);
        vec3 eye = -ray/max(distanceToEye,1.0);
        float t = uTime;
        float warp = noise2(p*0.017+t*0.005)*4.8;
        float w1 = dot(p,vec2(0.091,0.133))+t*1.33+warp;
        float w2 = dot(p,vec2(-0.122,0.067))+t*1.05-warp*0.78;
        float w3 = dot(p,vec2(0.285,-0.159))+t*1.87;
        float w4 = dot(p,vec2(0.551,0.615))+t*2.47;
        vec2 ripple = vec2(0.091,0.133)*cos(w1)*0.30*(1.0-smoothstep(0.9,2.8,fwidth(w1)));
        ripple += vec2(-0.122,0.067)*cos(w2)*0.37*(1.0-smoothstep(0.9,2.8,fwidth(w2)));
        ripple += vec2(0.285,-0.159)*cos(w3)*0.15*(1.0-smoothstep(0.8,2.4,fwidth(w3)));
        ripple += vec2(0.551,0.615)*cos(w4)*0.061*(1.0-smoothstep(0.6,1.9,fwidth(w4)));
        ripple *= 1.0-smoothstep(1700.0,6200.0,distanceToEye);
        vec3 normal = normalize(vec3(-ripple.x,1.0,-ripple.y));
        float fresnel = pow(1.0-max(dot(normal,eye),0.0),4.0);
        float swells = noise2(p*vec2(0.0038,0.0045)+t*vec2(0.016,-0.009));
        vec3 deep = mix(vec3(0.009,0.058,0.077),vec3(0.029,0.122,0.144),swells);
        vec3 reflected = horizon(reflect(-eye,normal))*vec3(0.38,0.53,0.63);
        vec3 color = mix(deep,reflected,0.12+0.79*fresnel);
        float specular = max(dot(normal,normalize(uSun+eye)),0.0);
        color += vec3(1.0,0.56,0.28)*(0.46*pow(specular,142.0)+0.075*pow(specular,34.0));

        vec2 uv = p/uSpan+0.5;
        if (all(greaterThanEqual(uv,vec2(0))) && all(lessThanEqual(uv,vec2(1)))) {
          float shore = texture2D(uShore,uv*(1.0-uTexel)+0.5*uTexel).r*uSpacing*9.0;
          if (shore < 102.0) {
            float flecks = fbm(p*vec2(0.166,0.196)+vec2(t*0.13,-t*0.09));
            float breakup = noise2(p*0.038+t*0.038);
            float wave = 0.5+0.5*sin(shore*0.33+t*1.82+breakup*4.0);
            float wash = (1.0-smoothstep(17.0,80.0,shore));
            color = mix(color,vec3(0.042,0.235,0.22),wash*0.39);
            float foam = smoothstep(0.42,0.83,flecks+0.19*wave)*wash;
            float edge = (1.0-smoothstep(2.0,17.0,shore))*(0.46+0.58*breakup);
            color = mix(color,vec3(0.63,0.75,0.71),clamp(foam*0.72+edge*0.73,0.0,0.83));
          }
        }
        gl_FragColor = vec4(haze(color,vWorld),1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  plane.name = 'Deniz · 0 m';
  return plane;
}
