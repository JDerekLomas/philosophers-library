/**
 * Simulation State Management
 * Manages the real-time state of philosopher agents in the library
 */

import { PHILOSOPHER_IDENTITIES } from '../agents';

// Agent visual state for rendering
export type AgentState = 'wandering' | 'conversing' | 'idle' | 'thinking';

// A simulated philosopher agent
export interface SimAgent {
  id: string;
  name: string;
  shortName: string; // For display (initials or short form)
  color: string;

  // Position and movement
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;

  // State
  state: AgentState;
  conversationPartner: string | null;
  lastConversationTime: number;

  // From identity
  archetype: string;
  coreBeliefs: string[];
}

// A turn in a conversation
export interface ConversationTurn {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

// Active conversation between agents
export interface ActiveConversation {
  id: string;
  participants: [string, string]; // Two agent IDs
  topic: string;
  turns: ConversationTurn[];
  startTime: number;
  isGenerating: boolean;
}

// Full simulation state
export interface SimulationState {
  agents: SimAgent[];
  activeConversation: ActiveConversation | null;
  conversationHistory: ActiveConversation[];
  isPaused: boolean;
  speed: number; // 1 = normal, 2 = fast, 0.5 = slow
  time: number; // Simulation time in ms
}

// Canvas dimensions
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Playable area bounds (leaving room for bookshelves at top)
export const BOUNDS = {
  minX: 50,
  maxX: CANVAS_WIDTH - 50,
  minY: 120,
  maxY: CANVAS_HEIGHT - 50,
};

// Agent colors (distinct, readable)
const AGENT_COLORS: Record<string, string> = {
  drebbel: '#4CAF50',   // Green - alchemist
  ficino: '#9C27B0',    // Purple - hermetic
  boehme: '#2196F3',    // Blue - mystic
  paracelsus: '#FF9800', // Orange - physician
  maier: '#E91E63',     // Pink - rosicrucian
};

// Create initial agents from identities
export function createInitialAgents(): SimAgent[] {
  const agents: SimAgent[] = [];
  const identityKeys = Object.keys(PHILOSOPHER_IDENTITIES);

  identityKeys.forEach((key, index) => {
    const identity = PHILOSOPHER_IDENTITIES[key as keyof typeof PHILOSOPHER_IDENTITIES];

    // Spread agents across the canvas
    const startX = BOUNDS.minX + (index + 1) * ((BOUNDS.maxX - BOUNDS.minX) / (identityKeys.length + 1));
    const startY = BOUNDS.minY + Math.random() * (BOUNDS.maxY - BOUNDS.minY);

    agents.push({
      id: key,
      name: identity.name,
      shortName: identity.name.split(' ')[0].slice(0, 3).toUpperCase(),
      color: AGENT_COLORS[key] || '#888888',
      x: startX,
      y: startY,
      targetX: startX,
      targetY: startY,
      speed: 0.5 + Math.random() * 0.3, // Slightly varied speeds
      state: 'idle',
      conversationPartner: null,
      lastConversationTime: 0,
      archetype: identity.archetype.replace('_', ' '),
      coreBeliefs: identity.coreBeliefs,
    });
  });

  return agents;
}

// Create initial simulation state
export function createInitialState(): SimulationState {
  return {
    agents: createInitialAgents(),
    activeConversation: null,
    conversationHistory: [],
    isPaused: false,
    speed: 1,
    time: 0,
  };
}

// Conversation cooldown (ms) - agents won't talk again for this long
export const CONVERSATION_COOLDOWN = 15000; // 15 seconds

// Proximity threshold for starting conversation
export const CONVERSATION_DISTANCE = 80;

// Maximum turns per conversation
export const MAX_CONVERSATION_TURNS = 6;
