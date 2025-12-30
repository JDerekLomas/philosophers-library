/**
 * Continuous Thought Generation System
 * Agents are always thinking - generating observations, reflections, and ideas
 * Based on Stanford Generative Agents architecture
 */

import { SimAgent, SimulationState, MemoryEntry, LIBRARY_LOCATIONS } from './state';

// How often agents generate thoughts (ms) - staggered per agent
const THOUGHT_INTERVAL = 8000; // Every 8 seconds base

// Maximum memories to keep per agent (prevents unbounded growth)
const MAX_MEMORIES = 50;

// Generate a unique ID for memory entries
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get context about what agent is currently doing/seeing
function getAgentContext(agent: SimAgent, state: SimulationState): string {
  const location = agent.targetLocation
    ? LIBRARY_LOCATIONS.find(l => l.id === agent.targetLocation)
    : null;

  const nearbyAgents = state.agents
    .filter(a => a.id !== agent.id)
    .filter(a => {
      const dist = Math.sqrt((a.x - agent.x) ** 2 + (a.y - agent.y) ** 2);
      return dist < 150;
    })
    .map(a => a.name.split(' ')[0]);

  let context = '';

  if (agent.state === 'reading' && location) {
    context = `Reading at the ${location.name}. The texts here concern ${location.themes.join(', ')}.`;
  } else if (agent.state === 'contemplating') {
    context = `In quiet contemplation at the alcove.`;
  } else if (agent.state === 'walking') {
    const dest = location ? location.name : 'somewhere in the library';
    context = `Walking toward ${dest}.`;
  } else if (agent.state === 'conversing' && agent.conversationPartner) {
    const partner = state.agents.find(a => a.id === agent.conversationPartner);
    context = `In conversation with ${partner?.name || 'another philosopher'}.`;
  } else {
    context = `Standing in the library.`;
  }

  if (nearbyAgents.length > 0 && agent.state !== 'conversing') {
    context += ` ${nearbyAgents.join(' and ')} ${nearbyAgents.length > 1 ? 'are' : 'is'} nearby.`;
  }

  return context;
}

// Get recent memories for context
function getRecentMemories(agent: SimAgent, count: number = 3): string {
  const recent = agent.memoryStream.slice(-count);
  if (recent.length === 0) return '';

  return recent.map(m => `- ${m.content}`).join('\n');
}

// Generate a thought via API
async function generateThought(
  agent: SimAgent,
  state: SimulationState
): Promise<MemoryEntry | null> {
  const context = getAgentContext(agent, state);
  const recentMemories = getRecentMemories(agent);

  try {
    const response = await fetch('/api/thought', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentName: agent.name,
        archetype: agent.archetype,
        coreBeliefs: agent.coreBeliefs,
        activity: agent.activity || agent.state,
        location: context,
        interests: agent.interests,
        recentMemories,
        mode: 'stream', // Continuous stream mode
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      id: generateId(),
      type: agent.state === 'reading' ? 'observation' : 'thought',
      content: data.thought,
      timestamp: Date.now(),
      importance: 5 + Math.floor(Math.random() * 3), // 5-7 base importance
      context,
    };
  } catch (error) {
    console.error('Failed to generate thought:', error);
    return null;
  }
}

// Trim old memories if over limit
function trimMemories(agent: SimAgent): void {
  if (agent.memoryStream.length > MAX_MEMORIES) {
    // Keep more important memories, remove oldest low-importance ones
    agent.memoryStream.sort((a, b) => {
      // Higher importance stays, then newer stays
      if (a.importance !== b.importance) return b.importance - a.importance;
      return b.timestamp - a.timestamp;
    });
    agent.memoryStream = agent.memoryStream.slice(0, MAX_MEMORIES);
    // Re-sort by timestamp for display
    agent.memoryStream.sort((a, b) => a.timestamp - b.timestamp);
  }
}

/**
 * Main thought generation loop - call this periodically
 * Generates thoughts for agents who haven't thought recently
 */
export async function generateAgentThoughts(
  state: SimulationState,
  onUpdate: () => void
): Promise<void> {
  if (state.isPaused) return;

  const now = Date.now();

  // Find agents who need to think (stagger so not all at once)
  for (const agent of state.agents) {
    // Skip if already generating or in conversation (conversation generates its own dialogue)
    if (agent.isGeneratingThought) continue;
    if (agent.state === 'conversing') continue;

    // Check if enough time has passed (with some randomness)
    const interval = THOUGHT_INTERVAL + Math.random() * 4000;
    if (now - agent.lastThoughtTime < interval) continue;

    // Generate thought for this agent
    agent.isGeneratingThought = true;
    agent.lastThoughtTime = now;
    onUpdate();

    // Don't await - let it run in background
    generateThought(agent, state).then(memory => {
      agent.isGeneratingThought = false;
      if (memory) {
        agent.memoryStream.push(memory);
        trimMemories(agent);
      }
      onUpdate();
    });

    // Only start one thought generation per tick to avoid overwhelming API
    break;
  }
}

/**
 * Add a memory entry directly (for dialogue, observations, etc.)
 */
export function addMemory(
  agent: SimAgent,
  type: MemoryEntry['type'],
  content: string,
  importance: number = 5,
  context?: string
): void {
  agent.memoryStream.push({
    id: generateId(),
    type,
    content,
    timestamp: Date.now(),
    importance,
    context,
  });
  trimMemories(agent);
}
