import {
  BrainUtilityScores,
  NeuralWeights,
  Thronglet,
  ThrongletAction,
  ThrongletBrain,
  ThrongletGenome,
  WorldItem,
} from './types';

const THRONG_SYLLABLES = [
  'Pip', 'Bip', 'Zim', 'Koko', 'Luma', 'Nini', 'Toto', 'Mimi',
  'Poko', 'Chirp', 'Bobo', 'Yoyo', 'Vivi', 'Dodo', 'Fifi', 'Gigi',
  'Ruru', 'Sisi', 'Wawa', 'Zuzu',
];

export function generateThrongletName(id: number): string {
  const base = THRONG_SYLLABLES[id % THRONG_SYLLABLES.length];
  return `${base}-${String(id).padStart(2, '0')}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createBrain(parentBrain?: ThrongletBrain): ThrongletBrain {
  if (!parentBrain) {
    return {
      genome: {
        curiosity: 0.8 + Math.random() * 0.4,
        sociability: 0.8 + Math.random() * 0.4,
        metabolism: 0.85 + Math.random() * 0.3,
        neatness: 0.8 + Math.random() * 0.4,
        hueShift: (Math.random() - 0.5) * 16,
      },
      weights: {
        foodWeight: 1.0,
        toyWeight: 1.0,
        socialWeight: 1.0,
        restWeight: 1.0,
        cleanWeight: 1.0,
      },
      lastUtilities: [],
      knownFoodPos: null,
      knownToyPos: null,
      currentThought: 'Awakening on the island...',
      chirpCooldown: 2 + Math.random() * 4,
      experiencePoints: 0,
    };
  }

  // Inherit genome and learned weights with slight mutation
  const mutate = (v: number, min: number, max: number, rate = 0.16) =>
    clamp(v + (Math.random() - 0.5) * rate, min, max);

  return {
    genome: {
      curiosity: mutate(parentBrain.genome.curiosity, 0.35, 1.65),
      sociability: mutate(parentBrain.genome.sociability, 0.35, 1.65),
      metabolism: mutate(parentBrain.genome.metabolism, 0.55, 1.45),
      neatness: mutate(parentBrain.genome.neatness, 0.35, 1.65),
      hueShift: clamp(parentBrain.genome.hueShift + (Math.random() - 0.5) * 8, -22, 22),
    },
    weights: {
      foodWeight: mutate(parentBrain.weights.foodWeight, 0.5, 1.8, 0.1),
      toyWeight: mutate(parentBrain.weights.toyWeight, 0.5, 1.8, 0.1),
      socialWeight: mutate(parentBrain.weights.socialWeight, 0.5, 1.8, 0.1),
      restWeight: mutate(parentBrain.weights.restWeight, 0.5, 1.8, 0.1),
      cleanWeight: mutate(parentBrain.weights.cleanWeight, 0.5, 1.8, 0.1),
    },
    lastUtilities: [],
    knownFoodPos: parentBrain.knownFoodPos ? { ...parentBrain.knownFoodPos } : null,
    knownToyPos: parentBrain.knownToyPos ? { ...parentBrain.knownToyPos } : null,
    currentThought: 'Born from mitosis! Hello Throng!',
    chirpCooldown: 3,
    experiencePoints: Math.floor(parentBrain.experiencePoints * 0.4),
  };
}

export function evaluateBrainDecision(
  agent: Thronglet,
  items: WorldItem[],
  peers: Thronglet[],
  simTick: number
): {
  action: ThrongletAction;
  targetItem: WorldItem | null;
  targetPeer: Thronglet | null;
  thought: string;
} {
  const { needs, brain } = agent;
  const { genome, weights } = brain;

  // Sense nearby items within vision radius
  const visionRadius = 190 * genome.curiosity;
  let nearestFood: WorldItem | null = null;
  let minFoodDist = Infinity;

  let nearestToy: WorldItem | null = null;
  let minToyDist = Infinity;

  let nearestBath: WorldItem | null = null;
  let minBathDist = Infinity;

  for (const item of items) {
    if (item.amount <= 0) continue;
    const dist = Math.hypot(item.x - agent.x, item.y - agent.y);
    if ((item.type === 'apple' || item.type === 'nutrient_cube') && dist < minFoodDist) {
      minFoodDist = dist;
      nearestFood = item;
    } else if (item.type === 'ball' && dist < minToyDist) {
      minToyDist = dist;
      nearestToy = item;
    } else if (item.type === 'bubble_puddle' && dist < minBathDist) {
      minBathDist = dist;
      nearestBath = item;
    }
  }

  // Update spatial memory if spotted within vision
  if (nearestFood && minFoodDist <= visionRadius) {
    brain.knownFoodPos = { x: nearestFood.x, y: nearestFood.y, tick: simTick };
  }
  if (nearestToy && minToyDist <= visionRadius) {
    brain.knownToyPos = { x: nearestToy.x, y: nearestToy.y, tick: simTick };
  }

  // Find nearest peer for social interaction
  let nearestPeer: Thronglet | null = null;
  let minPeerDist = Infinity;
  for (const peer of peers) {
    if (peer.id === agent.id || !peer.isAlive) continue;
    const d = Math.hypot(peer.x - agent.x, peer.y - agent.y);
    if (d < minPeerDist) {
      minPeerDist = d;
      nearestPeer = peer;
    }
  }

  // Compute utility scores (0 - 100)
  const hungerDeficit = 100 - needs.hunger;
  const foodAvailableBonus = nearestFood ? 1.25 : brain.knownFoodPos ? 0.9 : 0.35;
  const foodScore = clamp(
    hungerDeficit * weights.foodWeight * foodAvailableBonus,
    0,
    100
  );

  const energyDeficit = 100 - needs.energy;
  const sleepScore = clamp(
    (needs.energy < 28 ? energyDeficit * 1.35 : energyDeficit * 0.65) * weights.restWeight,
    0,
    100
  );

  const hygieneDeficit = 100 - needs.hygiene;
  const bathAvailableBonus = nearestBath ? 1.35 : 0.55;
  const batheScore = clamp(
    hygieneDeficit * genome.neatness * weights.cleanWeight * bathAvailableBonus,
    0,
    100
  );

  const funDeficit = 100 - needs.fun;
  const toyBonus = nearestToy ? 1.3 : 0.65;
  const playScore = clamp(
    funDeficit * genome.curiosity * weights.toyWeight * toyBonus,
    0,
    100
  );

  const socialDeficit = 100 - needs.social;
  const peerBonus = nearestPeer ? 1.2 : 0.3;
  const socialScore = clamp(
    socialDeficit * genome.sociability * weights.socialWeight * peerBonus,
    0,
    100
  );

  const wanderScore = clamp(24 * genome.curiosity, 10, 45);

  const utilities: BrainUtilityScores[] = [
    { action: 'SEEK_FOOD' as ThrongletAction, score: Math.round(foodScore), label: 'Forage' },
    { action: 'SLEEP' as ThrongletAction, score: Math.round(sleepScore), label: 'Rest' },
    { action: 'BATHE' as ThrongletAction, score: Math.round(batheScore), label: 'Wash' },
    { action: 'SEEK_TOY' as ThrongletAction, score: Math.round(playScore), label: 'Play' },
    { action: 'SOCIALIZE' as ThrongletAction, score: Math.round(socialScore), label: 'Chirp' },
    { action: 'WANDER' as ThrongletAction, score: Math.round(wanderScore), label: 'Explore' },
  ].sort((a, b) => b.score - a.score);

  brain.lastUtilities = utilities;
  const best = utilities[0];

  if (best.action === 'SEEK_FOOD') {
    if (nearestFood) {
      return {
        action: 'SEEK_FOOD',
        targetItem: nearestFood,
        targetPeer: null,
        thought: minFoodDist < 35 ? 'Yum! Nutrient intake!' : 'Sensing nutrients nearby...',
      };
    }
    return {
      action: 'WANDER',
      targetItem: null,
      targetPeer: null,
      thought: needs.hunger < 30 ? 'Hungry... Caretaker, drop food?' : 'Sniffing around for snacks...',
    };
  }

  if (best.action === 'SLEEP') {
    return {
      action: 'SLEEP',
      targetItem: null,
      targetPeer: null,
      thought: 'Zzz... dreaming in binary...',
    };
  }

  if (best.action === 'BATHE') {
    if (nearestBath) {
      return {
        action: 'BATHE',
        targetItem: nearestBath,
        targetPeer: null,
        thought: 'Splashing in clean bubbles!',
      };
    }
    return {
      action: 'WANDER',
      targetItem: null,
      targetPeer: null,
      thought: needs.hygiene < 35 ? 'Feeling grimy... need a wash!' : 'Looking for clean water...',
    };
  }

  if (best.action === 'SEEK_TOY') {
    if (nearestToy) {
      return {
        action: 'SEEK_TOY',
        targetItem: nearestToy,
        targetPeer: null,
        thought: 'Chasing the bouncy orb!',
      };
    }
    return {
      action: 'PONDER',
      targetItem: null,
      targetPeer: null,
      thought: 'Observing the island geometry...',
    };
  }

  if (best.action === 'SOCIALIZE' && nearestPeer) {
    return {
      action: 'SOCIALIZE',
      targetItem: null,
      targetPeer: nearestPeer,
      thought: `Syncing neural state with ${nearestPeer.name}`,
    };
  }

  return {
    action: 'WANDER',
    targetItem: null,
    targetPeer: null,
    thought: 'Exploring our peaceful sanctuary.',
  };
}

export function reinforceBrain(brain: ThrongletBrain, rewardType: keyof NeuralWeights): void {
  brain.weights[rewardType] = clamp(brain.weights[rewardType] + 0.03, 0.5, 1.85);
  brain.experiencePoints += 1;
}

