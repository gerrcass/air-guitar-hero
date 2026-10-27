import type { SongDefinition } from "../content/types";
import type { Chart, GameSnapshot, Lane } from "../game/types";
import type { Settings } from "../state/settings";
import { approachSeconds } from "../state/settings";
import type { RenderEffects } from "./effects";
import { laneColor, laneSymbol, withAlpha } from "./palette";

export interface RenderFrame {
  readonly chart: Chart;
  readonly song: SongDefinition;
  readonly snapshot: GameSnapshot;
  readonly settings: Settings;
  readonly effects: RenderEffects;
  readonly player: 1 | 2;
  readonly eliminated?: boolean;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface ScorePop {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

const PARTICLE_POOL = 220;
const POP_POOL = 24;
const KEY_LABELS: Readonly<Record<1 | 2, readonly string[]>> = {
  1: ["A", "S", "D", "F", "G"],
  2: ["H", "J", "K", "L", ";"],
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export class HighwayRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lastFrame = 0;
  private time = 0;
  private seed = 0x1234abcd;
  private motion = true;
  private readonly particles: Particle[] = [];
  private readonly pops: ScorePop[] = [];
  private readonly laneFlash: number[] = [0, 0, 0, 0, 0];
  private flash = 0;
  private flashColor = "#ff3355";
  private shake = 0;
  private starGlow = 0;
  private energy = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable.");
    this.canvas = canvas;
    this.ctx = ctx;
    for (let i = 0; i < PARTICLE_POOL; i += 1) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: "#fff",
      });
    }
    for (let i = 0; i < POP_POOL; i += 1) {
      this.pops.push({
        active: false,
        x: 0,
        y: 0,
        life: 0,
        maxLife: 1,
        text: "",
        color: "#fff",
        size: 16,
      });
    }
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    if (
      Math.abs(width - this.width) < 0.5 &&
      Math.abs(height - this.height) < 0.5 &&
      dpr === this.dpr
    ) {
      return;
    }
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  render(frame: RenderFrame): void {
    this.resize();
    const now = performance.now();
    const dt = this.lastFrame === 0 ? 0 : Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time = frame.snapshot.time;
    this.energy = frame.snapshot.rock;
    const motion = !frame.settings.reduceMotion && !frame.settings.staticHighway;
    this.motion = motion;

    this.consumeEffects(frame);
    this.updateEffects(dt, motion);
    if (frame.snapshot.starPowerActive) this.starGlow = Math.min(1, this.starGlow + dt * 4);
    else this.starGlow = Math.max(0, this.starGlow - dt * 3);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const shakeEnabled =
      motion && frame.settings.cameraShake && (this.shake > 0.01 || frame.snapshot.failed);
    const shakeX = shakeEnabled ? Math.sin(this.time * 71) * this.shake * 6 : 0;
    const shakeY = shakeEnabled ? Math.cos(this.time * 53) * this.shake * 4 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawStage(frame, motion);
    this.drawHighway(frame, motion);
    this.drawNotes(frame);
    this.drawReceptors(frame);
    this.drawEffects(frame);
    if (frame.snapshot.failed) {
      ctx.fillStyle = "rgba(26, 0, 6, 0.55)";
      ctx.fillRect(-20, -20, this.width + 40, this.height + 40);
    }
    if (frame.eliminated) {
      ctx.fillStyle = "rgba(3, 4, 8, 0.72)";
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  private geometry(): {
    hitY: number;
    horizonY: number;
    center: number;
    bottomHalf: number;
    topHalf: number;
  } {
    return {
      hitY: this.height * 0.82,
      horizonY: this.height * 0.185,
      center: this.width / 2,
      bottomHalf: this.width * 0.355,
      topHalf: this.width * 0.17,
    };
  }

  private laneX(lane: Lane, p: number, settings: Settings): number {
    const geo = this.geometry();
    const effective = settings.leftyFlip ? 4 - lane : lane;
    const half = lerp(geo.bottomHalf, geo.topHalf, p);
    const laneWidth = (half * 2) / 5;
    return geo.center - half + (effective + 0.5) * laneWidth;
  }

  private laneWidthAt(p: number): number {
    const geo = this.geometry();
    const half = lerp(geo.bottomHalf, geo.topHalf, p);
    return (half * 2) / 5;
  }

  private yForP(p: number): number {
    const geo = this.geometry();
    return lerp(geo.hitY, geo.horizonY, clamp(p, -0.15, 1.15));
  }

  private drawStage(frame: RenderFrame, motion: boolean): void {
    const ctx = this.ctx;
    const { width, height } = this;
    const palette = frame.song.palette;
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#020307");
    background.addColorStop(0.42, palette.background);
    background.addColorStop(1, "#030407");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const horizonGlow = ctx.createRadialGradient(
      width / 2,
      height * 0.33,
      0,
      width / 2,
      height * 0.33,
      width * 0.72,
    );
    horizonGlow.addColorStop(0, withAlpha(palette.primary, 0.23 + this.starGlow * 0.12));
    horizonGlow.addColorStop(0.4, withAlpha(palette.secondary, 0.08));
    horizonGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, width, height);

    // Truss and fixtures.
    ctx.fillStyle = "rgba(7, 9, 14, 0.92)";
    ctx.fillRect(0, height * 0.055, width, height * 0.014);
    ctx.strokeStyle = withAlpha(palette.accent, 0.28);
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      const x = (width / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, height * 0.055);
      ctx.lineTo(x, height * 0.095);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, height * 0.1, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(i % 2 === 0 ? palette.primary : palette.secondary, 0.8);
      ctx.fill();
    }

    // Moving beams, suppressed by static/reduced-motion settings.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i += 1) {
      const baseX = (width / 6) * i;
      const sweep = motion ? Math.sin(this.time * 0.28 + i * 1.7) * width * 0.035 : 0;
      const spread = width * (0.07 + (i % 3) * 0.02);
      const color = i % 2 === 0 ? palette.primary : palette.secondary;
      const alpha = (0.085 + this.starGlow * 0.05) * (0.55 + (i % 3) * 0.18);
      const gradient = ctx.createLinearGradient(baseX, height * 0.08, baseX + sweep, height * 0.7);
      gradient.addColorStop(0, withAlpha(color, alpha));
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(baseX - 3, height * 0.085);
      ctx.lineTo(baseX + 3, height * 0.085);
      ctx.lineTo(baseX + sweep + spread, height * 0.62);
      ctx.lineTo(baseX + sweep - spread, height * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Side speaker stacks.
    for (const side of [0, 1]) {
      const x = side === 0 ? width * 0.015 : width * 0.955;
      for (let row = 0; row < 4; row += 1) {
        const y = height * (0.42 + row * 0.09);
        const w = width * 0.03;
        const h = height * 0.07;
        ctx.fillStyle = "rgba(3, 4, 7, 0.9)";
        roundedRect(ctx, side === 0 ? x : x - w, y, w, h, 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(palette.accent, 0.16);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(side === 0 ? x + w / 2 : x - w / 2, y + h / 2, w * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(12, 16, 24, 0.95)";
        ctx.fill();
      }
    }

    this.drawCrowd(frame, motion);

    // Haze at the horizon.
    const haze = ctx.createLinearGradient(0, height * 0.22, 0, height * 0.55);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(0.55, withAlpha(palette.accent, 0.04 + this.starGlow * 0.04));
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * 0.22, width, height * 0.33);
  }

  private drawCrowd(frame: RenderFrame, motion: boolean): void {
    const ctx = this.ctx;
    const { width, height } = this;
    const palette = frame.song.palette;
    const excited = this.energy > 0.62 || frame.snapshot.starPowerActive;
    for (let row = 0; row < 3; row += 1) {
      const baseY = height * (0.31 + row * 0.055);
      const count = 26 + row * 5;
      const scale = 1 - row * 0.12;
      for (let i = 0; i < count; i += 1) {
        const jitter = Math.sin(i * 12.9898 + row * 78.233) * width * 0.01;
        const x = ((i + 0.35) / count) * width + jitter - width * 0.01;
        const bob = motion ? Math.sin(this.time * 2.4 + i * 1.31 + row) * 1.6 : 0;
        const y = baseY + bob;
        const head = height * 0.009 * scale;
        const silhouette = i % 7 === 0 ? palette.background : "#04050a";
        ctx.fillStyle = silhouette;
        ctx.beginPath();
        ctx.arc(x, y, head, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y + head * 2.4, head * 1.75, head * 1.65, 0, Math.PI, 0);
        ctx.fill();
        if (excited && (i + row) % 4 === 0) {
          const arm = head * (2.2 + (i % 3) * 0.4);
          ctx.strokeStyle = silhouette;
          ctx.lineWidth = head * 0.7;
          ctx.beginPath();
          ctx.moveTo(x - head * 0.9, y + head * 1.4);
          ctx.lineTo(x - head * 1.3, y - arm);
          ctx.moveTo(x + head * 0.9, y + head * 1.4);
          ctx.lineTo(x + head * 1.3, y - arm * 0.8);
          ctx.stroke();
        }
      }
    }
  }

  private drawHighway(frame: RenderFrame, motion: boolean): void {
    const ctx = this.ctx;
    const geo = this.geometry();
    const palette = frame.song.palette;
    const { width } = this;
    const leftTop = geo.center - geo.topHalf;
    const rightTop = geo.center + geo.topHalf;
    const leftBottom = geo.center - geo.bottomHalf;
    const rightBottom = geo.center + geo.bottomHalf;

    const runway = ctx.createLinearGradient(0, geo.horizonY, 0, geo.hitY);
    runway.addColorStop(0, "rgba(4, 5, 9, 0.35)");
    runway.addColorStop(0.55, "rgba(3, 4, 9, 0.82)");
    runway.addColorStop(1, "rgba(1, 2, 5, 0.96)");
    ctx.fillStyle = runway;
    ctx.beginPath();
    ctx.moveTo(leftTop, geo.horizonY);
    ctx.lineTo(rightTop, geo.horizonY);
    ctx.lineTo(rightBottom, geo.hitY);
    ctx.lineTo(leftBottom, geo.hitY);
    ctx.closePath();
    ctx.fill();

    const edgeGlow = 0.2 + this.starGlow * 0.4;
    ctx.strokeStyle = withAlpha(palette.primary, edgeGlow);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftTop, geo.horizonY);
    ctx.lineTo(leftBottom, geo.hitY);
    ctx.moveTo(rightTop, geo.horizonY);
    ctx.lineTo(rightBottom, geo.hitY);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.secondary, edgeGlow * 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftTop - 5, geo.horizonY);
    ctx.lineTo(leftBottom - 8, geo.hitY);
    ctx.moveTo(rightTop + 5, geo.horizonY);
    ctx.lineTo(rightBottom + 8, geo.hitY);
    ctx.stroke();

    // Lane beds: a quiet wash of each lane's colour keeps the five columns legible.
    const colorblind = frame.settings.colorblindPalette;
    for (let lane = 0; lane < 5; lane += 1) {
      const leftP0 = geo.center - geo.bottomHalf + (lane / 5) * geo.bottomHalf * 2;
      const rightP0 = geo.center - geo.bottomHalf + ((lane + 1) / 5) * geo.bottomHalf * 2;
      const leftP1 = geo.center - geo.topHalf + (lane / 5) * geo.topHalf * 2;
      const rightP1 = geo.center - geo.topHalf + ((lane + 1) / 5) * geo.topHalf * 2;
      const laneWash = ctx.createLinearGradient(0, geo.horizonY, 0, geo.hitY);
      laneWash.addColorStop(0, withAlpha(laneColor(lane as Lane, colorblind), 0.015));
      laneWash.addColorStop(1, withAlpha(laneColor(lane as Lane, colorblind), 0.05));
      ctx.fillStyle = laneWash;
      ctx.beginPath();
      ctx.moveTo(leftP1, geo.horizonY);
      ctx.lineTo(rightP1, geo.horizonY);
      ctx.lineTo(rightP0, geo.hitY);
      ctx.lineTo(leftP0, geo.hitY);
      ctx.closePath();
      ctx.fill();
    }

    // Lane rails.
    for (let lane = 0; lane <= 5; lane += 1) {
      const p0 = 0;
      const p1 = 1;
      const xBottom = geo.center - geo.bottomHalf + (lane / 5) * geo.bottomHalf * 2;
      const xTop = geo.center - geo.topHalf + (lane / 5) * geo.topHalf * 2;
      ctx.strokeStyle =
        lane === 0 || lane === 5 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xTop, this.yForP(p1));
      ctx.lineTo(xBottom, this.yForP(p0));
      ctx.stroke();
    }

    // Beat and bar lines.
    const beat = 60 / frame.chart.bpm;
    const approach = approachSeconds(frame.settings.noteSpeed);
    const firstBeat = Math.ceil(Math.max(0, this.time) / beat);
    const lastBeat = Math.floor((this.time + approach) / beat) + 1;
    for (let index = firstBeat; index <= lastBeat; index += 1) {
      const beatTime = index * beat;
      const p = (beatTime - this.time) / approach;
      if (p < -0.1 || p > 1.05) continue;
      const y = this.yForP(p);
      const half = lerp(geo.bottomHalf, geo.topHalf, p);
      const isBar = index % 4 === 0;
      ctx.strokeStyle = isBar
        ? withAlpha(palette.accent, 0.25 * (1 - p))
        : `rgba(255,255,255,${0.08 * (1 - p)})`;
      ctx.lineWidth = isBar ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(geo.center - half, y);
      ctx.lineTo(geo.center + half, y);
      ctx.stroke();
    }

    // Section boundaries.
    for (const section of frame.chart.sections) {
      const p = (section.start - this.time) / approach;
      if (p < -0.1 || p > 1.02 || section.start <= 0) continue;
      const y = this.yForP(p);
      const half = lerp(geo.bottomHalf, geo.topHalf, p);
      ctx.strokeStyle = withAlpha(palette.primary, 0.32 * (1 - p));
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(geo.center - half, y);
      ctx.lineTo(geo.center + half, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(palette.ink, 0.42 * (1 - p));
      ctx.font = `600 ${Math.max(9, width * 0.008)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(section.name.toUpperCase(), geo.center - half + 8, y - 5);
    }

    // The hit line: a bright, unmistakable rail across the runway.
    const hitGlow = ctx.createLinearGradient(leftBottom, 0, rightBottom, 0);
    hitGlow.addColorStop(0, "rgba(255,255,255,0)");
    hitGlow.addColorStop(0.18, withAlpha(palette.ink, 0.22));
    hitGlow.addColorStop(0.5, withAlpha(palette.accent, 0.44));
    hitGlow.addColorStop(0.82, withAlpha(palette.ink, 0.22));
    hitGlow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hitGlow;
    ctx.fillRect(leftBottom, geo.hitY - 1.5, rightBottom - leftBottom, 3);
    ctx.fillStyle = withAlpha(palette.ink, 0.16);
    ctx.fillRect(leftBottom, geo.hitY + 2, rightBottom - leftBottom, 1);

    if (this.starGlow > 0.01) {
      const starWash = ctx.createLinearGradient(0, geo.horizonY, 0, geo.hitY);
      starWash.addColorStop(0, withAlpha(palette.accent, 0));
      starWash.addColorStop(0.55, withAlpha(palette.primary, 0.07 * this.starGlow));
      starWash.addColorStop(1, withAlpha(palette.accent, 0.14 * this.starGlow));
      ctx.fillStyle = starWash;
      ctx.beginPath();
      ctx.moveTo(leftTop, geo.horizonY);
      ctx.lineTo(rightTop, geo.horizonY);
      ctx.lineTo(rightBottom, geo.hitY);
      ctx.lineTo(leftBottom, geo.hitY);
      ctx.closePath();
      ctx.fill();
    }

    // Count-in lane flash.
    if (this.time < 0 && motion) {
      ctx.fillStyle = withAlpha(palette.accent, 0.03);
      ctx.fillRect(leftBottom, geo.horizonY, rightBottom - leftBottom, geo.hitY - geo.horizonY);
    }
  }

  private drawNotes(frame: RenderFrame): void {
    const ctx = this.ctx;
    const approach = approachSeconds(frame.settings.noteSpeed);
    const geo = this.geometry();
    const colorblind = frame.settings.colorblindPalette;

    for (let index = 0; index < frame.chart.notes.length; index += 1) {
      const note = frame.chart.notes[index];
      const state = frame.snapshot.noteStates[index];
      if (!note || !state) continue;
      if (state.status === "missed" || state.status === "skipped") continue;
      const p = (note.time - this.time) / approach;
      if (p > 1.04) continue;
      const consumed =
        state.status === "hit" || state.status === "holding" || state.status === "released";
      if (state.status === "hit" && this.time > note.time + 0.16) continue;
      if (p < -0.25) continue;

      if (note.duration > 0 && (state.status === "pending" || state.status === "holding")) {
        for (const lane of note.lanes) {
          this.drawSustain(
            note.time,
            note.time + note.duration,
            lane,
            laneColor(lane, colorblind),
            note.star,
            frame,
            state,
          );
        }
      }
      if (consumed) continue;

      for (const lane of note.lanes) {
        const color = laneColor(lane, colorblind);
        this.drawGem(lane, color, note.star, note.hopo, frame, p, state.status === "pending");
      }
    }

    // Hit sparkle at the line for recently hit gems.
    for (let index = 0; index < frame.chart.notes.length; index += 1) {
      const note = frame.chart.notes[index];
      const state = frame.snapshot.noteStates[index];
      if (!note || !state) continue;
      if (state.status !== "holding" || this.time - note.time > 0.12) continue;
      for (const lane of note.lanes) {
        const x = this.laneX(lane, 0, frame.settings);
        ctx.fillStyle = withAlpha(laneColor(lane, colorblind), 0.18);
        ctx.beginPath();
        ctx.arc(x, geo.hitY, this.laneWidthAt(0) * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawSustain(
    headTime: number,
    tailTime: number,
    lane: Lane,
    color: string,
    star: boolean,
    frame: RenderFrame,
    state: { readonly status: string },
  ): void {
    const approach = approachSeconds(frame.settings.noteSpeed);
    let pHead = (headTime - this.time) / approach;
    const pTail = (tailTime - this.time) / approach;
    if (pTail < -0.15 || pHead > 1.05) return;
    if (state.status !== "pending") pHead = 0;
    this.drawSustainTail(
      lane,
      clamp(pHead, 0, 1),
      clamp(pTail, -0.1, 1),
      color,
      star,
      frame.settings,
    );
  }

  private drawSustainTail(
    lane: Lane,
    pHead: number,
    pTail: number,
    color: string,
    star: boolean,
    settings: Settings,
  ): void {
    if (pTail <= pHead) return;
    const ctx = this.ctx;
    const xHead = this.laneX(lane, pHead, settings);
    const xTail = this.laneX(lane, pTail, settings);
    const wHead = this.laneWidthAt(pHead) * 0.16;
    const wTail = this.laneWidthAt(pTail) * 0.16;
    const yHead = this.yForP(pHead);
    const yTail = this.yForP(pTail);
    const gradient = ctx.createLinearGradient(0, yTail, 0, yHead);
    gradient.addColorStop(0, withAlpha(color, 0.06));
    gradient.addColorStop(1, withAlpha(color, star ? 0.7 : 0.42));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(xTail - wTail, yTail);
    ctx.lineTo(xTail + wTail, yTail);
    ctx.lineTo(xHead + wHead, yHead);
    ctx.lineTo(xHead - wHead, yHead);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xTail, yTail);
    ctx.lineTo(xHead, yHead);
    ctx.stroke();
  }

  private drawGem(
    lane: Lane,
    color: string,
    star: boolean,
    hopo: boolean,
    frame: RenderFrame,
    p: number,
    pending: boolean,
  ): void {
    const ctx = this.ctx;
    const clamped = clamp(p, 0, 1);
    const x = this.laneX(lane, clamped, frame.settings);
    const y = this.yForP(clamped);
    const laneWidth = this.laneWidthAt(clamped);
    const w = laneWidth * 0.54;
    const h = Math.max(7, w * 0.43);
    const alpha = pending ? 1 : 0.75;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    gradient.addColorStop(0, withAlpha(color, 0.98));
    gradient.addColorStop(0.52, color);
    gradient.addColorStop(1, withAlpha(color, 0.55));
    const chamfer = Math.min(8, w * 0.16);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + chamfer, y - h / 2);
    ctx.lineTo(x + w / 2 - chamfer, y - h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 - chamfer, y + h / 2);
    ctx.lineTo(x - w / 2 + chamfer, y + h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + chamfer + 2, y - h / 2 + 2);
    ctx.lineTo(x + w / 2 - chamfer - 2, y - h / 2 + 2);
    ctx.lineTo(x + w / 2 - 3, y - h / 2 + h * 0.3);
    ctx.lineTo(x - w / 2 + 3, y - h / 2 + h * 0.3);
    ctx.closePath();
    ctx.fill();

    if (hopo) {
      // A white ring is the HOPO cue: fret only, no strum.
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.56, h * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.16, y - h * 0.16);
      ctx.lineTo(x + w * 0.16, y - h * 0.16);
      ctx.lineTo(x, y + h * 0.26);
      ctx.closePath();
      ctx.fill();
    }
    if (star) {
      this.drawStar(x, y, Math.min(w, h) * 0.34, "rgba(255,248,203,0.95)");
    }
    if (frame.settings.laneSymbols) {
      ctx.fillStyle = "rgba(5, 8, 12, 0.78)";
      ctx.font = `700 ${Math.max(8, h * 0.62)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(laneSymbol(lane), x, y + 1);
    }
    ctx.restore();
  }

  private drawStar(x: number, y: number, radius: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : radius * 0.44;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawReceptors(frame: RenderFrame): void {
    const ctx = this.ctx;
    const geo = this.geometry();
    const colorblind = frame.settings.colorblindPalette;
    const beat = 60 / frame.chart.bpm;
    const pulse = Math.max(0, 1 - ((Math.max(0, this.time) % beat) / beat) * 2);
    for (let lane = 0; lane < 5; lane += 1) {
      const x = this.laneX(lane as Lane, 0, frame.settings);
      const w = this.laneWidthAt(0) * 0.56;
      const h = this.laneWidthAt(0) * 0.16;
      const color = laneColor(lane as Lane, colorblind);
      const held = frame.snapshot.heldLanes[lane] ?? false;
      ctx.save();
      ctx.fillStyle = "rgba(2, 3, 7, 0.86)";
      roundedRect(ctx, x - w / 2, geo.hitY - h / 2, w, h, h * 0.32);
      ctx.fill();
      ctx.strokeStyle = withAlpha(color, held ? 0.98 : 0.4 + pulse * 0.18);
      ctx.lineWidth = held ? 2.5 : 1.2;
      ctx.stroke();
      if (held) {
        ctx.fillStyle = withAlpha(color, 0.46);
        roundedRect(ctx, x - w / 2 + 2, geo.hitY - h / 2 + 2, w - 4, h - 4, h * 0.26);
        ctx.fill();
      }
      const flash = this.laneFlash[lane] ?? 0;
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 55, 70, ${flash * 0.6})`;
        roundedRect(ctx, x - w / 2, geo.hitY - h / 2, w, h, h * 0.3);
        ctx.fill();
      }
      ctx.fillStyle = withAlpha(color, 0.9);
      ctx.font = `700 ${Math.max(10, h * 0.55)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(laneSymbol(lane as Lane), x, geo.hitY + 1);
      ctx.fillStyle = withAlpha(frame.song.palette.ink, 0.5);
      ctx.font = `600 ${Math.max(10, h * 0.36)}px "Space Grotesk", sans-serif`;
      ctx.fillText(KEY_LABELS[frame.player][lane] ?? "", x, geo.hitY + h / 2 + 17);
      ctx.restore();
    }
  }

  private consumeEffects(frame: RenderFrame): void {
    const events = frame.effects.drain();
    if (events.length === 0) return;
    const noteById = new Map(frame.chart.notes.map((note, index) => [note.id, { note, index }]));
    for (const event of events) {
      if (event.type === "judgement") {
        const found = noteById.get(event.noteId);
        if (!found) continue;
        const colorblind = frame.settings.colorblindPalette;
        const lanes = found.note.lanes;
        for (const lane of lanes) {
          const x = this.laneX(lane, 0, frame.settings);
          if (event.judgement === "miss") {
            this.laneFlash[lane] = 1;
            this.spawn(x, this.geometry().hitY, "#ff3a4d", 6, 0.7);
          } else {
            this.spawn(
              x,
              this.geometry().hitY,
              laneColor(lane, colorblind),
              event.judgement === "perfect" ? 14 : event.judgement === "great" ? 10 : 7,
              0.9,
            );
          }
        }
        if (event.judgement === "miss") {
          this.flash = Math.max(this.flash, 0.35);
          this.flashColor = "#ff3048";
          this.shake = Math.max(this.shake, 0.2);
          this.popAt(lanes, "MISS", "#ff6172", 16, frame.settings);
        } else {
          const x =
            lanes.reduce((sum: number, lane) => sum + this.laneX(lane, 0, frame.settings), 0) /
            lanes.length;
          this.popAtPoint(x, this.geometry().hitY - 24, `+${event.points}`, "#fff4dc", 15);
          this.shake = Math.max(this.shake, event.judgement === "perfect" ? 0.06 : 0.03);
        }
      } else if (event.type === "overstrum") {
        this.flash = Math.max(this.flash, 0.45);
        this.flashColor = "#ff3148";
        this.shake = Math.max(this.shake, 0.25);
        this.popAtPoint(this.width / 2, this.geometry().hitY - 46, "OVERSTRUM", "#ff7180", 16);
      } else if (event.type === "starPhrase") {
        this.starGlow = Math.max(this.starGlow, 0.7);
        this.popAtPoint(this.width / 2, this.height * 0.32, "STAR PHRASE", "#ffe8a3", 20);
        for (let i = 0; i < 26; i += 1) {
          this.spawn(
            this.width * (0.2 + this.random() * 0.6),
            this.height * (0.3 + this.random() * 0.2),
            "#ffe8a3",
            1,
            1.3,
          );
        }
      } else if (event.type === "starPowerActivated") {
        this.starGlow = 1;
        this.flash = 0.55;
        this.flashColor = frame.song.palette.primary;
        this.shake = Math.max(this.shake, 0.5);
        this.popAtPoint(this.width / 2, this.height * 0.4, "STAR POWER", "#ffffff", 24);
        for (let i = 0; i < 40; i += 1) {
          this.spawn(
            this.width * this.random(),
            this.height * (0.2 + this.random() * 0.55),
            i % 2 === 0 ? frame.song.palette.primary : frame.song.palette.secondary,
            1,
            1.2,
          );
        }
      } else if (event.type === "sustainTick" && event.starGain > 0) {
        const found = noteById.get(event.noteId);
        if (found) {
          for (const lane of found.note.lanes) {
            this.spawn(
              this.laneX(lane, 0, frame.settings),
              this.geometry().hitY,
              "#ffd76a",
              2,
              0.6,
            );
          }
        }
      } else if (event.type === "failed") {
        this.flash = 1;
        this.flashColor = "#c01028";
        this.shake = 1;
      }
    }
  }

  private spawn(x: number, y: number, color: string, count: number, power: number): void {
    if (!this.motion) return;
    let spawned = 0;
    for (const particle of this.particles) {
      if (particle.active) continue;
      const angle = this.random() * Math.PI * 2;
      const speed = (30 + this.random() * 120) * power;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - 50;
      particle.maxLife = 0.35 + this.random() * 0.5;
      particle.life = particle.maxLife;
      particle.size = 1.5 + this.random() * 3;
      particle.color = color;
      spawned += 1;
      if (spawned >= count) return;
    }
  }

  private popAt(
    lanes: readonly Lane[],
    text: string,
    color: string,
    size: number,
    settings: Settings,
  ): void {
    if (lanes.length === 0) return;
    const x =
      lanes.reduce((sum: number, lane) => sum + this.laneX(lane, 0, settings), 0) / lanes.length;
    this.popAtPoint(x, this.geometry().hitY - 24, text, color, size);
  }

  private popAtPoint(x: number, y: number, text: string, color: string, size: number): void {
    for (const pop of this.pops) {
      if (pop.active) continue;
      pop.active = true;
      pop.x = x;
      pop.y = y;
      pop.life = 0.85;
      pop.maxLife = 0.85;
      pop.text = text;
      pop.color = color;
      pop.size = size;
      return;
    }
  }

  private updateEffects(dt: number, motion: boolean): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 320 * dt;
    }
    for (const pop of this.pops) {
      if (!pop.active) continue;
      pop.life -= dt;
      if (pop.life <= 0) pop.active = false;
      else pop.y -= 26 * dt;
    }
    for (let i = 0; i < 5; i += 1)
      this.laneFlash[i] = Math.max(0, (this.laneFlash[i] ?? 0) - dt * 2.6);
    this.flash = Math.max(0, this.flash - dt * 1.7);
    this.shake = Math.max(0, this.shake - dt * (motion ? 1.8 : 8));
  }

  private drawEffects(frame: RenderFrame): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const particle of this.particles) {
      if (!particle.active) continue;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const pop of this.pops) {
      if (!pop.active) continue;
      const progress = 1 - pop.life / pop.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 1.4);
      ctx.fillStyle = pop.color;
      ctx.font = `800 ${pop.size}px "Bebas Neue", "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    if (this.flash > 0.01) {
      ctx.fillStyle = withAlpha(this.flashColor, this.flash * 0.22);
      ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.starGlow > 0.02 && frame.snapshot.starPowerActive) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(
        this.width / 2,
        this.geometry().hitY,
        this.width * 0.06,
        this.width / 2,
        this.geometry().hitY,
        this.width * 0.55,
      );
      glow.addColorStop(0, withAlpha(frame.song.palette.accent, 0.12 * this.starGlow));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }
}
