export interface SpriteInstance {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const VERT = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aPos;
layout(location = 2) in vec2 aSize;
layout(location = 3) in vec4 aColor;
uniform vec2 uResolution;
uniform vec2 uCamera;
out vec4 vColor;
void main() {
  vec2 world = aPos + aCorner * aSize;
  vec2 screen = (world - uCamera) / uResolution * 2.0;
  gl_Position = vec4(screen.x, -screen.y, 0.0, 1.0);
  vColor = aColor;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vColor; }`;

const FLOATS_PER_INSTANCE = 8;
const INITIAL_CAPACITY = 4096;

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

  constructor(private canvas: HTMLCanvasElement) {
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
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(3, 1);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    this.gpuName = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : "unknown GPU";
  }

  readonly gpuName: string;

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  begin(cameraX: number, cameraY: number) {
    this.count = 0;
    this.gl.useProgram(this.program);
    this.gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.uCamera, cameraX, cameraY);
    this.gl.clearColor(0.043, 0.055, 0.078, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  push(s: SpriteInstance) {
    if (this.count === this.capacity) this.grow();
    const o = this.count * FLOATS_PER_INSTANCE;
    this.data[o] = s.x;
    this.data[o + 1] = s.y;
    this.data[o + 2] = s.w;
    this.data[o + 3] = s.h;
    this.data[o + 4] = s.r;
    this.data[o + 5] = s.g;
    this.data[o + 6] = s.b;
    this.data[o + 7] = s.a;
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
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
  }

  get spriteCount() {
    return this.count;
  }

  get vramBytes() {
    return this.data.byteLength + 32;
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
