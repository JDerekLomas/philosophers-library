/**
 * Core types for The Philosopher's Library
 * Based on Stanford Generative Agents architecture, adapted for philosophical dialectic
 */

// ============================================================================
// Memory Types
// ============================================================================

export type MemoryNodeType = 'event' | 'thought' | 'chat' | 'source';

/**
 * A node in the memory stream - can be an observation, thought, conversation, or source citation
 * Adapted from ConceptNode in associative_memory.py
 */
export interface MemoryNode {
  id: string;
  nodeCount: number;
  typeCount: number;
  type: MemoryNodeType;
  depth: number; // 0 for observations, increases for reflections

  created: Date;
  expiration: Date | null;
  lastAccessed: Date;

  // Subject-Predicate-Object triple for semantic structure
  subject: string;
  predicate: string;
  object: string;

  description: string;
  embeddingKey: string;
  embedding?: number[]; // Vector embedding for semantic search

  poignancy: number; // Importance score (1-10)
  keywords: Set<string>;

  // Evidence - node IDs that support this thought
  evidence: string[];

  // For source citations
  sourceId?: string; // Reference to sourcelibrary-v2 book
  sourcePassage?: string; // Quoted text from the source
}

/**
 * Scored memory node for retrieval
 */
export interface ScoredMemoryNode {
  node: MemoryNode;
  recencyScore: number;
  relevanceScore: number;
  importanceScore: number;
  totalScore: number;
}

// ============================================================================
// Agent Types
// ============================================================================

export type PhilosophicalArchetype =
  | 'alchemist'
  | 'hermetic_philosopher'
  | 'mystic'
  | 'physician_sage'
  | 'rosicrucian'
  | 'kabbalist'
  | 'astrologer'
  | 'natural_philosopher';

/**
 * Core identity and traits for a philosopher agent
 */
export interface PhilosopherIdentity {
  name: string;
  archetype: PhilosophicalArchetype;
  era: string; // e.g., "1572-1633"
  birthYear: number;
  deathYear: number;

  // From sourcelibrary-v2
  authorId: string;
  keyWorks: string[]; // Book IDs from source library

  // Personality
  coreBeliefs: string[];
  intellectualStyle: string; // How they argue and reason
  knownAssociations: string[]; // Other philosophers they knew or influenced
}

/**
 * Current state of a philosopher agent (scratch pad)
 */
export interface AgentScratch {
  currTime: Date;

  // Position in the library
  position: { x: number; y: number };
  currentActivity: string;
  currentLocation: string;

  // Conversation state
  chattingWith: string | null;
  chattingEndTime: Date | null;
  chat: Array<[string, string]>; // [speaker, utterance] pairs

  // Reflection triggers
  importanceTriggerMax: number;
  importanceTriggerCurr: number;
  importanceEleN: number;

  // Retrieval weights
  recencyW: number;
  relevanceW: number;
  importanceW: number;
  recencyDecay: number;

  // Current intellectual state
  currentFocus: string | null; // What philosophical question they're pondering
  recentInsights: string[];
}

/**
 * A philosopher agent in the simulation
 */
export interface PhilosopherAgent {
  id: string;
  identity: PhilosopherIdentity;
  scratch: AgentScratch;

  // Sprite assets
  spriteCharacterId: string; // Pixellab character ID
  spriteAssets: {
    idle: string[];
    walkNorth: string[];
    walkSouth: string[];
    walkEast: string[];
    walkWest: string[];
  };
}

// ============================================================================
// Dialogue Types
// ============================================================================

export type DialogueStyle =
  | 'socratic' // Question and answer
  | 'disputatio' // Formal academic debate
  | 'commentary' // Interpreting a shared text
  | 'epistle' // Letter-like exchange
  | 'free'; // Informal conversation

/**
 * A turn in a philosophical dialogue
 */
export interface DialogueTurn {
  id: string;
  speakerId: string;
  speakerName: string;
  timestamp: Date;

  utterance: string;

  // Grounding
  citations: Array<{
    sourceId: string;
    passage: string;
    relevance: string;
  }>;

  // Philosophical structure
  rhetoricMove:
    | 'thesis'
    | 'antithesis'
    | 'synthesis'
    | 'question'
    | 'objection'
    | 'clarification'
    | 'evidence'
    | 'concession';

  // Memory nodes that informed this utterance
  informingMemories: string[];
}

/**
 * A complete dialogue between philosophers
 */
export interface Dialogue {
  id: string;
  participants: string[]; // Agent IDs
  style: DialogueStyle;
  topic: string;
  startTime: Date;
  endTime: Date | null;

  turns: DialogueTurn[];

  // Analysis
  keyInsights: string[];
  unresolvedQuestions: string[];
  sourcesDiscussed: string[];
}

// ============================================================================
// Source Library Integration
// ============================================================================

/**
 * Reference to a book in sourcelibrary-v2
 */
export interface SourceBook {
  id: string;
  title: string;
  author: string;
  authorId: string;
  year: number | null;
  language: string;
  translatedFrom?: string;

  // Content access
  hasOCR: boolean;
  hasTranslation: boolean;
  blobUrl?: string;

  // For retrieval
  themes: string[];
  keyTerms: string[];
}

/**
 * A passage retrieved from a source for grounding
 */
export interface SourcePassage {
  bookId: string;
  bookTitle: string;
  author: string;
  pageNumber?: number;
  chapterTitle?: string;

  text: string;
  translatedText?: string;

  embedding?: number[];
  relevanceScore?: number;
}

// ============================================================================
// Simulation Types
// ============================================================================

export interface SimulationState {
  currentTime: Date;
  agents: Map<string, PhilosopherAgent>;
  activeDialogues: Dialogue[];
  memoryStreams: Map<string, MemoryNode[]>;

  // Library state
  libraryLayout: {
    width: number;
    height: number;
    bookcases: Array<{ x: number; y: number; books: string[] }>;
    readingSpots: Array<{ x: number; y: number; name: string }>;
    conversationSpots: Array<{ x: number; y: number; name: string }>;
  };
}

/**
 * Configuration for running the simulation
 */
export interface SimulationConfig {
  // Time
  timeScale: number; // How fast simulation time passes
  tickIntervalMs: number;

  // Retrieval
  retrievalCount: number; // How many memories to retrieve
  recencyWeight: number;
  relevanceWeight: number;
  importanceWeight: number;

  // Reflection
  reflectionThreshold: number; // Importance sum that triggers reflection
  maxReflectionDepth: number;

  // Dialogue
  maxDialogueLength: number;
  dialogueCooldownMs: number;

  // AI
  llmProvider: 'claude' | 'openai';
  embeddingProvider: 'openai' | 'local';
}
