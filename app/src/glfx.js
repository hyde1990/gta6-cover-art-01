// Vice Cover Studio round 6 — the WebGL2 grade pipeline.
//
// The 2D engine (cover.js) paints the cover's base image; this module runs
// it through the GPU: bright-pass + blur for the neon bloom, then one
// composite shader for the grade, halftone band, film grain, the drifting
// light sweep, the vignette and the data particles. The preview animates
// (uTime moves); exports freeze uTime at 0, so the PNG is byte-stable.
//
// No WebGL2 (old browser, headless without GL)? The caller falls back to
// cover.js's applyFallbackGrade instead — the app still works.
import { VERT_SRC, BRIGHT_SRC, BLUR_SRC, COMPOSITE_SRC } from './shaders.js';

export function webgl2Available() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

// Grade names in the same order the composite shader expects them.
export function gradeIndex(grade) {
  if (grade === 'midnight') return 1;
  if (grade === 'ink') return 2;
  if (grade === 'neon') return 3;
  return 0;
}

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Vice Cover Studio shader failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function linkProgram(gl, fragSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Vice Cover Studio program failed: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function makeTarget(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

export class GradePipeline {
  constructor() {
    this.gl = null;
    this.ok = false;
    this.baseVersion = -1;
  }

  // Bind the pipeline to an output canvas. Returns false when WebGL2
  // cannot start, so the caller can fall back to the 2D finish.
  init(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return false;
    this.gl = gl;
    this.canvas = canvas;
    try {
      this.brightProg = linkProgram(gl, BRIGHT_SRC);
      this.blurProg = linkProgram(gl, BLUR_SRC);
      this.compProg = linkProgram(gl, COMPOSITE_SRC);
    } catch {
      return false;
    }
    // One fullscreen quad, interleaved positions + UVs.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    this.vao = vao;

    this.baseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.targets = null;
    this.targetSize = '';
    this.ok = true;
    return true;
  }

  ensureTargets(w, h) {
    const key = `${w}x${h}`;
    if (this.targetSize === key) return;
    const gl = this.gl;
    if (this.targets) {
      for (const t of this.targets) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.tex);
      }
    }
    const hw = Math.max(2, Math.floor(w / 2));
    const hh = Math.max(2, Math.floor(h / 2));
    this.targets = [makeTarget(gl, hw, hh), makeTarget(gl, hw, hh), makeTarget(gl, hw, hh)];
    this.targetSize = key;
  }

  // source: a 2D canvas holding the base cover. version: a counter the
  // caller bumps whenever the base image changes, so the texture upload
  // happens once per edit instead of once per animation frame.
  render(source, opts, version) {
    if (!this.ok) return false;
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return false;
    this.ensureTargets(w, h);
    const [bright, blurA, blurB] = this.targets;

    if (version !== this.baseVersion) {
      gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.baseVersion = version;
    }

    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // Pass 1: bright-pass at half resolution.
    gl.bindFramebuffer(gl.FRAMEBUFFER, bright.fbo);
    gl.viewport(0, 0, bright.w, bright.h);
    gl.useProgram(this.brightProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.uniform1i(gl.getUniformLocation(this.brightProg, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.brightProg, 'uThreshold'), 0.62);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 2+3: separable Gaussian blur, horizontal then vertical.
    gl.useProgram(this.blurProg);
    gl.uniform1i(gl.getUniformLocation(this.blurProg, 'uTex'), 0);
    const dirLoc = gl.getUniformLocation(this.blurProg, 'uDir');
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo);
    gl.viewport(0, 0, blurA.w, blurA.h);
    gl.bindTexture(gl.TEXTURE_2D, bright.tex);
    gl.uniform2f(dirLoc, 1 / blurA.w, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo);
    gl.viewport(0, 0, blurB.w, blurB.h);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform2f(dirLoc, 0, 1 / blurB.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 4: composite to the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.uniform1i(gl.getUniformLocation(this.compProg, 'uTex'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform1i(gl.getUniformLocation(this.compProg, 'uBloom'), 1);
    gl.uniform1f(gl.getUniformLocation(this.compProg, 'uTime'), opts.time || 0);
    gl.uniform1f(gl.getUniformLocation(this.compProg, 'uGlow'), opts.glow ?? 0.7);
    gl.uniform1i(gl.getUniformLocation(this.compProg, 'uGrade'), gradeIndex(opts.grade || 'neon'));
    gl.uniform1f(gl.getUniformLocation(this.compProg, 'uSweep'), opts.sweep ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(this.compProg, 'uSize'), w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
}
