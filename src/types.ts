export type ToolType = 'inspect' | 'feed' | 'wash' | 'toy' | 'clean' | 'shower';

export type ThrongletAction =
  | 'WANDER'
  | 'SEEK_FOOD'
  | 'EAT'
  | 'SEEK_TOY'
  | 'PLAY'
  | 'SOCIALIZE'
  | 'SLEEP'
  | 'BATHE'
  | 'MITOSIS'
  | 'PONDER';

export interface ThrongletNeeds {
  hunger: number;   // 0 (starving) to 100 (full)
  hygiene: number;  // 0 (filthy) to 100 (sparkling clean)
  fun: number;      // 0 (bored) to 100 (ecstatic)
  energy: number;   // 0 (exhausted) to 100 (rested)
  social: number;   // 0 (lonely) to 100 (connected to the Throng)
}

export interface ThrongletGenome {
  curiosity: number;    // 0.3 - 1.7: exploration speed & toy interest
  sociability: number;  // 0.3 - 1.7: desire to cluster & chirp with peers
  metabolism: number;   // 0.5 - 1.5: speed vs hunger drain
  neatness: number;     // 0.3 - 1.7: sensitivity to dirt & waste
  hueShift: number;     // -18 to +18 degrees around classic yellow-amber
}

export interface NeuralWeights {
  foodWeight: number;
  toyWeight: number;
  socialWeight: number;
  restWeight: number;
  cleanWeight: number;
}

export interface BrainUtilityScores {
  action: ThrongletAction;
  score: number;
  label: string;
}

export interface ThrongletBrain {
  genome: ThrongletGenome;
  weights: NeuralWeights;
  lastUtilities: BrainUtilityScores[];
  knownFoodPos: { x: number; y: number; tick: number } | null;
  knownToyPos: { x: number; y: number; tick: number } | null;
  currentThought: string;
  chirpCooldown: number;
  experiencePoints: number;
}

export interface Thronglet {
  id: number;
  name: string;
  generation: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  targetItemId: number | null;
  targetPeerId: number | null;
  age: number; // in seconds
  needs: ThrongletNeeds;
  brain: ThrongletBrain;
  action: ThrongletAction;
  actionTimer: number;
  reproductionProgress: number; // 0 to 100, triggers MITOSIS at 100
  animPhase: number;
  facing: -1 | 1;
  emote: string | null;
  emoteTimer: number;
  isAlive: boolean;
}

export type WorldItemType = 'apple' | 'nutrient_cube' | 'ball' | 'waste' | 'bubble_puddle';

export interface WorldItem {
  id: number;
  type: WorldItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number; // remaining bites/uses or lifetime
  maxAmount: number;
  createdAt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  text?: string;
}

export interface ChirpWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  topic: 'FOOD' | 'TOY' | 'GREETING' | 'DISTRESSED' | 'SYNAPSE';
}

export interface LogEntry {
  id: number;
  timestamp: string;
  source: 'SYSTEM' | 'THRONG' | 'AGENT' | 'CONTAINMENT';
  text: string;
  color: string;
}

