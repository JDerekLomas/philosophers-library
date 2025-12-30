/**
 * Agent Movement System
 * Handles wandering, pathfinding, and collision avoidance
 */

import {
  SimAgent,
  SimulationState,
  BOUNDS,
  CONVERSATION_DISTANCE,
} from './state';

// How close agents need to be to avoid each other
const AVOIDANCE_DISTANCE = 60;

// How often to pick a new target (ms)
const RETARGET_INTERVAL = 3000;

// Generate a random position within bounds
export function randomPosition(): { x: number; y: number } {
  return {
    x: BOUNDS.minX + Math.random() * (BOUNDS.maxX - BOUNDS.minX),
    y: BOUNDS.minY + Math.random() * (BOUNDS.maxY - BOUNDS.minY),
  };
}

// Calculate distance between two points
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Check if agent has reached their target
function hasReachedTarget(agent: SimAgent): boolean {
  return distance(agent.x, agent.y, agent.targetX, agent.targetY) < 5;
}

// Pick a new random target for an agent
export function pickNewTarget(agent: SimAgent): void {
  const pos = randomPosition();
  agent.targetX = pos.x;
  agent.targetY = pos.y;
}

// Move agent toward their target
function moveTowardTarget(agent: SimAgent, deltaTime: number, speedMultiplier: number): void {
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 1) {
    const moveSpeed = agent.speed * speedMultiplier * deltaTime * 0.1;
    const moveX = (dx / dist) * moveSpeed;
    const moveY = (dy / dist) * moveSpeed;

    agent.x += moveX;
    agent.y += moveY;

    // Clamp to bounds
    agent.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, agent.x));
    agent.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, agent.y));
  }
}

// Apply separation force to avoid other agents
function applySeparation(agent: SimAgent, others: SimAgent[]): void {
  for (const other of others) {
    if (other.id === agent.id) continue;

    const dist = distance(agent.x, agent.y, other.x, other.y);
    if (dist < AVOIDANCE_DISTANCE && dist > 0) {
      // Push away from other agent
      const pushStrength = (AVOIDANCE_DISTANCE - dist) / AVOIDANCE_DISTANCE;
      const dx = agent.x - other.x;
      const dy = agent.y - other.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        agent.x += (dx / len) * pushStrength * 2;
        agent.y += (dy / len) * pushStrength * 2;
      }
    }
  }

  // Clamp to bounds after separation
  agent.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, agent.x));
  agent.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, agent.y));
}

// Find pairs of agents that are close enough to converse
export function findConversationCandidates(
  state: SimulationState
): [SimAgent, SimAgent] | null {
  const now = state.time;

  for (let i = 0; i < state.agents.length; i++) {
    const agent1 = state.agents[i];

    // Skip if already in conversation or on cooldown
    if (agent1.state === 'conversing') continue;
    if (now - agent1.lastConversationTime < 15000) continue; // 15s cooldown

    for (let j = i + 1; j < state.agents.length; j++) {
      const agent2 = state.agents[j];

      // Skip if already in conversation or on cooldown
      if (agent2.state === 'conversing') continue;
      if (now - agent2.lastConversationTime < 15000) continue;

      const dist = distance(agent1.x, agent1.y, agent2.x, agent2.y);
      if (dist < CONVERSATION_DISTANCE) {
        return [agent1, agent2];
      }
    }
  }

  return null;
}

// Update all agent positions
export function updateAgentMovement(
  state: SimulationState,
  deltaTime: number
): void {
  for (const agent of state.agents) {
    // Don't move if conversing
    if (agent.state === 'conversing') continue;

    // Check if we need a new target
    if (hasReachedTarget(agent)) {
      agent.state = 'idle';

      // Random chance to start wandering again
      if (Math.random() < 0.02) { // ~2% chance per frame when idle
        pickNewTarget(agent);
        agent.state = 'wandering';
      }
    } else {
      agent.state = 'wandering';
      moveTowardTarget(agent, deltaTime, state.speed);
    }

    // Apply separation from other agents
    applySeparation(agent, state.agents);
  }
}

// Start agents wandering after initialization
export function startWandering(state: SimulationState): void {
  for (const agent of state.agents) {
    pickNewTarget(agent);
    agent.state = 'wandering';
  }
}
