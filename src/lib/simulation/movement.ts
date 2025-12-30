/**
 * Agent Movement & Behavior System
 * Agents move purposefully between library locations based on their interests
 */

import {
  SimAgent,
  SimulationState,
  BOUNDS,
  CONVERSATION_DISTANCE,
  LIBRARY_LOCATIONS,
  LibraryLocation,
  Activity,
} from './state';

// How close to target counts as "arrived"
const ARRIVAL_THRESHOLD = 15;

// Calculate distance between two points
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Find a location that matches agent's interests
function findInterestingLocation(agent: SimAgent): LibraryLocation {
  // Weight locations by how many interests they match
  const weighted = LIBRARY_LOCATIONS.map(loc => {
    const matches = loc.themes.filter(t => agent.interests.includes(t)).length;
    return { loc, weight: matches + 0.5 }; // Base weight so all locations are possible
  });

  // Random weighted selection
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { loc, weight } of weighted) {
    random -= weight;
    if (random <= 0) return loc;
  }

  return LIBRARY_LOCATIONS[0];
}

// Pick a new activity for an idle agent
function pickActivity(agent: SimAgent, state: SimulationState): void {
  // Don't interrupt conversations
  if (agent.state === 'conversing') return;

  const activities: Activity[] = ['reading', 'contemplating', 'studying'];

  // Sometimes seek conversation if haven't talked in a while
  if (state.time - agent.lastConversationTime > 20000 && Math.random() < 0.3) {
    activities.push('seeking_conversation');
  }

  agent.activity = activities[Math.floor(Math.random() * activities.length)];

  // Pick a destination based on activity
  let targetLoc: LibraryLocation;

  if (agent.activity === 'contemplating') {
    targetLoc = LIBRARY_LOCATIONS.find(l => l.id === 'contemplation_alcove')!;
  } else if (agent.activity === 'seeking_conversation') {
    // Go toward another agent
    const others = state.agents.filter(a => a.id !== agent.id && a.state !== 'conversing');
    if (others.length > 0) {
      const target = others[Math.floor(Math.random() * others.length)];
      agent.targetX = target.x;
      agent.targetY = target.y;
      agent.targetLocation = null;
      agent.state = 'walking';
      agent.activityDuration = 10000;
      agent.activityStartTime = state.time;
      return;
    }
    // No one available, just read instead
    agent.activity = 'reading';
    targetLoc = findInterestingLocation(agent);
  } else {
    // Reading or studying - go to interesting location
    targetLoc = findInterestingLocation(agent);
  }

  agent.targetLocation = targetLoc.id;
  agent.targetX = targetLoc.x + (Math.random() - 0.5) * 30;
  agent.targetY = targetLoc.y + 30 + Math.random() * 20; // Stand in front of location
  agent.state = 'walking';
  agent.activityDuration = 8000 + Math.random() * 12000; // 8-20 seconds
  agent.activityStartTime = state.time;
}

// Check if agent has arrived at destination
function hasArrived(agent: SimAgent): boolean {
  return distance(agent.x, agent.y, agent.targetX, agent.targetY) < ARRIVAL_THRESHOLD;
}

// Move agent toward their target
function moveTowardTarget(agent: SimAgent, deltaTime: number, speedMultiplier: number): void {
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 2) {
    const moveSpeed = agent.speed * speedMultiplier * deltaTime * 0.06;
    agent.x += (dx / dist) * Math.min(moveSpeed, dist);
    agent.y += (dy / dist) * Math.min(moveSpeed, dist);

    // Clamp to bounds
    agent.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, agent.x));
    agent.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, agent.y));
  }
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
    if (now - agent1.lastConversationTime < 15000) continue;

    for (let j = i + 1; j < state.agents.length; j++) {
      const agent2 = state.agents[j];

      if (agent2.state === 'conversing') continue;
      if (now - agent2.lastConversationTime < 15000) continue;

      const dist = distance(agent1.x, agent1.y, agent2.x, agent2.y);

      // Close proximity triggers conversation
      if (dist < CONVERSATION_DISTANCE) {
        // Higher chance if one was seeking conversation
        const seekingBonus =
          (agent1.activity === 'seeking_conversation' || agent2.activity === 'seeking_conversation')
            ? 0.8 : 0.3;

        if (Math.random() < seekingBonus) {
          return [agent1, agent2];
        }
      }
    }
  }

  return null;
}

// Update all agent behavior
export function updateAgentMovement(
  state: SimulationState,
  deltaTime: number
): void {
  for (const agent of state.agents) {
    // Don't move if conversing
    if (agent.state === 'conversing') continue;

    // If walking, move toward target
    if (agent.state === 'walking') {
      moveTowardTarget(agent, deltaTime, state.speed);

      if (hasArrived(agent)) {
        // Arrived - start the activity
        if (agent.activity === 'reading' || agent.activity === 'studying') {
          agent.state = 'reading';
        } else if (agent.activity === 'contemplating') {
          agent.state = 'contemplating';
        } else {
          agent.state = 'idle';
        }
        agent.activityStartTime = state.time;
      }
    }

    // If doing an activity, check if it's time for something new
    if (agent.state === 'reading' || agent.state === 'contemplating' || agent.state === 'idle') {
      const elapsed = state.time - agent.activityStartTime;

      if (elapsed > agent.activityDuration || agent.activity === null) {
        // Time for a new activity
        pickActivity(agent, state);
      }
    }
  }
}

// Start agents with initial activities
export function startWandering(state: SimulationState): void {
  for (const agent of state.agents) {
    // Stagger start times so they don't all move at once
    agent.activityStartTime = state.time - Math.random() * 5000;
    agent.activityDuration = 2000 + Math.random() * 3000; // Short initial duration
    agent.state = 'idle';
  }
}
