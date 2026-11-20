// Vice Cover Studio round 5 — GLSL sources for the WebGL2 grade pipeline.
// Kept as plain strings (no fetch, no extra files): glfx.js compiles them.
// The pipeline is: base cover texture -> bright-pass -> 2x blur (bloom) ->
// composite (bloom + sunset grade + halftone + grain + light sweep + vignette).

export const VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUV;
out vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Keep only the hot highlights, for the bloom pass. Anything below the
// threshold dies to black; the rest is scaled up so the blur glows.
export const BRIGHT_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uThreshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(uTex, vUV).rgb;
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  float keep = smoothstep(uThreshold, uThreshold + 0.25, luma);
  fragColor = vec4(c * keep * 1.6, 1.0);
}
`;

// One direction of a 9-tap separable Gaussian blur. uDir is (1,0) or (0,1)
// in texel units, so the same shader blurs both ways.
export const BLUR_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 fragColor;
void main() {
  vec3 acc = texture(uTex, vUV).rgb * 0.227027;
  vec2 o1 = uDir * 1.384615;
  vec2 o2 = uDir * 3.230769;
  acc += texture(uTex, vUV + o1).rgb * 0.3162162;
  acc += texture(uTex, vUV - o1).rgb * 0.3162162;
  acc += texture(uTex, vUV + o2).rgb * 0.0702703;
  acc += texture(uTex, vUV - o2).rgb * 0.0702703;
  fragColor = vec4(acc, 1.0);
}
`;

// The final grade. uGrade: 0 sunset, 1 midnight, 2 ink. uTime drives the
// animated light sweep in the live preview (frozen at 0 for PNG exports).
// uSweep 0 hides the sweep entirely.
export const COMPOSITE_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform sampler2D uBloom;
uniform float uTime;
uniform float uGlow;
uniform int uGrade;
uniform float uSweep;
uniform vec2 uSize;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Warm sunset grade: lift the shadows toward violet, push the mids toward
// amber, keep the highlights hot. Midnight cools everything toward violet;
// ink crushes it toward a silver duotone.
vec3 gradeColor(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  if (uGrade == 1) {
    return mix(vec3(0.05, 0.04, 0.16), vec3(0.55, 0.45, 1.0), pow(l, 0.8)) * 0.9 + c * 0.25;
  }
  if (uGrade == 2) {
    return vec3(l) * vec3(1.05, 1.0, 0.95);
  }
  vec3 shadow = vec3(0.16, 0.05, 0.30);
  vec3 mid = vec3(1.0, 0.55, 0.25);
  vec3 hi = vec3(1.0, 0.92, 0.72);
  vec3 graded = mix(shadow, mid, smoothstep(0.0, 0.55, l));
  graded = mix(graded, hi, smoothstep(0.55, 1.0, l));
  return graded * 0.55 + c * 0.55;
}

void main() {
  vec3 base = texture(uTex, vUV).rgb;
  vec3 bloom = texture(uBloom, vUV).rgb;
  vec3 c = gradeColor(base) + bloom * uGlow;

  // Halftone dots over the dark title band at the bottom of the cover.
  float band = smoothstep(0.80, 0.84, vUV.y);
  vec2 dotUV = vUV * uSize / 9.0;
  vec2 cell = fract(dotUV) - 0.5;
  float dotR = 0.32 + 0.18 * sin(dotUV.x * 1.7 + dotUV.y * 2.3);
  float dotAmt = smoothstep(dotR, dotR - 0.12, length(cell));
  c = mix(c, c * 0.82 + vec3(0.10, 0.04, 0.14) * 0.18, dotAmt * band * 0.55);

  // A diagonal shaft of sunset light that drifts across the cover.
  if (uSweep > 0.5) {
    float sweepX = -0.35 + mod(uTime * 0.14, 1.7);
    float d = abs((vUV.x - vUV.y * 0.35) - sweepX);
    float shaft = smoothstep(0.22, 0.0, d) * 0.16;
    c += vec3(1.0, 0.75, 0.45) * shaft;
  }

  // Film grain, seeded per frame so the preview shimmers but an export
  // (uTime frozen) stays byte-stable.
  float g = hash(vUV * uSize + fract(uTime) * 91.7) - 0.5;
  c += g * 0.045;

  // Vignette: darken the corners so the panels sit forward.
  vec2 q = vUV - 0.5;
  float vig = 1.0 - dot(q, q) * 0.55;
  c *= clamp(vig, 0.0, 1.0);

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
