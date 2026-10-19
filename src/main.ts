import './style.css';
import { audio } from './audio';
import { RetroRenderer } from './renderer';
import { ThrongSimulation } from './simulation';
import { ToolType } from './types';

const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
const sim = new ThrongSimulation();
const renderer = new RetroRenderer(canvas, sim);

const TOOL_HINTS: Record<ToolType, string> = {
  feed: 'Click on the island to drop apples & nutrient cubes for the Thronglets',
  wash: 'Click near Thronglets to scrub them with soapy bubbles & clean waste',
  toy: 'Click to drop a bouncy orb that Thronglets will chase and kick together',
  inspect: 'Click directly on any Thronglet to inspect its AI brain & pet it',
  clean: 'Click near bio-waste on the island to sanitize the habitat',
  shower: 'Raining warm water over the island',
};

// Tool Selection
const toolButtons = document.querySelectorAll<HTMLButtonElement>('.tool-btn');
const hintEl = document.getElementById('tool-hint')!;

function selectTool(tool: ToolType): void {
  sim.activeTool = tool;
  toolButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  hintEl.textContent = TOOL_HINTS[tool] || '';
  audio.playClick();
}

toolButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool as ToolType;
    if (tool) selectTool(tool);
  });
});

// Keyboard shortcuts 1-5
window.addEventListener('keydown', (e) => {
  if (e.key === '1') selectTool('feed');
  else if (e.key === '2') selectTool('wash');
  else if (e.key === '3') selectTool('toy');
  else if (e.key === '4') selectTool('inspect');
  else if (e.key === '5') selectTool('clean');
});

// Canvas Interaction
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Also allow selecting a Thronglet on any click if close enough
  for (const t of sim.thronglets) {
    if (Math.hypot(t.x - x, t.y - y) < 20) {
      sim.selectedThrongletId = t.id;
      break;
    }
  }

  sim.handleCanvasClick(x, y);
  updateUI();
});

// Colony Care Quick Actions
document.getElementById('act-feast')?.addEventListener('click', () => {
  sim.triggerColonyAction('mass_feed');
  updateUI();
});
document.getElementById('act-rain')?.addEventListener('click', () => {
  sim.triggerColonyAction('rain_shower');
  updateUI();
});
document.getElementById('act-chirp')?.addEventListener('click', () => {
  sim.triggerColonyAction('harmonic_chirp');
  updateUI();
});

// Top Bar Controls
const btnSpeed = document.getElementById('btn-speed')!;
btnSpeed.addEventListener('click', () => {
  const speeds = [1, 2, 4, 0];
  const nextIdx = (speeds.indexOf(sim.simSpeed) + 1) % speeds.length;
  sim.simSpeed = speeds[nextIdx];
  btnSpeed.textContent = sim.simSpeed === 0 ? 'PAUSED' : `SPEED: ${sim.simSpeed}x`;
  audio.playClick();
});

const btnSynapse = document.getElementById('btn-synapse')!;
btnSynapse.addEventListener('click', () => {
  renderer.showSynapseLinks = !renderer.showSynapseLinks;
  btnSynapse.textContent = `SYNAPSES: ${renderer.showSynapseLinks ? 'ON' : 'OFF'}`;
  btnSynapse.classList.toggle('active', renderer.showSynapseLinks);
  audio.playClick();
});

const btnAudio = document.getElementById('btn-audio')!;
btnAudio.addEventListener('click', () => {
  audio.muted = !audio.muted;
  btnAudio.textContent = `AUDIO: ${audio.muted ? 'OFF' : 'ON'}`;
  btnAudio.classList.toggle('active', !audio.muted);
  if (!audio.muted) audio.playClick();
});

document.getElementById('btn-reset')?.addEventListener('click', () => {
  sim.resetWorld();
  audio.playClick();
  updateUI();
});

document.getElementById('btn-next-agent')?.addEventListener('click', () => {
  if (sim.thronglets.length === 0) return;
  const idx = sim.thronglets.findIndex((t) => t.id === sim.selectedThrongletId);
  const next = sim.thronglets[(idx + 1) % sim.thronglets.length];
  sim.selectedThrongletId = next.id;
  audio.playClick();
  updateUI();
});

// UI DOM References
const statPop = document.getElementById('stat-pop')!;
const statGen = document.getElementById('stat-gen')!;
const statHarmony = document.getElementById('stat-harmony')!;
const statCpu = document.getElementById('stat-cpu')!;
const statChirps = document.getElementById('stat-chirps')!;

const inspName = document.getElementById('insp-name')!;
const inspGen = document.getElementById('insp-gen')!;
const inspAction = document.getElementById('insp-action')!;
const inspThought = document.getElementById('insp-thought')!;
const utilityList = document.getElementById('utility-list')!;
const genomeGrid = document.getElementById('genome-grid')!;
const logContainer = document.getElementById('log-container')!;

let lastRenderedLogId = -1;

function setBar(id: string, val: number): void {
  const bar = document.getElementById(`bar-${id}`);
  const label = document.getElementById(`val-${id}`);
  const clamped = Math.round(Math.max(0, Math.min(100, val)));
  if (bar) bar.style.width = `${clamped}%`;
  if (label) label.textContent = `${clamped}%`;
}

function updateUI(): void {
  const pop = sim.thronglets.length;
  const maxGen = pop > 0 ? Math.max(...sim.thronglets.map((t) => t.generation)) : 1;
  const avgHarmony =
    pop > 0
      ? Math.round(
          sim.thronglets.reduce(
            (acc, t) =>
              acc +
              (t.needs.hunger +
                t.needs.hygiene +
                t.needs.fun +
                t.needs.energy +
                t.needs.social) /
                5,
            0
          ) / pop
        )
      : 0;

  statPop.textContent = String(pop);
  statGen.textContent = String(maxGen);
  statHarmony.textContent = `${avgHarmony}%`;
  // Simulated 1994 CPU clock scaling safely in sandbox
  statCpu.textContent = `${Math.min(133, 8 + pop * 3)} MHz`;
  statChirps.textContent = `${sim.totalChirps} CHIRPS`;

  // Update Selected Thronglet Inspector
  let agent = sim.thronglets.find((t) => t.id === sim.selectedThrongletId);
  if (!agent && sim.thronglets.length > 0) {
    agent = sim.thronglets[0];
    sim.selectedThrongletId = agent.id;
  }

  if (agent) {
    inspName.textContent = agent.name;
    inspGen.textContent = `GEN ${agent.generation}`;
    inspAction.textContent = agent.action;
    inspThought.textContent = `"${agent.brain.currentThought}"`;

    setBar('hunger', agent.needs.hunger);
    setBar('hygiene', agent.needs.hygiene);
    setBar('fun', agent.needs.fun);
    setBar('energy', agent.needs.energy);
    setBar('social', agent.needs.social);
    setBar('mitosis', agent.reproductionProgress);

    // Render AI Utility scores
    utilityList.innerHTML = agent.brain.lastUtilities
      .map(
        (u, idx) => `
        <div class="util-chip ${idx === 0 ? 'top' : ''}">
          <span>${u.label}</span>
          <strong>${u.score}</strong>
        </div>`
      )
      .join('');

    const { genome, weights, experiencePoints } = agent.brain;
    genomeGrid.innerHTML = `
      <div class="genome-item">Curiosity: <span>${genome.curiosity.toFixed(2)}x</span></div>
      <div class="genome-item">Sociability: <span>${genome.sociability.toFixed(2)}x</span></div>
      <div class="genome-item">Metabolism: <span>${genome.metabolism.toFixed(2)}x</span></div>
      <div class="genome-item">Neatness: <span>${genome.neatness.toFixed(2)}x</span></div>
      <div class="genome-item">Forage Wt: <span>${weights.foodWeight.toFixed(2)}</span></div>
      <div class="genome-item">Neural XP: <span>${experiencePoints}</span></div>
    `;
  }

  // Render Logs if updated
  if (sim.logs[0] && sim.logs[0].id !== lastRenderedLogId) {
    lastRenderedLogId = sim.logs[0].id;
    logContainer.innerHTML = sim.logs
      .map(
        (entry) => `
        <div class="log-line">
          <span class="log-time">[${entry.timestamp}]</span>
          <span class="log-source" style="color: ${entry.color}">[${entry.source}]</span>
          <span style="color: ${entry.color}">${entry.text}</span>
        </div>`
      )
      .join('');
  }
}

// Main Animation Loop
let lastTime = performance.now();
let uiTimer = 0;

function loop(now: number): void {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  sim.update(dt);
  renderer.render(now / 1000);

  uiTimer += dt;
  if (uiTimer >= 0.25) {
    uiTimer = 0;
    updateUI();
  }

  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);

