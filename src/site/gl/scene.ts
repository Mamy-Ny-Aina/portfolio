import { buildShapes, SHAPES, type ShapeName } from './shapes';
import { lookAt, modelMatrix, perspective } from './mat4';

// Champ de particules WebGL2 : une seule passe de rendu, aucun framework 3D.
// Les particules glissent d'une forme à l'autre au fil du défilement.

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aFrom;
layout(location = 1) in vec3 aTo;
layout(location = 2) in vec4 aRand;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uMorph;
uniform float uTime;
uniform float uIntro;
uniform float uPixelRatio;
uniform float uSize;
uniform float uAlpha;
uniform vec3 uPointer;
uniform float uPointerForce;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
out vec3 vColor;
out float vAlpha;

vec3 randDir(vec4 r) {
  float a = r.y * 6.2831853;
  float z = r.z * 2.0 - 1.0;
  float s = sqrt(max(0.0, 1.0 - z * z));
  return vec3(cos(a) * s, sin(a) * s, z);
}

void main() {
  float delay = aRand.z * 0.38;
  float t = clamp((uMorph - delay) / 0.62, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(aFrom, aTo, t);
  vec3 dir = randDir(aRand);
  float travel = sin(t * 3.14159265);
  p += dir * travel * (0.22 + aRand.x * 0.42);

  float ph = aRand.y * 6.2831853;
  p += 0.03 * vec3(sin(uTime * 0.7 + ph), cos(uTime * 0.53 + ph * 1.3), sin(uTime * 0.61 + ph * 0.7));
  p = mix(p, dir * (3.2 + aRand.x * 7.0), uIntro);

  vec4 world = uModel * vec4(p, 1.0);
  vec2 d = world.xy - uPointer.xy;
  float dist = length(d);
  float f = uPointerForce * smoothstep(1.15, 0.0, dist);
  world.xy += (d / max(dist, 0.0001)) * f * 0.42;
  world.z += f * 0.3;

  vec4 viewPos = uView * world;
  gl_Position = uProj * viewPos;

  float hot = step(0.999, aRand.w);
  float size = uSize * (0.55 + aRand.x * 0.95) * (1.0 + hot * 1.1);
  gl_PointSize = max(1.0, size * uPixelRatio / -viewPos.z);

  float twinkle = 0.72 + 0.28 * sin(uTime * (1.1 + aRand.x * 2.2) + ph * 3.0);
  vAlpha = uAlpha * (0.32 + 0.68 * aRand.x) * twinkle * (1.0 - uIntro * 0.55) * (1.0 + hot * 0.8);
  vAlpha *= smoothstep(15.0, 4.5, -viewPos.z);
  vColor = mix(uColA, uColB, smoothstep(0.72, 0.97, aRand.w));
  vColor = mix(vColor, uColC, hot);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c) * 4.0;
  if (r > 1.0) discard;
  float a = 1.0 - r;
  a = a * a * vAlpha;
  outColor = vec4(vColor * a, a);
}`;

export interface ShapeLayout {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  tilt: number;
  /** Vitesse de rotation continue (rad/s) ; 0 pour les formes plates qui restent face au visiteur. */
  spin: number;
  /** Amplitude du balancement des formes plates (rad). */
  swing: number;
}

const DESKTOP: Record<ShapeName, ShapeLayout> = {
  planet: { x: 1.55, y: 0.05, scale: 1.0, alpha: 1, tilt: 0.12, spin: 0.08, swing: 0 },
  madagascar: { x: 1.7, y: -0.05, scale: 1.06, alpha: 0.9, tilt: -0.32, spin: 0, swing: 0.3 },
  helix: { x: -2.15, y: 0, scale: 0.95, alpha: 0.62, tilt: 0.1, spin: 0.16, swing: 0 },
  wave: { x: 0.45, y: -0.35, scale: 1.0, alpha: 0.9, tilt: 0, spin: 0, swing: 0.2 },
  network: { x: 1.95, y: 0.05, scale: 0.85, alpha: 0.7, tilt: 0.05, spin: 0, swing: 0.42 },
  atom: { x: 2.05, y: 0.25, scale: 0.85, alpha: 0.65, tilt: 0.25, spin: 0.12, swing: 0 },
  portal: { x: 1.05, y: 0.15, scale: 0.95, alpha: 0.85, tilt: 0, spin: 0, swing: 0.22 },
};

const MOBILE: Record<ShapeName, ShapeLayout> = {
  planet: { x: 0, y: 0.95, scale: 0.68, alpha: 0.85, tilt: 0.12, spin: 0.08, swing: 0 },
  madagascar: { x: 0.3, y: 0.15, scale: 0.95, alpha: 0.5, tilt: -0.3, spin: 0, swing: 0.25 },
  helix: { x: 0.5, y: 0.2, scale: 0.75, alpha: 0.38, tilt: 0.1, spin: 0.16, swing: 0 },
  wave: { x: 0, y: -0.5, scale: 0.62, alpha: 0.45, tilt: 0, spin: 0, swing: 0.2 },
  network: { x: 0.1, y: 0.4, scale: 0.6, alpha: 0.42, tilt: 0.05, spin: 0, swing: 0.4 },
  atom: { x: 0.2, y: 0.3, scale: 0.7, alpha: 0.42, tilt: 0.25, spin: 0.12, swing: 0 },
  portal: { x: 0, y: 0.6, scale: 0.75, alpha: 0.5, tilt: 0, spin: 0, swing: 0.2 },
};

const COLORS = {
  dark: { a: [0.94, 0.91, 0.86], b: [1.0, 0.42, 0.24], c: [1.0, 0.8, 0.5], size: 16, alpha: 1 },
  light: { a: [0.2, 0.18, 0.16], b: [0.9, 0.29, 0.11], c: [0.95, 0.42, 0.12], size: 14, alpha: 0.95 },
} as const;

const FOV = (38 * Math.PI) / 180;
const CAMERA_Z = 6.8;

export function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export class ParticleField {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private shapeBuffers = new Map<ShapeName, WebGLBuffer>();
  private randBuffer!: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private count: number;
  private hotCount: number;

  private proj = new Float32Array(16);
  private view = new Float32Array(16);
  private model = new Float32Array(16);

  private sequence: ShapeName[] = ['planet'];
  private targetProgress = 0;
  private progress = 0;
  private boundFrom: ShapeName | null = null;
  private boundTo: ShapeName | null = null;

  private pointer = { x: 0, y: 0, tx: 0, ty: 0, force: 0, targetForce: 0 };
  private camera = { x: 0, y: 0 };
  private intro = 1;
  private introStart = -1;
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private theme: 'dark' | 'light' = 'dark';
  private dpr = 1;
  private width = 1;
  private height = 1;
  private scrollY = 0;
  private focus = 0;
  private focusTarget = 0;
  private frameTimes: number[] = [];
  private degraded = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private options: { reducedMotion: boolean; mobile: boolean },
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 indisponible');
    this.gl = gl;
    const cores = navigator.hardwareConcurrency || 4;
    this.count = options.mobile ? 6500 : cores >= 8 ? 15000 : 11000;
    this.hotCount = Math.round(this.count * 0.012);
    this.dpr = Math.min(window.devicePixelRatio || 1, options.mobile ? 1.5 : 1.75);
    if (options.reducedMotion) this.intro = 0;
    this.init();
    this.resize();
    canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    return shader;
  }

  private init() {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    this.program = program;
    for (const name of ['uProj', 'uView', 'uModel', 'uMorph', 'uTime', 'uIntro', 'uPixelRatio', 'uSize', 'uAlpha', 'uPointer', 'uPointerForce', 'uColA', 'uColB', 'uColC']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    const shapes = buildShapes(this.count, this.hotCount);
    this.shapeBuffers.clear();
    for (const name of SHAPES) {
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, shapes[name], gl.STATIC_DRAW);
      this.shapeBuffers.set(name, buffer);
    }

    // Aléas par particule : taille, phase, délai de transition, couleur (1 = point chaud).
    const rand = new Float32Array(this.count * 4);
    let seed = 1234567;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < this.count; i++) {
      rand[i * 4] = next();
      rand[i * 4 + 1] = next();
      rand[i * 4 + 2] = next();
      rand[i * 4 + 3] = i >= this.count - this.hotCount ? 1 : next() * 0.985;
    }
    this.randBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.randBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.randBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    this.boundFrom = null;
    this.boundTo = null;
    this.bindShapes(this.sequence[0], this.sequence[0]);
    gl.bindVertexArray(null);
  }

  private bindShapes(from: ShapeName, to: ShapeName) {
    if (from === this.boundFrom && to === this.boundTo) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffers.get(from)!);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffers.get(to)!);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    this.boundFrom = from;
    this.boundTo = to;
  }

  /** Formes associées aux sections visibles, dans l'ordre de la page. */
  setSequence(shapes: ShapeName[]) {
    this.sequence = shapes.length ? shapes : ['planet'];
    this.targetProgress = Math.min(this.targetProgress, this.sequence.length - 1);
  }

  /** Position continue dans la séquence (ex. 1.4 = 40 % du passage de la forme 1 à la forme 2). */
  setProgress(value: number, immediate = false) {
    this.targetProgress = Math.max(0, Math.min(this.sequence.length - 1, value));
    if (immediate || this.options.reducedMotion) this.progress = this.targetProgress;
  }

  setScroll(y: number) {
    this.scrollY = y;
  }

  /** 0 = forme pleinement visible, 1 = lecture d'une section (les particules s'estompent). */
  setFocus(value: number) {
    this.focusTarget = Math.max(0, Math.min(1, value));
  }

  setTheme(theme: 'dark' | 'light') {
    this.theme = theme;
  }

  setPointer(ndcX: number, ndcY: number, active: boolean) {
    const halfH = Math.tan(FOV / 2) * CAMERA_Z;
    this.pointer.tx = ndcX * halfH * (this.width / this.height);
    this.pointer.ty = ndcY * halfH;
    this.pointer.targetForce = active && !this.options.reducedMotion ? 1 : 0;
  }

  playIntro() {
    if (this.options.reducedMotion) {
      this.intro = 0;
      return;
    }
    this.introStart = performance.now();
  }

  resize() {
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    perspective(this.proj, FOV, w / h, 0.1, 60);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.stop();
  };

  private onContextRestored = () => {
    this.init();
    this.resize();
    this.start();
  };

  private layoutFor(name: ShapeName): ShapeLayout {
    const portrait = this.width / this.height < 0.9;
    return (portrait ? MOBILE : DESKTOP)[name];
  }

  private frame(now: number) {
    const gl = this.gl;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.options.reducedMotion) this.time += dt;
    this.monitor(dt);

    // Progression lissée (inertie), indépendante du nombre d'images par seconde.
    const k = 1 - Math.exp(-dt * 5.5);
    this.progress += (this.targetProgress - this.progress) * k;
    const maxIndex = this.sequence.length - 1;
    const p = Math.max(0, Math.min(maxIndex, this.progress));
    const i = Math.min(Math.floor(p), Math.max(0, maxIndex - 1));
    const t = maxIndex === 0 ? 0 : Math.min(1, p - i);
    const from = this.sequence[i];
    const to = this.sequence[Math.min(i + 1, maxIndex)];
    this.bindShapes(from, to);

    if (this.introStart >= 0) {
      const e = Math.min(1, (now - this.introStart) / 2600);
      this.intro = Math.pow(1 - e, 3);
      if (e >= 1) this.introStart = -1;
    }

    // Disposition interpolée entre les deux formes.
    const A = this.layoutFor(from);
    const B = this.layoutFor(to);
    const s = smooth(t);
    const x = lerp(A.x, B.x, s);
    const y = lerp(A.y, B.y, s);
    const scale = lerp(A.scale, B.scale, s);
    const alpha = lerp(A.alpha, B.alpha, s);
    const tilt = lerp(A.tilt, B.tilt, s);
    const yawOf = (layout: ShapeLayout) =>
      layout.spin > 0
        ? this.time * layout.spin + this.scrollY * 0.00035
        : Math.sin(this.time * 0.22 + this.scrollY * 0.0006) * layout.swing;
    const yawA = yawOf(A);
    const delta = ((((yawOf(B) - yawA + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    const yaw = yawA + delta * s;
    this.focus += (this.focusTarget - this.focus) * Math.min(1, dt * 3);
    const dimmed = alpha * (1 - 0.6 * this.focus);

    // Pointeur et parallaxe de la caméra.
    this.pointer.x += (this.pointer.tx - this.pointer.x) * Math.min(1, dt * 6);
    this.pointer.y += (this.pointer.ty - this.pointer.y) * Math.min(1, dt * 6);
    this.pointer.force += (this.pointer.targetForce - this.pointer.force) * Math.min(1, dt * 3);
    const halfH = Math.tan(FOV / 2) * CAMERA_Z;
    const halfW = halfH * (this.width / this.height);
    this.camera.x += ((this.pointer.x / halfW) * 0.35 - this.camera.x) * Math.min(1, dt * 2);
    this.camera.y += ((this.pointer.y / halfH) * 0.25 - this.camera.y) * Math.min(1, dt * 2);

    lookAt(this.view, [this.camera.x, this.camera.y, CAMERA_Z], [0, 0, 0], [0, 1, 0]);
    modelMatrix(this.model, x, y, 0, tilt + Math.sin(this.time * 0.2) * 0.04, yaw, scale);

    const palette = COLORS[this.theme];
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    if (this.theme === 'dark') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    const u = this.uniforms;
    gl.uniformMatrix4fv(u.uProj, false, this.proj);
    gl.uniformMatrix4fv(u.uView, false, this.view);
    gl.uniformMatrix4fv(u.uModel, false, this.model);
    gl.uniform1f(u.uMorph, t);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uIntro, this.intro);
    gl.uniform1f(u.uPixelRatio, this.dpr);
    gl.uniform1f(u.uSize, palette.size);
    gl.uniform1f(u.uAlpha, dimmed * palette.alpha);
    gl.uniform3f(u.uPointer, this.pointer.x, this.pointer.y, 0);
    gl.uniform1f(u.uPointerForce, this.pointer.force);
    gl.uniform3fv(u.uColA, palette.a);
    gl.uniform3fv(u.uColB, palette.b);
    gl.uniform3fv(u.uColC, palette.c);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
  }

  /** Si l'appareil peine (moins de ~40 images/s), on réduit la résolution du rendu. */
  private monitor(dt: number) {
    if (this.degraded || this.intro > 0.05) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 120) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 0.025 && this.dpr > 1) {
      this.dpr = 1;
      this.degraded = true;
      this.resize();
    }
  }
}
