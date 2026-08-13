export type UVRect = [number, number, number, number];

export interface SpriteInstance {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  g: number;
  b: number;
  a: number;
  uv?: UVRect;
  flash?: number;
}

const ATLAS = 512;

function rect(x: number, y: number, w: number, h: number): UVRect {
  return [x / ATLAS, y / ATLAS, w / ATLAS, h / ATLAS];
}

export const UV = {
  square: rect(0, 0, 64, 64),
  circle: rect(64, 0, 64, 64),
  ring: rect(128, 0, 64, 64),
  diamond: rect(192, 0, 64, 64),
  spark: rect(256, 0, 64, 64),
  digit: (d: number): UVRect => rect(d * 40, 96, 40, 64),
};

function buildAtlas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = ATLAS;
  c.height = ATLAS;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 64, 64);

  const grad = ctx.createRadialGradient(96, 32, 4, 96, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(96, 32, 31, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(160, 32, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.save();
  ctx.translate(224, 32);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-20, -20, 40, 40);
  ctx.restore();

  ctx.save();
  ctx.translate(288, 32);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 28 : 9;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let d = 0; d <= 9; d++) {
    ctx.fillText(String(d), d * 40 + 20, 96 + 32);
  }

  return c;
}

const VERT = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aPos;
layout(location = 2) in vec2 aSize;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aUV;
layout(location = 5) in float aFlash;
uniform vec2 uResolution;
uniform vec2 uCamera;
out vec2 vUV;
out vec4 vColor;
out float vFlash;
void main() {
  vec2 world = aPos + aCorner * aSize;
  vec2 screen = (world - uCamera) / uResolution * 2.0;
  gl_Position = vec4(screen.x, -screen.y, 0.0, 1.0);
  vUV = aUV.xy + (aCorner + 0.5) * aUV.zw;
  vColor = aColor;
  vFlash = aFlash;
}`;

const FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uAtlas;
in vec2 vUV;
in vec4 vColor;
in float vFlash;
out vec4 outColor;
void main() {
  vec4 tex = texture(uAtlas, vUV);
  vec4 tinted = tex * vColor;
  vec4 flashColor = vec4(0.75, 0.75, 0.75, tinted.a);
  outColor = mix(tinted, flashColor, clamp(vFlash, 0.0, 1.0));
}`;

const POST_VERT = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 aCorner;
out vec2 vUV;
void main() {
  vUV = aCorner + 0.5;
  gl_Position = vec4(aCorner * 2.0, 0.0, 1.0);
}`;

const BRIGHT_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUV);
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  outColor = lum > 0.8 ? c : vec4(0.0);
}`;

const BLUR_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uDir;
in vec2 vUV;
out vec4 outColor;
void main() {
  vec4 sum = texture(uTex, vUV) * 0.227;
  sum += texture(uTex, vUV + uDir * 1.384) * 0.316;
  sum += texture(uTex, vUV - uDir * 1.384) * 0.316;
  sum += texture(uTex, vUV + uDir * 3.230) * 0.070;
  sum += texture(uTex, vUV - uDir * 3.230) * 0.070;
  outColor = sum;
}`;

const COMPOSITE_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
in vec2 vUV;
out vec4 outColor;
void main() {
  outColor = texture(uScene, vUV) + texture(uBloom, vUV) * 0.35;
}`;

const FLOATS_PER_INSTANCE = 13;
const INITIAL_CAPACITY = 4096;

interface PostTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

export class Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuffer: WebGLBuffer;
  private data: Float32Array;
  private count = 0;
  private capacity = INITIAL_CAPACITY;
  private uResolution: WebGLUniformLocation;
  private uCamera: WebGLUniformLocation;
  private postVao: WebGLVertexArrayObject | null = null;
  private postBuffer: WebGLBuffer | null = null;
  private brightProgram: WebGLProgram | null = null;
  private blurProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;
  private sceneTarget: PostTarget | null = null;
  private bloomA: PostTarget | null = null;
  private bloomB: PostTarget | null = null;
  private atlasTex: WebGLTexture | null = null;
  readonly bloomEnabled: boolean;
  readonly gpuName: string;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly naive = false
  ) {
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    this.program = this.link(VERT, FRAG);
    gl.useProgram(this.program);
    this.uResolution = this.uniform("uResolution");
    this.uCamera = this.uniform("uCamera");

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const quad = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    const quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer()!;
    this.data = new Float32Array(this.capacity * FLOATS_PER_INSTANCE);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_INSTANCE * 4;
    const attr = (loc: number, size: number, offset: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    attr(1, 2, 0);
    attr(2, 2, 2);
    attr(3, 4, 4);
    attr(4, 4, 8);
    attr(5, 1, 12);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const tex = gl.createTexture()!;
    this.atlasTex = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      buildAtlas()
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, "uAtlas"), 0);

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    this.gpuName = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : "unknown GPU";

    this.bloomEnabled = !naive && this.initPost();
  }

  private initPost(): boolean {
    const gl = this.gl;
    try {
      this.brightProgram = this.link(POST_VERT, BRIGHT_FRAG);
      this.blurProgram = this.link(POST_VERT, BLUR_FRAG);
      this.compositeProgram = this.link(POST_VERT, COMPOSITE_FRAG);

      this.postVao = gl.createVertexArray()!;
      gl.bindVertexArray(this.postVao);
      const quad = gl.createBuffer()!;
      this.postBuffer = quad;
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      return true;
    } catch {
      return false;
    }
  }

  private createTarget(width: number, height: number): PostTarget {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(
        `FBO incomplete: 0x${status.toString(16)} at ${width}x${height}`
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, width, height };
  }

  private ensureTargets() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    const gl = this.gl;
    if (
      !this.sceneTarget ||
      this.sceneTarget.width !== w ||
      this.sceneTarget.height !== h
    ) {
      for (const t of [this.sceneTarget, this.bloomA, this.bloomB]) {
        if (t) {
          gl.deleteFramebuffer(t.fbo);
          gl.deleteTexture(t.tex);
        }
      }
      this.sceneTarget = this.createTarget(w, h);
      this.bloomA = this.createTarget(bw, bh);
      this.bloomB = this.createTarget(bw, bh);
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  begin(cameraX: number, cameraY: number) {
    this.count = 0;
    const gl = this.gl;
    if (this.bloomEnabled) {
      this.ensureTargets();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget!.fbo);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uCamera, cameraX, cameraY);
    gl.clearColor(0.043, 0.055, 0.078, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  push(s: SpriteInstance) {
    if (this.count === this.capacity) this.grow();
    const o = this.count * FLOATS_PER_INSTANCE;
    const d = this.data;
    d[o] = s.x;
    d[o + 1] = s.y;
    d[o + 2] = s.w;
    d[o + 3] = s.h;
    d[o + 4] = s.r;
    d[o + 5] = s.g;
    d[o + 6] = s.b;
    d[o + 7] = s.a;
    const uv = s.uv ?? UV.square;
    d[o + 8] = uv[0];
    d[o + 9] = uv[1];
    d[o + 10] = uv[2];
    d[o + 11] = uv[3];
    d[o + 12] = s.flash ?? 0;
    this.count++;
  }

  flush() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.data,
      0,
      this.count * FLOATS_PER_INSTANCE
    );
    if (this.naive) {
      for (let i = 0; i < this.count; i++) {
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          0,
          this.data,
          i * FLOATS_PER_INSTANCE,
          FLOATS_PER_INSTANCE
        );
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
      }
    } else {
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
    gl.bindVertexArray(null);
  }

  endFrame() {
    if (!this.bloomEnabled) return;
    const gl = this.gl;
    const scene = this.sceneTarget!;
    const a = this.bloomA!;
    const b = this.bloomB!;

    gl.disable(gl.BLEND);

    gl.bindVertexArray(this.postVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.postBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
    gl.viewport(0, 0, a.width, a.height);
    gl.useProgram(this.brightProgram!);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(gl.getUniformLocation(this.brightProgram!, "uTex"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(this.blurProgram!);
    gl.uniform1i(gl.getUniformLocation(this.blurProgram!, "uTex"), 0);
    const uDir = gl.getUniformLocation(this.blurProgram!, "uDir");
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
      gl.viewport(0, 0, b.width, b.height);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform2f(uDir, 1 / a.width, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
      gl.bindTexture(gl.TEXTURE_2D, b.tex);
      gl.uniform2f(uDir, 0, 1 / a.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compositeProgram!);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram!, "uScene"), 0);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram!, "uBloom"), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }

  get spriteCount() {
    return this.count;
  }

  get vramBytes() {
    let bytes = this.data.byteLength + 32 + ATLAS * ATLAS * 4;
    for (const t of [this.sceneTarget, this.bloomA, this.bloomB]) {
      if (t) bytes += t.width * t.height * 4;
    }
    return bytes;
  }

  private grow() {
    this.capacity *= 2;
    const next = new Float32Array(this.capacity * FLOATS_PER_INSTANCE);
    next.set(this.data);
    this.data = next;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.data.byteLength,
      this.gl.DYNAMIC_DRAW
    );
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
    }
    return shader;
  }

  private link(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    return program;
  }

  private uniform(name: string): WebGLUniformLocation {
    const loc = this.gl.getUniformLocation(this.program, name);
    if (!loc) throw new Error(`missing uniform ${name}`);
    return loc;
  }
}
