import { ThrongSimulation } from './simulation';
import { Thronglet, WorldItem } from './types';

export class RetroRenderer {
  private ctx: CanvasRenderingContext2D;
  public showSynapseLinks: boolean = true;
  private foliagePoints: Array<{ x: number; y: number; kind: 'flower' | 'tuft' | 'rock'; color: string }> = [];

  constructor(private canvas: HTMLCanvasElement, private sim: ThrongSimulation) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D canvas context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.generateFoliage();
  }

  private generateFoliage(): void {
    const colors = ['#fde047', '#f472b6', '#60a5fa', '#ffffff'];
    for (let i = 0; i < 42; i++) {
      const pt = this.sim.randomIslandPoint();
      const r = Math.random();
      this.foliagePoints.push({
        x: pt.x,
        y: pt.y,
        kind: r < 0.45 ? 'tuft' : r < 0.85 ? 'flower' : 'rock',
        color: colors[i % colors.length],
      });
    }
  }

  public render(timeSec: number): void {
    const { ctx, sim } = this;
    const { width, height } = sim;

    // 1. Ocean background
    ctx.fillStyle = '#0d2b45';
    ctx.fillRect(0, 0, width, height);

    // Animated pixel water ripples
    ctx.fillStyle = '#163f63';
    for (let y = 16; y < height; y += 28) {
      for (let x = 16; x < width; x += 48) {
        const offset = Math.floor(Math.sin(timeSec * 2 + y * 0.1 + x * 0.05) * 6);
        ctx.fillRect(x + offset, y, 14, 3);
      }
    }

    // 2. Island shallow water halo & sandy beach
    const cx = sim.islandCenterX;
    const cy = sim.islandCenterY;
    const rx = sim.islandRadiusX;
    const ry = sim.islandRadiusY;

    const pulse = Math.sin(timeSec * 2.2) * 3;
    this.drawPixelEllipse(cx, cy, rx + 18 + pulse, ry + 16 + pulse, '#20638c');
    this.drawPixelEllipse(cx, cy, rx + 8, ry + 8, '#e6c27a');
    this.drawPixelEllipse(cx, cy + 3, rx, ry, '#2d7a47');
    this.drawPixelEllipse(cx, cy, rx - 8, ry - 8, '#3b9457');

    // 3. Island foliage details
    for (const f of this.foliagePoints) {
      const fx = Math.round(f.x);
      const fy = Math.round(f.y);
      if (f.kind === 'tuft') {
        ctx.fillStyle = '#25663b';
        ctx.fillRect(fx, fy, 2, 4);
        ctx.fillRect(fx - 3, fy + 1, 2, 3);
        ctx.fillRect(fx + 3, fy + 1, 2, 3);
      } else if (f.kind === 'flower') {
        ctx.fillStyle = '#25663b';
        ctx.fillRect(fx, fy + 2, 2, 3);
        ctx.fillStyle = f.color;
        ctx.fillRect(fx - 1, fy, 4, 3);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(fx - 3, fy, 6, 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(fx - 2, fy, 4, 2);
      }
    }

    // 4. Optional Neural Synapse Links between nearby Thronglets
    if (this.showSynapseLinks) {
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < sim.thronglets.length; i++) {
        for (let j = i + 1; j < sim.thronglets.length; j++) {
          const a = sim.thronglets[i];
          const b = sim.thronglets[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 85) {
            const alpha = (1 - dist / 85) * 0.35;
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(Math.round(a.x), Math.round(a.y));
            ctx.lineTo(Math.round(b.x), Math.round(b.y));
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // 5. Acoustic Chirp Waves
    for (const wave of sim.chirpWaves) {
      const alpha = Math.max(0, 1 - wave.radius / wave.maxRadius);
      ctx.save();
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = alpha * 0.65;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(Math.round(wave.x), Math.round(wave.y), Math.round(wave.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. World Items & Thronglets sorted by Y for depth
    const renderables: Array<
      | { kind: 'item'; y: number; obj: WorldItem }
      | { kind: 'agent'; y: number; obj: Thronglet }
    > = [
      ...sim.items.map((obj) => ({ kind: 'item' as const, y: obj.y, obj })),
      ...sim.thronglets.map((obj) => ({ kind: 'agent' as const, y: obj.y, obj })),
    ].sort((a, b) => a.y - b.y);

    for (const entry of renderables) {
      if (entry.kind === 'item') {
        this.drawWorldItem(entry.obj, timeSec);
      } else {
        this.drawThronglet(entry.obj, timeSec);
      }
    }

    // 7. Particles
    for (const p of sim.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.text) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, Math.round(p.x - 6), Math.round(p.y));
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
      }
      ctx.restore();
    }
  }

  private drawPixelEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string
  ): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(Math.round(cx), Math.round(cy), Math.round(rx), Math.round(ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWorldItem(item: WorldItem, timeSec: number): void {
    const { ctx } = this;
    const x = Math.round(item.x);
    const y = Math.round(item.y);

    if (item.type === 'apple') {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x - 6, y + 5, 12, 3);
      // Red pixel apple
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 5, y - 4, 10, 9);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(x - 3, y - 3, 2, 2);
      // Stem & leaf
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 1, y - 7, 2, 3);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(x + 1, y - 7, 3, 2);
    } else if (item.type === 'nutrient_cube') {
      const bob = Math.round(Math.sin(timeSec * 4 + item.id) * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x - 6, y + 6, 12, 3);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x - 6, y - 6 + bob, 12, 11);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(x - 4, y - 4 + bob, 8, 4);
    } else if (item.type === 'ball') {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x - 6, y + 6, 12, 3);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 3, y - 4, 3, 2);
    } else if (item.type === 'bubble_puddle') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillRect(x - 14, y - 5, 28, 10);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x - 9, y - 4, 4, 4);
      ctx.fillRect(x + 4, y - 2, 5, 5);
      ctx.fillRect(x - 2, y + 1, 3, 3);
    } else if (item.type === 'waste') {
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(x - 5, y - 2, 10, 5);
      ctx.fillRect(x - 3, y - 5, 6, 3);
      // Stink lines
      const wave = Math.round(Math.sin(timeSec * 6 + item.id) * 1.5);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(x - 3 + wave, y - 9, 1, 3);
      ctx.fillRect(x + 2 - wave, y - 10, 1, 3);
    }
  }

  private drawThronglet(agent: Thronglet, timeSec: number): void {
    const { ctx, sim } = this;
    const isSelected = sim.selectedThrongletId === agent.id;

    const bounce =
      agent.action === 'SLEEP'
        ? 0
        : Math.abs(Math.sin(agent.animPhase)) * 3.5;

    const x = Math.round(agent.x);
    const y = Math.round(agent.y - bounce);

    // Selection reticle underneath
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, Math.round(agent.y + 7), 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(x - 8, Math.round(agent.y + 5), 16, 4);

    // Mitosis stretch effect
    const stretchX =
      agent.action === 'MITOSIS'
        ? Math.round(Math.sin(timeSec * 18) * 5)
        : 0;

    // Body color shifted slightly by genome hueShift
    const hue = Math.round(48 + agent.brain.genome.hueShift);
    const bodyColor = `hsl(${hue}, 96%, 56%)`;
    const shadeColor = `hsl(${hue - 8}, 90%, 42%)`;
    const highlightColor = `hsl(${hue + 6}, 100%, 76%)`;

    // Ears / antennae tufts (iconic Thronglet look)
    ctx.fillStyle = shadeColor;
    ctx.fillRect(x - 8 - stretchX, y - 13, 4, 5);
    ctx.fillRect(x + 4 + stretchX, y - 13, 4, 5);

    // Main round pixelated body
    ctx.fillStyle = shadeColor;
    ctx.fillRect(x - 9 - stretchX, y - 8, 18 + stretchX * 2, 14);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - 8 - stretchX, y - 9, 16 + stretchX * 2, 13);
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x - 5, y - 8, 6, 2);

    // Little feet
    const footOffset = agent.action === 'SLEEP' ? 0 : Math.round(Math.sin(agent.animPhase) * 2);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x - 6, y + 5 + footOffset, 4, 3);
    ctx.fillRect(x + 2, y + 5 - footOffset, 4, 3);

    // Dirt smudges if hygiene is low
    if (agent.needs.hygiene < 45) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 6, y + 1, 3, 2);
      ctx.fillRect(x + 3, y - 2, 3, 2);
    }

    // Face & Eyes
    const eyeDir = agent.facing;
    if (agent.action === 'SLEEP') {
      // Closed sleeping eyes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x - 5 + eyeDir, y - 3, 3, 1);
      ctx.fillRect(x + 2 + eyeDir, y - 3, 3, 1);
    } else {
      // Big expressive dark eyes with white pixel shine
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 5 + eyeDir, y - 5, 3, 4);
      ctx.fillRect(x + 2 + eyeDir, y - 5, 3, 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 5 + eyeDir, y - 5, 1, 1);
      ctx.fillRect(x + 2 + eyeDir, y - 5, 1, 1);
    }

    // Mouth expression
    ctx.fillStyle = '#0f172a';
    if (agent.needs.hunger < 30 || agent.needs.hygiene < 25) {
      // Sad/hungry mouth
      ctx.fillRect(x - 1 + eyeDir, y + 1, 3, 1);
    } else {
      // Happy pixel smile
      ctx.fillRect(x - 1 + eyeDir, y, 2, 1);
    }

    // Floating Emote or Sleep Zzz
    if (agent.emote) {
      ctx.font = '12px sans-serif';
      ctx.fillText(agent.emote, x - 6, y - 16);
    } else if (agent.action === 'SLEEP') {
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText('Zzz', x - 6, y - 15);
    }

    // Name tag when selected
    if (isSelected) {
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 24, y - 26, 48, 11);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(agent.name, x - 21, y - 17);
    }
  }
}

