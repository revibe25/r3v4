// visual/shader-engine.tsx

const _fragment = `
uniform float time;
uniform float energy;

float noise(vec2 p){
  return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / 1000.0;
  float n = noise(uv * time);
  float glow = energy * 2.0;
  gl_FragColor = vec4(uv.x + n * glow, uv.y, glow, 1.0);
}
`;
