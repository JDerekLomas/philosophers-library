/**
 * Philosopher Agent Module
 * Core agent class combining identity, memory, and behavior
 */

import {
  PhilosopherAgent,
  PhilosopherIdentity,
  AgentScratch,
  PhilosophicalArchetype,
  MemoryNode,
} from '../types';
import { MemoryStream, MemoryStreamData } from '../memory';
import { retrieve, retrieveForDialogue } from '../retrieval';
import {
  shouldReflect,
  runReflection,
  resetReflectionCounter,
  updateReflectionCounter,
  reflectOnConversation,
  generatePoignancy,
  generateTriple,
} from '../reflection';

/**
 * Default scratch values for new agents
 */
const DEFAULT_SCRATCH: Omit<AgentScratch, 'currTime'> = {
  position: { x: 0, y: 0 },
  currentActivity: 'contemplating',
  currentLocation: 'library',

  chattingWith: null,
  chattingEndTime: null,
  chat: [],

  // Reflection triggers - from Stanford defaults
  importanceTriggerMax: 150,
  importanceTriggerCurr: 150,
  importanceEleN: 0,

  // Retrieval weights - from Stanford: relevance weighted highest
  recencyW: 1,
  relevanceW: 1,
  importanceW: 1,
  recencyDecay: 0.99,

  currentFocus: null,
  recentInsights: [],
};

/**
 * Character definitions for the philosophers
 */
export const PHILOSOPHER_IDENTITIES: Record<string, PhilosopherIdentity> = {
  drebbel: {
    name: 'Cornelius Drebbel',
    archetype: 'alchemist',
    era: '1572-1633',
    birthYear: 1572,
    deathYear: 1633,
    authorId: 'drebbel', // Maps to sourcelibrary-v2
    keyWorks: ['on-the-fifth-essence'],
    coreBeliefs: [
      'The quinta essentia pervades all matter',
      'Nature can be understood through practical experiment',
      'The philosopher must be both thinker and craftsman',
      'Fire and air are the active principles of transformation',
    ],
    intellectualStyle:
      'Practical and inventive, preferring demonstration to disputation. Speaks from experience rather than authority.',
    knownAssociations: ['Rudolf II', 'James I', 'Constantijn Huygens'],
  },

  ficino: {
    name: 'Marsilio Ficino',
    archetype: 'hermetic_philosopher',
    era: '1433-1499',
    birthYear: 1433,
    deathYear: 1499,
    authorId: 'ficino',
    keyWorks: ['de-mysteriis', 'theologia-platonica'],
    coreBeliefs: [
      'The soul is immortal and can ascend to divine union',
      'Platonic philosophy and Christian theology are harmonious',
      'Love is the cosmic force that binds all things',
      'Ancient wisdom (prisca theologia) flows from Hermes to Plato to Christ',
    ],
    intellectualStyle:
      'Contemplative and syncretic, weaving together Plato, Plotinus, and the Hermetic texts. Seeks harmony between traditions.',
    knownAssociations: ['Cosimo de\' Medici', 'Pico della Mirandola', 'Lorenzo de\' Medici'],
  },

  boehme: {
    name: 'Jacob Böhme',
    archetype: 'mystic',
    era: '1575-1624',
    birthYear: 1575,
    deathYear: 1624,
    authorId: 'boehme',
    keyWorks: ['aurora'],
    coreBeliefs: [
      'God reveals himself through nature as through a mirror',
      'Opposition and strife are necessary for manifestation',
      'The Ungrund (abyss) is the source of all being',
      'Divine wisdom (Sophia) mediates between God and creation',
    ],
    intellectualStyle:
      'Visionary and paradoxical, speaking in dense symbolic language. Draws from direct spiritual experience.',
    knownAssociations: ['Karl von Ender', 'Balthasar Walther'],
  },

  paracelsus: {
    name: 'Paracelsus',
    archetype: 'physician_sage',
    era: '1493-1541',
    birthYear: 1493,
    deathYear: 1541,
    authorId: 'paracelsus',
    keyWorks: ['archidoxis'],
    coreBeliefs: [
      'The physician must learn from nature, not ancient books',
      'Like cures like - the doctrine of signatures',
      'Three principles: salt, sulfur, and mercury',
      'The microcosm (human) reflects the macrocosm (universe)',
    ],
    intellectualStyle:
      'Polemical and iconoclastic, challenging established authorities. Combines empirical observation with theosophical speculation.',
    knownAssociations: ['Oporinus', 'Erasmus', 'Frobenius'],
  },

  maier: {
    name: 'Michael Maier',
    archetype: 'rosicrucian',
    era: '1568-1622',
    birthYear: 1568,
    deathYear: 1622,
    authorId: 'maier',
    keyWorks: ['silentium-post-clamores', 'atalanta-fugiens'],
    coreBeliefs: [
      'Alchemy is both physical and spiritual transformation',
      'Hidden knowledge can be encoded in emblems and music',
      'The Rosicrucian brotherhood represents true philosophy',
      'Egypt is the source of hermetic wisdom',
    ],
    intellectualStyle:
      'Allegorical and artistic, expressing ideas through emblem, myth, and music. Defends the hermetic tradition against critics.',
    knownAssociations: ['Rudolf II', 'Robert Fludd', 'Moritz of Hesse-Kassel'],
  },
};

/**
 * Create a new philosopher agent
 */
export function createPhilosopherAgent(
  id: string,
  identityKey: keyof typeof PHILOSOPHER_IDENTITIES,
  spriteCharacterId: string,
  initialTime: Date = new Date()
): { agent: PhilosopherAgent; memoryStream: MemoryStream } {
  const identity = PHILOSOPHER_IDENTITIES[identityKey];

  const agent: PhilosopherAgent = {
    id,
    identity,
    scratch: {
      ...DEFAULT_SCRATCH,
      currTime: initialTime,
    },
    spriteCharacterId,
    spriteAssets: {
      idle: [],
      walkNorth: [],
      walkSouth: [],
      walkEast: [],
      walkWest: [],
    },
  };

  const memoryStream = new MemoryStream();

  return { agent, memoryStream };
}

/**
 * Load agent from saved data
 */
export function loadPhilosopherAgent(
  agentData: PhilosopherAgent,
  memoryData: MemoryStreamData
): { agent: PhilosopherAgent; memoryStream: MemoryStream } {
  // Restore dates from strings
  const agent: PhilosopherAgent = {
    ...agentData,
    scratch: {
      ...agentData.scratch,
      currTime: new Date(agentData.scratch.currTime),
      chattingEndTime: agentData.scratch.chattingEndTime
        ? new Date(agentData.scratch.chattingEndTime)
        : null,
    },
  };

  const memoryStream = new MemoryStream(memoryData);

  return { agent, memoryStream };
}

/**
 * Agent Controller - manages agent behavior and lifecycle
 */
export class AgentController {
  private agent: PhilosopherAgent;
  private memoryStream: MemoryStream;
  private getEmbedding: (text: string) => Promise<number[]>;
  private llmCall: (prompt: string) => Promise<string>;

  constructor(
    agent: PhilosopherAgent,
    memoryStream: MemoryStream,
    getEmbedding: (text: string) => Promise<number[]>,
    llmCall: (prompt: string) => Promise<string>
  ) {
    this.agent = agent;
    this.memoryStream = memoryStream;
    this.getEmbedding = getEmbedding;
    this.llmCall = llmCall;
  }

  get id(): string {
    return this.agent.id;
  }

  get name(): string {
    return this.agent.identity.name;
  }

  get position(): { x: number; y: number } {
    return this.agent.scratch.position;
  }

  get isInConversation(): boolean {
    return this.agent.scratch.chattingWith !== null;
  }

  /**
   * Add an observation to memory
   */
  async observe(description: string): Promise<MemoryNode> {
    const created = this.agent.scratch.currTime;
    const expiration = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 1 day

    const { subject, predicate, object } = await generateTriple(
      description,
      this.llmCall
    );

    const poignancy = await generatePoignancy(
      this.agent,
      description,
      'event',
      this.llmCall
    );

    const embedding = await this.getEmbedding(description);

    const node = this.memoryStream.addEvent(
      created,
      expiration,
      subject,
      predicate,
      object,
      description,
      new Set([subject, predicate, object]),
      poignancy,
      [description, embedding]
    );

    // Update reflection counter
    updateReflectionCounter(this.agent, poignancy);

    return node;
  }

  /**
   * Add a source citation to memory
   */
  async citeSource(
    sourceId: string,
    passage: string,
    interpretation: string
  ): Promise<MemoryNode> {
    const created = this.agent.scratch.currTime;

    const { subject, predicate, object } = await generateTriple(
      interpretation,
      this.llmCall
    );

    const poignancy = await generatePoignancy(
      this.agent,
      interpretation,
      'thought',
      this.llmCall
    );

    const embedding = await this.getEmbedding(interpretation);

    return this.memoryStream.addSource(
      created,
      sourceId,
      passage,
      subject,
      predicate,
      object,
      interpretation,
      new Set([subject, predicate, object]),
      poignancy,
      [interpretation, embedding]
    );
  }

  /**
   * Retrieve memories relevant to a topic
   */
  async retrieveForTopic(topic: string, maxResults: number = 30) {
    const results = await retrieve(
      this.memoryStream,
      [topic],
      this.getEmbedding,
      {
        recencyWeight: this.agent.scratch.recencyW,
        relevanceWeight: this.agent.scratch.relevanceW,
        importanceWeight: this.agent.scratch.importanceW,
        recencyDecay: this.agent.scratch.recencyDecay,
        maxResults,
      }
    );

    return results.get(topic) || [];
  }

  /**
   * Retrieve memories for a dialogue
   */
  async retrieveForDialogue(topic: string, otherParticipant: string) {
    return retrieveForDialogue(
      this.memoryStream,
      topic,
      otherParticipant,
      this.getEmbedding,
      {
        recencyWeight: this.agent.scratch.recencyW,
        relevanceWeight: this.agent.scratch.relevanceW,
        importanceWeight: this.agent.scratch.importanceW,
        recencyDecay: this.agent.scratch.recencyDecay,
      }
    );
  }

  /**
   * Run reflection if triggered
   */
  async maybeReflect(): Promise<MemoryNode[]> {
    if (!shouldReflect(this.agent)) {
      return [];
    }

    const newThoughts = await runReflection(
      this.agent,
      this.memoryStream,
      this.getEmbedding,
      this.llmCall
    );

    resetReflectionCounter(this.agent);

    // Update recent insights
    this.agent.scratch.recentInsights = newThoughts
      .slice(0, 3)
      .map(n => n.description);

    return newThoughts;
  }

  /**
   * Start a conversation with another agent
   */
  startConversation(otherAgentName: string, endTime: Date): void {
    this.agent.scratch.chattingWith = otherAgentName;
    this.agent.scratch.chattingEndTime = endTime;
    this.agent.scratch.chat = [];
  }

  /**
   * Add an utterance to the current conversation
   */
  addUtterance(speaker: string, utterance: string): void {
    this.agent.scratch.chat.push([speaker, utterance]);
  }

  /**
   * End current conversation and reflect on it
   */
  async endConversation(): Promise<{ planningThought: MemoryNode; memo: MemoryNode } | null> {
    if (!this.agent.scratch.chattingWith) {
      return null;
    }

    const otherParticipant = this.agent.scratch.chattingWith;
    const conversationTurns = this.agent.scratch.chat;

    // Record the conversation as a chat node
    const description = `Conversation with ${otherParticipant} about ${this.agent.scratch.currentFocus || 'philosophical matters'}`;
    const created = this.agent.scratch.currTime;
    const expiration = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const embedding = await this.getEmbedding(description);
    const poignancy = await generatePoignancy(
      this.agent,
      description,
      'chat',
      this.llmCall
    );

    this.memoryStream.addChat(
      created,
      expiration,
      this.agent.identity.name,
      'conversed with',
      otherParticipant,
      description,
      new Set([this.agent.identity.name, otherParticipant]),
      poignancy,
      [description, embedding],
      []
    );

    // Reflect on the conversation
    const reflections = await reflectOnConversation(
      this.agent,
      this.memoryStream,
      conversationTurns,
      otherParticipant,
      this.getEmbedding,
      this.llmCall
    );

    // Clear conversation state
    this.agent.scratch.chattingWith = null;
    this.agent.scratch.chattingEndTime = null;
    this.agent.scratch.chat = [];

    return reflections;
  }

  /**
   * Update agent position
   */
  moveTo(x: number, y: number): void {
    this.agent.scratch.position = { x, y };
  }

  /**
   * Advance simulation time
   */
  tick(newTime: Date): void {
    this.agent.scratch.currTime = newTime;
  }

  /**
   * Get serializable state
   */
  toJSON(): { agent: PhilosopherAgent; memory: MemoryStreamData } {
    return {
      agent: this.agent,
      memory: this.memoryStream.toJSON(),
    };
  }
}

/**
 * Initialize core memories for a philosopher from their known beliefs
 */
export async function initializeCoreMemories(
  controller: AgentController,
  identity: PhilosopherIdentity,
  getEmbedding: (text: string) => Promise<number[]>
): Promise<void> {
  // Add core beliefs as high-importance thoughts
  for (const belief of identity.coreBeliefs) {
    const embedding = await getEmbedding(belief);
    controller['memoryStream'].addThought(
      controller['agent'].scratch.currTime,
      null, // No expiration for core beliefs
      identity.name,
      'believes',
      belief,
      `${identity.name} holds that: ${belief}`,
      new Set([identity.name, 'believes', belief.split(' ')[0]]),
      9, // High importance
      [belief, embedding],
      []
    );
  }
}
