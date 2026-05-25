/**
 * 3D Rotating Cube visualizer effect.
 * Uses Canvas 2D with manual 3D projection (no Three.js dependency).
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig } from './types';
import { hexToRgba, lightenHex, darkenHex } from '../utils/color';
import { getBassAverage, getMidAverage, getHighAverage } from '../utils/audio-analysis';

/** 3D vertex */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 2D projected point */
interface Vec2 {
  x: number;
  y: number;
}

/** Cube face defined by 4 vertex indices */
interface Face {
  vertices: number[];
  color: string;
}

export class Cube3DEffect implements IVisualizerEffect {
  readonly id = 'cube3d';
  readonly name = '3D 立方体';
  readonly description = '频率驱动的 3D 旋转立方体，支持线框和半透明面';
  readonly icon = 'Box';

  // Unit cube vertices (centered at origin)
  private readonly baseVertices: Vec3[] = [
    { x: -1, y: -1, z: -1 }, // 0: left-bottom-back
    { x:  1, y: -1, z: -1 }, // 1: right-bottom-back
    { x:  1, y:  1, z: -1 }, // 2: right-top-back
    { x: -1, y:  1, z: -1 }, // 3: left-top-back
    { x: -1, y: -1, z:  1 }, // 4: left-bottom-front
    { x:  1, y: -1, z:  1 }, // 5: right-bottom-front
    { x:  1, y:  1, z:  1 }, // 6: right-top-front
    { x: -1, y:  1, z:  1 }, // 7: left-top-front
  ];

  // Cube edges (pairs of vertex indices)
  private readonly edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], // back face
    [4, 5], [5, 6], [6, 7], [7, 4], // front face
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ];

  // Cube faces (6 faces, each with 4 vertex indices)
  private readonly faces: Face[] = [];

  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private cubeSize = 80;
  private focalLength = 300;

  init(_width: number, _height: number): void {
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    // Initialize faces with placeholder colors
    this.faces = [
      { vertices: [0, 1, 2, 3], color: '' }, // back
      { vertices: [4, 5, 6, 7], color: '' }, // front
      { vertices: [0, 1, 5, 4], color: '' }, // bottom
      { vertices: [2, 3, 7, 6], color: '' }, // top
      { vertices: [0, 3, 7, 4], color: '' }, // left
      { vertices: [1, 2, 6, 5], color: '' }, // right
    ];
  }

  render(
    ctx: CanvasRenderingContext2D,
    frame: AudioDataFrame,
    theme: EffectTheme,
    config: EffectConfig,
    _transitionProgress: number,
  ): void {
    const { width: w, height: h, smoothed, isPlaying } = frame;
    const primary = theme.primary;
    const primaryLight = theme.secondary;
    const primaryDark = darkenHex(primary, 0.3);
    const speed = config.speed;
    const intensity = config.intensity;

    const cx = w / 2;
    const cy = h / 2;

    // Audio-driven rotation speeds
    const bass = getBassAverage(smoothed) / 255;
    const mid = getMidAverage(smoothed) / 255;
    const high = getHighAverage(smoothed) / 255;

    if (isPlaying) {
      this.rotX += (0.005 + bass * 0.03) * speed;
      this.rotY += (0.008 + mid * 0.04) * speed;
      this.rotZ += (0.003 + high * 0.02) * speed;
    }

    // Dynamic cube size based on overall volume
    const avgVol = (bass + mid + high) / 3;
    const size = this.cubeSize * (0.8 + avgVol * 0.6 * intensity);

    // Transform vertices
    const transformed = this.baseVertices.map((v) => {
      const scaled: Vec3 = { x: v.x * size, y: v.y * size, z: v.z * size };
      return this.rotateXYZ(scaled, this.rotX, this.rotY, this.rotZ);
    });

    // Project to 2D
    const projected = transformed.map((v) => this.project(v, cx, cy));

    // Draw faces (sorted by average Z for painter's algorithm)
    const faceColors = [
      hexToRgba(primary, 0.15 * intensity),       // back - primary
      hexToRgba(primaryLight, 0.2 * intensity),    // front - light
      hexToRgba(primaryDark, 0.15 * intensity),     // bottom - dark
      hexToRgba(primaryLight, 0.25 * intensity),    // top - light
      hexToRgba(primary, 0.1 * intensity),          // left - primary
      hexToRgba(primaryLight, 0.18 * intensity),    // right - light
    ];

    const facesWithZ = this.faces.map((face, idx) => {
      const avgZ = face.vertices.reduce((sum, vi) => sum + transformed[vi].z, 0) / 4;
      return { face, avgZ, idx };
    });
    facesWithZ.sort((a, b) => a.avgZ - b.avgZ); // Draw far faces first

    for (const { face, idx } of facesWithZ) {
      ctx.beginPath();
      const pts = face.vertices.map((vi) => projected[vi]);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = faceColors[idx] || hexToRgba(primary, 0.15);
      ctx.fill();
    }

    // Draw edges
    ctx.save();
    if (config.glow) {
      ctx.shadowColor = theme.glowColor || primary;
      ctx.shadowBlur = (5 + avgVol * 15) * config.glowIntensity;
    }
    ctx.strokeStyle = hexToRgba(primaryLight, 0.6 + avgVol * 0.4);
    ctx.lineWidth = 1.5 + avgVol * 1.5;
    ctx.lineCap = 'round';

    for (const [a, b] of this.edges) {
      ctx.beginPath();
      ctx.moveTo(projected[a].x, projected[a].y);
      ctx.lineTo(projected[b].x, projected[b].y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw vertices as glowing dots
    for (const pt of projected) {
      ctx.save();
      ctx.fillStyle = lightenHex(primaryLight, 0.3);
      if (config.glow) {
        ctx.shadowColor = theme.glowColor || primary;
        ctx.shadowBlur = 8 * config.glowIntensity;
      }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2 + avgVol * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw center glow
    const glowRadius = size * 0.3 + avgVol * 30 * intensity;
    const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    centerGlow.addColorStop(0, hexToRgba(primary, 0.1 * intensity));
    centerGlow.addColorStop(0.5, hexToRgba(primaryLight, 0.05 * intensity));
    centerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  resize(width: number, height: number): void {
    this.cubeSize = Math.min(width, height) * 0.2;
    this.focalLength = Math.min(width, height) * 0.8;
  }

  destroy(): void {
    // No resources to release
  }

  /** Rotate a 3D point around X, Y, Z axes */
  private rotateXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
    // Rotate around X
    let y1 = v.y * Math.cos(rx) - v.z * Math.sin(rx);
    let z1 = v.y * Math.sin(rx) + v.z * Math.cos(rx);
    let x1 = v.x;

    // Rotate around Y
    let x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry);
    let z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);
    let y2 = y1;

    // Rotate around Z
    let x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);
    let z3 = z2;

    return { x: x3, y: y3, z: z3 };
  }

  /** Perspective projection from 3D to 2D */
  private project(v: Vec3, cx: number, cy: number): Vec2 {
    const z = v.z + this.focalLength;
    const scale = this.focalLength / Math.max(z, 1);
    return {
      x: cx + v.x * scale,
      y: cy + v.y * scale,
    };
  }
}
