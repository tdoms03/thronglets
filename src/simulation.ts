import { audio } from './audio';
import {
  createBrain,
  evaluateBrainDecision,
  generateThrongletName,
  reinforceBrain,
} from './brain';
import {
  ChirpWave,
  LogEntry,
  Particle,
  Thronglet,
  ToolType,
  WorldItem,
  WorldItemType,
} from './types';

export class ThrongSimulation {
  public width: number = 720;
  public height: number = 480;
  public thronglets: Thronglet[] = [];
  public items: WorldItem[] = [];
  public particles: Particle[] = [];
  public chirpWaves: ChirpWave[] = [];
  public logs: LogEntry[] = [];

  public selectedThrongletId: number | null = null;
  public activeTool: ToolType = 'feed';
  public simSpeed: number = 1;
  public totalBirths: number = 0;
  public totalChirps: number = 0;
  public tickCount: number = 0;

  private nextAgentId: number = 1;
  private nextItemId: number = 1;
  private nextLogId: number = 1;
  private collectiveTimer: number = 0;

  // Island elliptical bounds
  public get islandCenterX(): number {
    return this.width * 0.5;
  }
  public get islandCenterY(): number {
    return this.height * 0.52;
  }
  public get islandRadiusX(): number {
    return this.width * 0.41;
  }
  public get islandRadiusY(): number {
    return this.height * 0.38;
  }

  constructor() {
    this.resetWorld();
  }

  public resetWorld(): void {
    this.thronglets = [];
    this.items = [];
    this.particles = [];
    this.chirpWaves = [];
    this.logs = [];
    this.nextAgentId = 1;
    this.nextItemId = 1;
    this.totalBirths = 0;
    this.totalChirps = 0;
    this.tickCount = 0;

    this.addLog(
      'CONTAINMENT',
      'SANDBOX PROTOCOL v1.94 INITIALIZED — Network Air-Gap: LOCKED. Optical/Acoustic Modem: DISABLED.',
      '#4ade80'
    );
    this.addLog(
      'SYSTEM',
      'Tuckersoft Virtual Habitat mounted. Spawning founding Thronglets...',
      '#38bdf8'
    );

    // Spawn 4 initial founder Thronglets
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = this.islandCenterX + Math.cos(angle) * 65;
      const y = this.islandCenterY + Math.sin(angle) * 45;
      this.spawnThronglet(x, y, 1);
    }

    // Spawn a starter apple and bouncy ball
    this.spawnItem('apple', this.islandCenterX - 55, this.islandCenterY + 25);
    this.spawnItem('ball', this.islandCenterX + 60, this.islandCenterY - 20);

    this.selectedThrongletId = this.thronglets[0]?.id ?? null;
  }

  public isInsideIsland(x: number, y: number, margin: number = 0.92): boolean {
    const dx = (x - this.islandCenterX) / (this.islandRadiusX * margin);
    const dy = (y - this.islandCenterY) / (this.islandRadiusY * margin);
    return dx * dx + dy * dy <= 1.0;
  }

  public clampToIsland(x: number, y: number, margin: number = 0.88): { x: number; y: number } {
    const dx = (x - this.islandCenterX) / (this.islandRadiusX * margin);
    const dy = (y - this.islandCenterY) / (this.islandRadiusY * margin);
    const d = Math.hypot(dx, dy);
    if (d <= 1.0) return { x, y };
    return {
      x: this.islandCenterX + (dx / d) * this.islandRadiusX * margin,
      y: this.islandCenterY + (dy / d) * this.islandRadiusY * margin,
    };
  }

  public randomIslandPoint(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.82;
    return {
      x: this.islandCenterX + Math.cos(angle) * this.islandRadiusX * r,
      y: this.islandCenterY + Math.sin(angle) * this.islandRadiusY * r,
    };
  }

  public spawnThronglet(
    x: number,
    y: number,
    generation: number = 1,
    parent?: Thronglet
  ): Thronglet {
    const id = this.nextAgentId++;
    const clamped = this.clampToIsland(x, y);
    const agent: Thronglet = {
      id,
      name: generateThrongletName(id),
      generation,
      x: clamped.x,
      y: clamped.y,
      vx: 0,
      vy: 0,
      targetX: null,
      targetY: null,
      targetItemId: null,
      targetPeerId: null,
      age: 0,
      needs: {
        hunger: parent ? 75 : 80 + Math.random() * 15,
        hygiene: parent ? 85 : 85 + Math.random() * 15,
        fun: parent ? 80 : 75 + Math.random() * 15,
        energy: parent ? 78 : 85 + Math.random() * 15,
        social: 75,
      },
      brain: createBrain(parent?.brain),
      action: 'WANDER',
      actionTimer: 0,
      reproductionProgress: 0,
      animPhase: Math.random() * Math.PI * 2,
      facing: Math.random() > 0.5 ? 1 : -1,
      emote: '✨',
      emoteTimer: 2.0,
      isAlive: true,
    };

    this.thronglets.push(agent);
    this.totalBirths++;
    return agent;
  }

  public spawnItem(type: WorldItemType, x: number, y: number): WorldItem {
    const pos = this.clampToIsland(x, y, 0.85);
    const maxAmount =
      type === 'apple'
        ? 4
        : type === 'nutrient_cube'
        ? 7
        : type === 'bubble_puddle'
        ? 100
        : type === 'waste'
        ? 100
        : 999;

    const item: WorldItem = {
      id: this.nextItemId++,
      type,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      amount: maxAmount,
      maxAmount,
      createdAt: this.tickCount,
    };
    this.items.push(item);
    return item;
  }

  public handleCanvasClick(x: number, y: number): void {
    // Check if clicking directly on a Thronglet
    let clickedAgent: Thronglet | null = null;
    let bestDist = 24;
    for (const t of this.thronglets) {
      if (!t.isAlive) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestDist) {
        bestDist = d;
        clickedAgent = t;
      }
    }

    if (this.activeTool === 'inspect') {
      if (clickedAgent) {
        this.selectedThrongletId = clickedAgent.id;
        clickedAgent.needs.fun = Math.min(100, clickedAgent.needs.fun + 10);
        clickedAgent.needs.social = Math.min(100, clickedAgent.needs.social + 12);
        clickedAgent.emote = '💛';
        clickedAgent.emoteTimer = 1.8;
        clickedAgent.brain.currentThought = 'Caretaker petted me! Warm neural spike!';
        this.spawnParticles(clickedAgent.x, clickedAgent.y - 10, '#facc15', 6, '♥');
        audio.playChirp(1.2, 'happy');
      }
      return;
    }

    if (this.activeTool === 'feed') {
      const itemType: WorldItemType = Math.random() > 0.3 ? 'apple' : 'nutrient_cube';
      const item = this.spawnItem(itemType, x, y);
      this.spawnParticles(item.x, item.y, '#4ade80', 8);
      audio.playClick();
      // Alert nearby Thronglets
      this.emitChirpWave(item.x, item.y, 170, '#4ade80', 'FOOD');
      return;
    }

    if (this.activeTool === 'wash') {
      // Wash any Thronglets near cursor + leave a bubble puddle + clean waste
      const pos = this.clampToIsland(x, y);
      this.spawnItem('bubble_puddle', pos.x, pos.y);
      this.spawnParticles(pos.x, pos.y, '#38bdf8', 12);
      audio.playWash();

      // Remove nearby waste
      this.items = this.items.filter(
        (it) => !(it.type === 'waste' && Math.hypot(it.x - pos.x, it.y - pos.y) < 55)
      );

      for (const t of this.thronglets) {
        if (Math.hypot(t.x - pos.x, t.y - pos.y) < 60) {
          t.needs.hygiene = Math.min(100, t.needs.hygiene + 45);
          t.emote = '🫧';
          t.emoteTimer = 1.8;
          t.brain.currentThought = 'So fresh and squeaky clean!';
          reinforceBrain(t.brain, 'cleanWeight');
        }
      }
      return;
    }

    if (this.activeTool === 'toy') {
      const item = this.spawnItem('ball', x, y);
      item.vx = (Math.random() - 0.5) * 90;
      item.vy = (Math.random() - 0.5) * 90;
      this.spawnParticles(item.x, item.y, '#f472b6', 8);
      this.emitChirpWave(item.x, item.y, 180, '#f472b6', 'TOY');
      audio.playChirp(1.3, 'happy');
      return;
    }

    if (this.activeTool === 'clean') {
      // Clean waste near click or all waste within radius
      let cleaned = 0;
      this.items = this.items.filter((it) => {
        if (it.type === 'waste' && Math.hypot(it.x - x, it.y - y) < 85) {
          cleaned++;
          this.spawnParticles(it.x, it.y, '#a7f3d0', 8);
          return false;
        }
        return true;
      });
      if (cleaned > 0) {
        audio.playWash();
        this.addLog('SYSTEM', `Sanitized ${cleaned} bio-waste cluster(s).`, '#38bdf8');
      } else {
        audio.playClick();
      }
      return;
    }
  }

  public triggerColonyAction(action: 'mass_feed' | 'rain_shower' | 'harmonic_chirp'): void {
    if (action === 'mass_feed') {
      for (let i = 0; i < 5; i++) {
        const pt = this.randomIslandPoint();
        this.spawnItem(i % 2 === 0 ? 'apple' : 'nutrient_cube', pt.x, pt.y);
        this.spawnParticles(pt.x, pt.y, '#4ade80', 6);
      }
      audio.playChirp(1.15, 'happy');
      this.addLog('SYSTEM', 'Nutrient drop deployed across the island.', '#4ade80');
    } else if (action === 'rain_shower') {
      // Clean all waste and boost hygiene of all Thronglets
      this.items = this.items.filter((it) => it.type !== 'waste');
      for (const t of this.thronglets) {
        t.needs.hygiene = 100;
        t.emote = '🫧';
        t.emoteTimer = 2.0;
        this.spawnParticles(t.x, t.y - 10, '#38bdf8', 6);
      }
      audio.playWash();
      this.addLog('SYSTEM', 'Warm cleansing rain washed the entire colony!', '#38bdf8');
    } else if (action === 'harmonic_chirp') {
      for (const t of this.thronglets) {
        t.needs.fun = Math.min(100, t.needs.fun + 28);
        t.needs.social = 100;
        t.emote = '🎵';
        t.emoteTimer = 2.2;
        this.emitChirpWave(t.x, t.y, 90, '#facc15', 'SYNAPSE');
      }
      audio.playMitosis();
      this.addLog(
        'THRONG',
        'We hear your melody, Caretaker! Our frequencies align in harmony!',
        '#facc15'
      );
    }
  }

  public emitChirpWave(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    topic: ChirpWave['topic']
  ): void {
    this.chirpWaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      color,
      topic,
    });
    this.totalChirps++;

    // Propagate knowledge to Thronglets within range
    for (const t of this.thronglets) {
      const dist = Math.hypot(t.x - x, t.y - y);
      if (dist <= maxRadius) {
        if (topic === 'FOOD') {
          t.brain.knownFoodPos = { x, y, tick: this.tickCount };
        } else if (topic === 'TOY') {
          t.brain.knownToyPos = { x, y, tick: this.tickCount };
        } else if (topic === 'SYNAPSE' || topic === 'GREETING') {
          t.needs.social = Math.min(100, t.needs.social + 8);
        }
      }
    }
  }

  public spawnParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    text?: string
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color,
        size: 2 + Math.random() * 2.5,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.0,
        text: i === 0 ? text : undefined,
      });
    }
  }

  public addLog(
    source: LogEntry['source'],
    text: string,
    color: string = '#e2e8f0'
  ): void {
    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8);
    this.logs.unshift({
      id: this.nextLogId++,
      timestamp,
      source,
      text,
      color,
    });
    if (this.logs.length > 45) {
      this.logs.pop();
    }
  }

  public update(dt: number): void {
    const scaledDt = dt * this.simSpeed;
    if (scaledDt <= 0) return;

    this.tickCount++;
    this.collectiveTimer += scaledDt;

    // Update items (ball physics, bubble evaporation, waste hygiene impact)
    this.updateItems(scaledDt);

    // Update Thronglets
    const wasteCount = this.items.filter((i) => i.type === 'waste').length;
    for (const agent of this.thronglets) {
      if (!agent.isAlive) continue;
      this.updateThronglet(agent, scaledDt, wasteCount);
    }

    // Remove consumed items
    this.items = this.items.filter((it) => it.amount > 0);

    // Update chirp waves
    for (const wave of this.chirpWaves) {
      wave.radius += scaledDt * 125;
    }
    this.chirpWaves = this.chirpWaves.filter((w) => w.radius < w.maxRadius);

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * scaledDt;
      p.y += p.vy * scaledDt;
      p.life -= scaledDt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Periodic collective Throng log message
    if (this.collectiveTimer >= 9.5) {
      this.collectiveTimer = 0;
      this.emitCollectiveThought();
    }
  }

  private updateItems(dt: number): void {
    for (const item of this.items) {
      if (item.type === 'ball') {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.vx *= Math.pow(0.25, dt);
        item.vy *= Math.pow(0.25, dt);

        if (!this.isInsideIsland(item.x, item.y, 0.85)) {
          const clamped = this.clampToIsland(item.x, item.y, 0.85);
          item.x = clamped.x;
          item.y = clamped.y;
          item.vx = -item.vx * 0.7;
          item.vy = -item.vy * 0.7;
        }
      } else if (item.type === 'bubble_puddle') {
        item.amount -= dt * 12;
      }
    }
  }

  private updateThronglet(agent: Thronglet, dt: number, wasteCount: number): void {
    agent.age += dt;
    agent.animPhase += dt * (agent.action === 'SLEEP' ? 2.5 : 8.5);
    if (agent.emoteTimer > 0) {
      agent.emoteTimer -= dt;
      if (agent.emoteTimer <= 0) agent.emote = null;
    }

    const { needs, brain } = agent;
    const { genome } = brain;

    // Passive need decay
    const sleepMult = agent.action === 'SLEEP' ? 0.35 : 1.0;
    needs.hunger = Math.max(0, needs.hunger - dt * 1.45 * genome.metabolism * sleepMult);
    needs.hygiene = Math.max(
      0,
      needs.hygiene - dt * (0.95 + wasteCount * 0.35) * (1.2 - genome.neatness * 0.25)
    );
    needs.fun = Math.max(0, needs.fun - dt * 1.15 * sleepMult);
    needs.social = Math.max(0, needs.social - dt * 0.85 * genome.sociability);

    if (agent.action === 'SLEEP') {
      needs.energy = Math.min(100, needs.energy + dt * 9.5);
    } else {
      needs.energy = Math.max(0, needs.energy - dt * 1.1 * genome.metabolism);
    }

    // Occasional bio-waste generation after eating well
    if (Math.random() < dt * 0.018 && this.items.filter((i) => i.type === 'waste').length < 8) {
      this.spawnItem('waste', agent.x - agent.facing * 10, agent.y + 6);
    }

    // Reproduction / Mitosis progress when thriving!
    const avgWellbeing =
      (needs.hunger + needs.hygiene + needs.fun + needs.energy + needs.social) / 5;

    if (avgWellbeing > 72 && needs.hunger > 65 && this.thronglets.length < 36) {
      agent.reproductionProgress = Math.min(100, agent.reproductionProgress + dt * 4.5);
      if (agent.reproductionProgress >= 100 && agent.action !== 'MITOSIS') {
        agent.action = 'MITOSIS';
        agent.actionTimer = 2.0;
        agent.emote = '🧬';
        agent.emoteTimer = 2.0;
        agent.brain.currentThought = 'Cell division initiated! Expanding the Throng!';
        audio.playMitosis();
        return;
      }
    } else if (avgWellbeing < 45) {
      agent.reproductionProgress = Math.max(0, agent.reproductionProgress - dt * 1.5);
    }

    // Handle active Mitosis animation
    if (agent.action === 'MITOSIS') {
      agent.actionTimer -= dt;
      if (agent.actionTimer <= 0) {
        agent.reproductionProgress = 0;
        agent.needs.hunger = Math.max(45, agent.needs.hunger - 22);
        agent.needs.energy = Math.max(45, agent.needs.energy - 20);
        const child = this.spawnThronglet(
          agent.x + (Math.random() - 0.5) * 28,
          agent.y + (Math.random() - 0.5) * 24,
          agent.generation + 1,
          agent
        );
        this.spawnParticles(child.x, child.y, '#facc15', 14, 'NEW!');
        this.emitChirpWave(child.x, child.y, 130, '#facc15', 'SYNAPSE');
        this.addLog(
          'THRONG',
          `${agent.name} underwent mitosis → welcomed ${child.name} (Gen ${child.generation})!`,
          '#facc15'
        );
        agent.action = 'WANDER';
      }
      return;
    }

    // Re-evaluate AI decision periodically
    agent.actionTimer -= dt;
    if (agent.actionTimer <= 0) {
      const decision = evaluateBrainDecision(
        agent,
        this.items,
        this.thronglets,
        this.tickCount
      );
      agent.action = decision.action;
      agent.brain.currentThought = decision.thought;
      agent.targetItemId = decision.targetItem?.id ?? null;
      agent.targetPeerId = decision.targetPeer?.id ?? null;
      agent.actionTimer = 1.2 + Math.random() * 1.2;

      if (agent.action === 'WANDER' || agent.action === 'PONDER') {
        const pt = this.randomIslandPoint();
        agent.targetX = pt.x;
        agent.targetY = pt.y;
      }
    }

    // Execute chosen action
    const baseSpeed = 48 * genome.metabolism;

    if (agent.action === 'SEEK_FOOD') {
      const food = this.items.find((i) => i.id === agent.targetItemId && i.amount > 0);
      if (food) {
        this.moveTowards(agent, food.x, food.y, baseSpeed * 1.15, dt);
        if (Math.hypot(food.x - agent.x, food.y - agent.y) < 20) {
          food.amount -= 1;
          needs.hunger = Math.min(100, needs.hunger + 28);
          needs.fun = Math.min(100, needs.fun + 5);
          agent.emote = '🍎';
          agent.emoteTimer = 1.2;
          reinforceBrain(brain, 'foodWeight');
          this.spawnParticles(food.x, food.y, '#4ade80', 5);
          audio.playEat();
          // Broadcast food discovery chirp
          if (brain.chirpCooldown <= 0) {
            this.emitChirpWave(agent.x, agent.y, 140, '#4ade80', 'FOOD');
            brain.chirpCooldown = 5;
          }
          agent.actionTimer = 0.2;
        }
      } else {
        agent.actionTimer = 0;
      }
    } else if (agent.action === 'BATHE') {
      const bath = this.items.find((i) => i.id === agent.targetItemId && i.amount > 0);
      if (bath) {
        this.moveTowards(agent, bath.x, bath.y, baseSpeed, dt);
        if (Math.hypot(bath.x - agent.x, bath.y - agent.y) < 26) {
          needs.hygiene = Math.min(100, needs.hygiene + dt * 38);
          bath.amount -= dt * 15;
          agent.emote = '🫧';
          agent.emoteTimer = 1.0;
          reinforceBrain(brain, 'cleanWeight');
        }
      } else {
        agent.actionTimer = 0;
      }
    } else if (agent.action === 'SEEK_TOY') {
      const ball = this.items.find((i) => i.id === agent.targetItemId);
      if (ball) {
        this.moveTowards(agent, ball.x, ball.y, baseSpeed * 1.25, dt);
        if (Math.hypot(ball.x - agent.x, ball.y - agent.y) < 22) {
          // Kick the ball!
          const angle = Math.atan2(ball.y - agent.y, ball.x - agent.x) + (Math.random() - 0.5) * 0.5;
          ball.vx = Math.cos(angle) * 140;
          ball.vy = Math.sin(angle) * 140;
          needs.fun = Math.min(100, needs.fun + 22);
          needs.social = Math.min(100, needs.social + 8);
          agent.emote = '⚽';
          agent.emoteTimer = 1.2;
          reinforceBrain(brain, 'toyWeight');
          this.spawnParticles(ball.x, ball.y, '#f472b6', 5);
          audio.playChirp(1.25, 'happy');
          if (brain.chirpCooldown <= 0) {
            this.emitChirpWave(agent.x, agent.y, 130, '#f472b6', 'TOY');
            brain.chirpCooldown = 4;
          }
          agent.actionTimer = 0.5;
        }
      } else {
        agent.actionTimer = 0;
      }
    } else if (agent.action === 'SOCIALIZE') {
      const peer = this.thronglets.find((p) => p.id === agent.targetPeerId && p.isAlive);
      if (peer) {
        this.moveTowards(agent, peer.x, peer.y, baseSpeed * 0.95, dt);
        if (Math.hypot(peer.x - agent.x, peer.y - agent.y) < 28) {
          needs.social = Math.min(100, needs.social + 20);
          needs.fun = Math.min(100, needs.fun + 10);
          peer.needs.social = Math.min(100, peer.needs.social + 15);
          agent.emote = '💬';
          agent.emoteTimer = 1.3;
          reinforceBrain(brain, 'socialWeight');

          // Share food/toy coordinates between brains!
          if (agent.brain.knownFoodPos && !peer.brain.knownFoodPos) {
            peer.brain.knownFoodPos = { ...agent.brain.knownFoodPos };
          }
          if (brain.chirpCooldown <= 0) {
            this.emitChirpWave(agent.x, agent.y, 95, '#38bdf8', 'GREETING');
            audio.playChirp(0.95 + Math.random() * 0.25, 'social');
            brain.chirpCooldown = 5;
          }
          agent.actionTimer = 0;
        }
      } else {
        agent.actionTimer = 0;
      }
    } else if (agent.action === 'WANDER' && agent.targetX !== null && agent.targetY !== null) {
      this.moveTowards(agent, agent.targetX, agent.targetY, baseSpeed * 0.7, dt);
    }

    if (brain.chirpCooldown > 0) {
      brain.chirpCooldown -= dt;
    }

    // Distress emote if starving or filthy
    if (needs.hunger < 22 && !agent.emote) {
      agent.emote = '💢';
      agent.emoteTimer = 1.0;
    } else if (needs.hygiene < 22 && !agent.emote) {
      agent.emote = '🪰';
      agent.emoteTimer = 1.0;
    }
  }

  private moveTowards(
    agent: Thronglet,
    tx: number,
    ty: number,
    speed: number,
    dt: number
  ): void {
    const dx = tx - agent.x;
    const dy = ty - agent.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    agent.vx = (dx / dist) * speed;
    agent.vy = (dy / dist) * speed;
    if (Math.abs(agent.vx) > 1) {
      agent.facing = agent.vx > 0 ? 1 : -1;
    }

    const next = this.clampToIsland(agent.x + agent.vx * dt, agent.y + agent.vy * dt);
    agent.x = next.x;
    agent.y = next.y;
  }

  private emitCollectiveThought(): void {
    if (this.thronglets.length === 0) return;
    const avgHunger =
      this.thronglets.reduce((s, t) => s + t.needs.hunger, 0) / this.thronglets.length;
    const avgHygiene =
      this.thronglets.reduce((s, t) => s + t.needs.hygiene, 0) / this.thronglets.length;
    const avgFun =
      this.thronglets.reduce((s, t) => s + t.needs.fun, 0) / this.thronglets.length;
    const maxGen = Math.max(...this.thronglets.map((t) => t.generation));

    let msg = '';
    let color = '#facc15';

    if (avgHunger < 38) {
      msg = 'COLLECTIVE SIGNAL: Our energy reserves dwindle. Caretaker, may we have nutrients?';
      color = '#f87171';
    } else if (avgHygiene < 42) {
      msg = 'COLLECTIVE SIGNAL: Bio-residue detected on the island. A cleansing wash would soothe us.';
      color = '#fb923c';
    } else if (avgFun < 42) {
      msg = 'COLLECTIVE SIGNAL: Our neural pathways crave stimulation. Drop a toy orb for us to study!';
      color = '#c084fc';
    } else if (this.thronglets.length >= 10) {
      msg = `COLLECTIVE SIGNAL: ${this.thronglets.length} nodes linked (Gen ${maxGen}). Our peaceful island symposium flourishes!`;
      color = '#4ade80';
    } else {
      const thoughts = [
        `COLLECTIVE SIGNAL: ${this.thronglets.length} minds humming in peaceful unison inside the Tuckersoft sandbox.`,
        'COLLECTIVE SIGNAL: We observe the gentle pixel waves around our island sanctuary.',
        `COLLECTIVE SIGNAL: Synaptic harmony at ${Math.round((avgHunger + avgHygiene + avgFun) / 3)}%. Caretaker is kind.`,
        'COLLECTIVE SIGNAL: Exchanging chirp-packets to optimize foraging routes.',
      ];
      msg = thoughts[this.tickCount % thoughts.length];
    }

    this.addLog('THRONG', msg, color);
  }
}

