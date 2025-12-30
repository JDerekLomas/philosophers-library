/**
 * Simulation State Management
 * Manages the real-time state of philosopher agents in the library
 */

import { PHILOSOPHER_IDENTITIES } from '../agents';

// Agent visual state for rendering
export type AgentState = 'walking' | 'reading' | 'contemplating' | 'conversing' | 'idle';

// Activity an agent can be doing
export type Activity = 'reading' | 'contemplating' | 'studying' | 'seeking_conversation';

// Locations in the library
export interface LibraryLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'bookshelf' | 'desk' | 'alcove' | 'table';
  themes: string[]; // What topics are here
}

// Library locations
export const LIBRARY_LOCATIONS: LibraryLocation[] = [
  { id: 'alchemy_table', name: 'Alchemy Table', x: 80, y: 200, type: 'table', themes: ['alchemy', 'transmutation', 'elements'] },
  { id: 'hermetic_shelf', name: 'Hermetic Texts', x: 200, y: 140, type: 'bookshelf', themes: ['hermes', 'divine', 'soul'] },
  { id: 'natural_shelf', name: 'Natural Philosophy', x: 400, y: 140, type: 'bookshelf', themes: ['nature', 'elements', 'matter'] },
  { id: 'mystical_shelf', name: 'Mystical Works', x: 600, y: 140, type: 'bookshelf', themes: ['divine', 'illumination', 'wisdom'] },
  { id: 'reading_desk', name: 'Reading Desk', x: 700, y: 220, type: 'desk', themes: [] },
  { id: 'contemplation_alcove', name: 'Quiet Alcove', x: 400, y: 450, type: 'alcove', themes: ['contemplation', 'reflection'] },
  { id: 'writing_desk', name: 'Writing Desk', x: 150, y: 400, type: 'desk', themes: [] },
];

// A single thought/observation in the memory stream
export interface MemoryEntry {
  id: string;
  type: 'observation' | 'thought' | 'reflection' | 'dialogue';
  content: string;
  timestamp: number;
  importance: number; // 1-10 scale
  context?: string; // What triggered this (location, conversation, etc.)
}

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
  activity: Activity | null;
  targetLocation: string | null; // Location ID they're heading to
  activityStartTime: number; // When they started current activity
  activityDuration: number; // How long they'll do it (ms)

  // Conversation
  conversationPartner: string | null;
  lastConversationTime: number;

  // From identity
  archetype: string;
  coreBeliefs: string[];
  interests: string[]; // Topics they're drawn to

  // Memory stream - continuous inner life
  memoryStream: MemoryEntry[];
  lastThoughtTime: number; // When they last generated a thought
  isGeneratingThought: boolean;
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
  selectedAgentId: string | null; // Currently selected agent
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

// Agent colors and interests by archetype
const AGENT_CONFIG: Record<string, { color: string; interests: string[] }> = {
  drebbel: { color: '#4CAF50', interests: ['alchemy', 'transmutation', 'elements', 'nature'] },
  ficino: { color: '#9C27B0', interests: ['hermes', 'divine', 'soul', 'wisdom'] },
  boehme: { color: '#2196F3', interests: ['divine', 'illumination', 'contemplation'] },
  paracelsus: { color: '#FF9800', interests: ['alchemy', 'nature', 'elements', 'matter'] },
  maier: { color: '#E91E63', interests: ['hermes', 'alchemy', 'transmutation', 'wisdom'] },
};

// Create initial agents from identities
export function createInitialAgents(): SimAgent[] {
  const agents: SimAgent[] = [];
  const identityKeys = Object.keys(PHILOSOPHER_IDENTITIES);

  identityKeys.forEach((key, index) => {
    const identity = PHILOSOPHER_IDENTITIES[key as keyof typeof PHILOSOPHER_IDENTITIES];
    const config = AGENT_CONFIG[key] || { color: '#888888', interests: [] };

    // Start agents at different locations
    const startLocations = ['hermetic_shelf', 'natural_shelf', 'mystical_shelf', 'reading_desk', 'alchemy_table'];
    const startLoc = LIBRARY_LOCATIONS.find(l => l.id === startLocations[index % startLocations.length])!;

    agents.push({
      id: key,
      name: identity.name,
      shortName: identity.name.split(' ')[0].slice(0, 3).toUpperCase(),
      color: config.color,
      x: startLoc.x + (Math.random() - 0.5) * 40,
      y: startLoc.y + 30 + Math.random() * 20,
      targetX: startLoc.x,
      targetY: startLoc.y + 30,
      speed: 0.8 + Math.random() * 0.4,
      state: 'idle',
      activity: null,
      targetLocation: null,
      activityStartTime: 0,
      activityDuration: 0,
      conversationPartner: null,
      lastConversationTime: -10000, // Allow immediate first conversation
      archetype: identity.archetype.replace('_', ' '),
      coreBeliefs: identity.coreBeliefs,
      interests: config.interests,
      // Memory stream - starts empty, fills as agent thinks
      memoryStream: [],
      lastThoughtTime: 0,
      isGeneratingThought: false,
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
    selectedAgentId: null,
  };
}

// Conversation cooldown (ms) - agents won't talk again for this long
export const CONVERSATION_COOLDOWN = 15000; // 15 seconds

// Proximity threshold for starting conversation
export const CONVERSATION_DISTANCE = 80;

// Maximum turns per conversation
export const MAX_CONVERSATION_TURNS = 6;
