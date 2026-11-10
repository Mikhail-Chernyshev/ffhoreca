import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';
import type { Feature, GeoJsonProperties, Geometry, Position } from 'geojson';
import { getCachedFlagImage, loadCountryFlag } from './loadCountryFlag';

const FALLBACK_FILL = 'rgba(95, 165, 115, 0.3)';
const FLAG_OPACITY = 0.72;

type FlagFeature = Feature<Geometry | null, GeoJsonProperties | null>;

function polygonsOf(geom: Geometry): Position[][][] {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0 || imgW <= 0 || imgH <= 0) return;
  const ir = imgW / imgH;
  const br = w / h;
  let dw: number;
  let dh: number;
  let dx: number;
  let dy: number;
  if (ir > br) {
    dh = h;
    dw = h * ir;
    dx = x + (w - dw) / 2;
    dy = y;
  } else {
    dw = w;
    dh = w / ir;
    dx = x;
    dy = y + (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

export class CountryFlagFillLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private readonly getFeatures: () => FlagFeature[];
  private readonly maxZoom: number;
  private map: MapLibreMap | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private aPos = 0;
  private uTex: WebGLUniformLocation | null = null;

  constructor(opts: {
    id: string;
    getFeatures: () => FlagFeature[];
    maxZoom: number;
  }) {
    this.id = opts.id;
    this.getFeatures = opts.getFeatures;
    this.maxZoom = opts.maxZoom;
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    const vs = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `attribute vec2 a_pos;
       varying vec2 v_uv;
       void main() {
         v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
         gl_Position = vec4(a_pos, 0.0, 1.0);
       }`,
    );
    const fs = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `precision mediump float;
       varying vec2 v_uv;
       uniform sampler2D u_tex;
       void main() {
         vec4 c = texture2D(u_tex, v_uv);
         gl_FragColor = vec4(c.rgb * c.a, c.a);
       }`,
    );
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;
    this.aPos = gl.getAttribLocation(program, 'a_pos');
    this.uTex = gl.getUniformLocation(program, 'u_tex');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.buffer = buffer;
    this.texture = gl.createTexture();
    this.preloadFlags();
  }

  onRemove(_map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.texture) gl.deleteTexture(this.texture);
    this.program = null;
    this.buffer = null;
    this.texture = null;
    this.canvas = null;
    this.ctx = null;
    this.map = null;
  }

  render(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    _options: CustomRenderMethodInput,
  ): void {
    const map = this.map;
    const canvas = this.canvas;
    const ctx = this.ctx;
    const program = this.program;
    const buffer = this.buffer;
    const texture = this.texture;
    if (!map || !canvas || !ctx || !program || !buffer || !texture) return;
    if (map.getZoom() >= this.maxZoom) return;

    this.paintFlags(map, canvas, ctx);
    if (canvas.width < 1 || canvas.height < 1) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.uniform1i(this.uTex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private preloadFlags(): void {
    const repaint = () => this.map?.triggerRepaint();
    for (const feature of this.getFeatures()) {
      const iso = feature.properties?.iso;
      if (feature.properties?.visited === true && typeof iso === 'string') {
        loadCountryFlag(iso, repaint);
      }
    }
  }

  private paintFlags(
    map: MapLibreMap,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ): void {
    this.preloadFlags();
    const glCanvas = map.getCanvas();
    const cssW = glCanvas.clientWidth;
    const cssH = glCanvas.clientHeight;
    if (cssW < 1 || cssH < 1) return;

    const dpr = glCanvas.width / cssW || 1;
    if (canvas.width !== glCanvas.width || canvas.height !== glCanvas.height) {
      canvas.width = glCanvas.width;
      canvas.height = glCanvas.height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const pad = 64;
    const repaint = () => this.map?.triggerRepaint();

    for (const feature of this.getFeatures()) {
      const props = feature.properties;
      if (!props || props.visited !== true) continue;
      const iso = props.iso;
      if (typeof iso !== 'string' || !feature.geometry) continue;
      const flag = getCachedFlagImage(iso) ?? loadCountryFlag(iso, repaint);

      for (const rings of polygonsOf(feature.geometry)) {
        const outer = rings[0];
        if (!outer || outer.length < 3) continue;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const projected: { x: number; y: number }[][] = [];

        for (const ring of rings) {
          const pts: { x: number; y: number }[] = [];
          for (const pos of ring) {
            const lng = pos[0];
            const lat = pos[1];
            if (typeof lng !== 'number' || typeof lat !== 'number') continue;
            const p = map.project([lng, lat]);
            pts.push(p);
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
          if (pts.length >= 3) projected.push(pts);
        }

        if (
          projected.length === 0 ||
          maxX < -pad ||
          maxY < -pad ||
          minX > cssW + pad ||
          minY > cssH + pad
        ) {
          continue;
        }

        ctx.save();
        ctx.beginPath();
        for (const pts of projected) {
          ctx.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
          ctx.closePath();
        }
        ctx.clip('evenodd');
        ctx.globalAlpha = FLAG_OPACITY;
        if (flag) {
          drawImageCover(
            ctx,
            flag,
            flag.naturalWidth || flag.width,
            flag.naturalHeight || flag.height,
            minX,
            minY,
            maxX - minX,
            maxY - minY,
          );
        } else {
          ctx.fillStyle = FALLBACK_FILL;
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}
