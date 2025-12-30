/**
 * Memory Stream Implementation
 * Based on AssociativeMemory from Stanford Generative Agents
 * Adapted for philosophical dialectic with source grounding
 */

import {
  MemoryNode,
  MemoryNodeType,
  ScoredMemoryNode,
} from '../types';

/**
 * Generate a unique node ID
 */
function generateNodeId(count: number): string {
  return `node_${count}`;
}

/**
 * The Memory Stream - core long-term memory for philosopher agents
 *
 * Key adaptations from Stanford implementation:
 * - Added 'source' node type for text citations
 * - Enhanced evidence tracking for philosophical arguments
 * - Keyword indexing by philosophical concepts
 */
export class MemoryStream {
  private idToNode: Map<string, MemoryNode> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  // Sequential access by type
  private seqEvent: MemoryNode[] = [];
  private seqThought: MemoryNode[] = [];
  private seqChat: MemoryNode[] = [];
  private seqSource: MemoryNode[] = [];

  // Keyword indices for fast lookup
  private kwToEvent: Map<string, MemoryNode[]> = new Map();
  private kwToThought: Map<string, MemoryNode[]> = new Map();
  private kwToChat: Map<string, MemoryNode[]> = new Map();
  private kwToSource: Map<string, MemoryNode[]> = new Map();

  // Keyword strength tracking
  private kwStrengthEvent: Map<string, number> = new Map();
  private kwStrengthThought: Map<string, number> = new Map();

  constructor(savedData?: MemoryStreamData) {
    if (savedData) {
      this.loadFromData(savedData);
    }
  }

  /**
   * Add an event (observation) to memory
   */
  addEvent(
    created: Date,
    expiration: Date | null,
    subject: string,
    predicate: string,
    object: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embeddingPair: [string, number[]],
    evidence: string[] = []
  ): MemoryNode {
    const nodeCount = this.idToNode.size + 1;
    const typeCount = this.seqEvent.length + 1;
    const nodeId = generateNodeId(nodeCount);

    const node: MemoryNode = {
      id: nodeId,
      nodeCount,
      typeCount,
      type: 'event',
      depth: 0,
      created,
      expiration,
      lastAccessed: created,
      subject,
      predicate,
      object,
      description,
      embeddingKey: embeddingPair[0],
      poignancy,
      keywords,
      evidence,
    };

    // Add to indices
    this.seqEvent.unshift(node);
    this.addToKeywordIndex(node, keywords, this.kwToEvent);
    this.idToNode.set(nodeId, node);

    // Update keyword strength
    if (`${predicate} ${object}` !== 'is idle') {
      for (const kw of keywords) {
        const current = this.kwStrengthEvent.get(kw) || 0;
        this.kwStrengthEvent.set(kw, current + 1);
      }
    }

    this.embeddings.set(embeddingPair[0], embeddingPair[1]);
    return node;
  }

  /**
   * Add a thought (reflection) to memory
   */
  addThought(
    created: Date,
    expiration: Date | null,
    subject: string,
    predicate: string,
    object: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embeddingPair: [string, number[]],
    evidence: string[] = []
  ): MemoryNode {
    const nodeCount = this.idToNode.size + 1;
    const typeCount = this.seqThought.length + 1;
    const nodeId = generateNodeId(nodeCount);

    // Calculate depth based on evidence
    let depth = 1;
    if (evidence.length > 0) {
      const evidenceDepths = evidence
        .map(id => this.idToNode.get(id)?.depth || 0);
      depth = Math.max(...evidenceDepths) + 1;
    }

    const node: MemoryNode = {
      id: nodeId,
      nodeCount,
      typeCount,
      type: 'thought',
      depth,
      created,
      expiration,
      lastAccessed: created,
      subject,
      predicate,
      object,
      description,
      embeddingKey: embeddingPair[0],
      poignancy,
      keywords,
      evidence,
    };

    this.seqThought.unshift(node);
    this.addToKeywordIndex(node, keywords, this.kwToThought);
    this.idToNode.set(nodeId, node);

    // Update keyword strength
    if (`${predicate} ${object}` !== 'is idle') {
      for (const kw of keywords) {
        const current = this.kwStrengthThought.get(kw) || 0;
        this.kwStrengthThought.set(kw, current + 1);
      }
    }

    this.embeddings.set(embeddingPair[0], embeddingPair[1]);
    return node;
  }

  /**
   * Add a chat (conversation) to memory
   */
  addChat(
    created: Date,
    expiration: Date | null,
    subject: string,
    predicate: string,
    object: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embeddingPair: [string, number[]],
    evidence: string[] = []
  ): MemoryNode {
    const nodeCount = this.idToNode.size + 1;
    const typeCount = this.seqChat.length + 1;
    const nodeId = generateNodeId(nodeCount);

    const node: MemoryNode = {
      id: nodeId,
      nodeCount,
      typeCount,
      type: 'chat',
      depth: 0,
      created,
      expiration,
      lastAccessed: created,
      subject,
      predicate,
      object,
      description,
      embeddingKey: embeddingPair[0],
      poignancy,
      keywords,
      evidence,
    };

    this.seqChat.unshift(node);
    this.addToKeywordIndex(node, keywords, this.kwToChat);
    this.idToNode.set(nodeId, node);
    this.embeddings.set(embeddingPair[0], embeddingPair[1]);

    return node;
  }

  /**
   * Add a source citation to memory
   * This is new for philosophical dialectic - tracks textual evidence
   */
  addSource(
    created: Date,
    sourceId: string,
    sourcePassage: string,
    subject: string,
    predicate: string,
    object: string,
    description: string,
    keywords: Set<string>,
    poignancy: number,
    embeddingPair: [string, number[]]
  ): MemoryNode {
    const nodeCount = this.idToNode.size + 1;
    const typeCount = this.seqSource.length + 1;
    const nodeId = generateNodeId(nodeCount);

    const node: MemoryNode = {
      id: nodeId,
      nodeCount,
      typeCount,
      type: 'source',
      depth: 0,
      created,
      expiration: null,
      lastAccessed: created,
      subject,
      predicate,
      object,
      description,
      embeddingKey: embeddingPair[0],
      poignancy,
      keywords,
      evidence: [],
      sourceId,
      sourcePassage,
    };

    this.seqSource.unshift(node);
    this.addToKeywordIndex(node, keywords, this.kwToSource);
    this.idToNode.set(nodeId, node);
    this.embeddings.set(embeddingPair[0], embeddingPair[1]);

    return node;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): MemoryNode | undefined {
    return this.idToNode.get(nodeId);
  }

  /**
   * Get embedding for a node
   */
  getEmbedding(embeddingKey: string): number[] | undefined {
    return this.embeddings.get(embeddingKey);
  }

  /**
   * Get all events and thoughts (for retrieval)
   */
  getAllMemories(): MemoryNode[] {
    return [...this.seqEvent, ...this.seqThought];
  }

  /**
   * Get all memories including sources
   */
  getAllMemoriesWithSources(): MemoryNode[] {
    return [...this.seqEvent, ...this.seqThought, ...this.seqSource];
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number): MemoryNode[] {
    return this.seqEvent.slice(0, count);
  }

  /**
   * Get recent thoughts
   */
  getRecentThoughts(count: number): MemoryNode[] {
    return this.seqThought.slice(0, count);
  }

  /**
   * Get memories by keyword
   */
  getByKeyword(keyword: string, type?: MemoryNodeType): MemoryNode[] {
    const kw = keyword.toLowerCase();
    const results: MemoryNode[] = [];

    if (!type || type === 'event') {
      results.push(...(this.kwToEvent.get(kw) || []));
    }
    if (!type || type === 'thought') {
      results.push(...(this.kwToThought.get(kw) || []));
    }
    if (!type || type === 'chat') {
      results.push(...(this.kwToChat.get(kw) || []));
    }
    if (!type || type === 'source') {
      results.push(...(this.kwToSource.get(kw) || []));
    }

    return results;
  }

  /**
   * Get last chat with a specific person
   */
  getLastChat(personName: string): MemoryNode | null {
    const chats = this.kwToChat.get(personName.toLowerCase());
    return chats?.[0] || null;
  }

  /**
   * Update last accessed time for a node
   */
  touchNode(nodeId: string, time: Date): void {
    const node = this.idToNode.get(nodeId);
    if (node) {
      node.lastAccessed = time;
    }
  }

  /**
   * Get summarized recent events as SPO triples
   */
  getSummarizedLatestEvents(count: number): Set<[string, string, string]> {
    const result = new Set<[string, string, string]>();
    for (const node of this.seqEvent.slice(0, count)) {
      result.add([node.subject, node.predicate, node.object]);
    }
    return result;
  }

  /**
   * Get source citations relevant to a topic
   */
  getSourcesForTopic(keywords: string[]): MemoryNode[] {
    const sources = new Set<MemoryNode>();
    for (const kw of keywords) {
      const matches = this.kwToSource.get(kw.toLowerCase()) || [];
      for (const node of matches) {
        sources.add(node);
      }
    }
    return Array.from(sources);
  }

  /**
   * Serialize for saving
   */
  toJSON(): MemoryStreamData {
    const nodes: Record<string, SerializedNode> = {};

    for (const [id, node] of this.idToNode) {
      nodes[id] = {
        nodeCount: node.nodeCount,
        typeCount: node.typeCount,
        type: node.type,
        depth: node.depth,
        created: node.created.toISOString(),
        expiration: node.expiration?.toISOString() || null,
        lastAccessed: node.lastAccessed.toISOString(),
        subject: node.subject,
        predicate: node.predicate,
        object: node.object,
        description: node.description,
        embeddingKey: node.embeddingKey,
        poignancy: node.poignancy,
        keywords: Array.from(node.keywords),
        evidence: node.evidence,
        sourceId: node.sourceId,
        sourcePassage: node.sourcePassage,
      };
    }

    return {
      nodes,
      embeddings: Object.fromEntries(this.embeddings),
      kwStrengthEvent: Object.fromEntries(this.kwStrengthEvent),
      kwStrengthThought: Object.fromEntries(this.kwStrengthThought),
    };
  }

  /**
   * Load from serialized data
   */
  private loadFromData(data: MemoryStreamData): void {
    // Load embeddings first
    for (const [key, embedding] of Object.entries(data.embeddings)) {
      this.embeddings.set(key, embedding);
    }

    // Load nodes in order
    const nodeIds = Object.keys(data.nodes).sort((a, b) => {
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    });

    for (const nodeId of nodeIds) {
      const serialized = data.nodes[nodeId];
      const embeddingPair: [string, number[]] = [
        serialized.embeddingKey,
        this.embeddings.get(serialized.embeddingKey) || [],
      ];

      const created = new Date(serialized.created);
      const expiration = serialized.expiration
        ? new Date(serialized.expiration)
        : null;
      const keywords = new Set(serialized.keywords);

      switch (serialized.type) {
        case 'event':
          this.addEvent(
            created,
            expiration,
            serialized.subject,
            serialized.predicate,
            serialized.object,
            serialized.description,
            keywords,
            serialized.poignancy,
            embeddingPair,
            serialized.evidence
          );
          break;
        case 'thought':
          this.addThought(
            created,
            expiration,
            serialized.subject,
            serialized.predicate,
            serialized.object,
            serialized.description,
            keywords,
            serialized.poignancy,
            embeddingPair,
            serialized.evidence
          );
          break;
        case 'chat':
          this.addChat(
            created,
            expiration,
            serialized.subject,
            serialized.predicate,
            serialized.object,
            serialized.description,
            keywords,
            serialized.poignancy,
            embeddingPair,
            serialized.evidence
          );
          break;
        case 'source':
          this.addSource(
            created,
            serialized.sourceId || '',
            serialized.sourcePassage || '',
            serialized.subject,
            serialized.predicate,
            serialized.object,
            serialized.description,
            keywords,
            serialized.poignancy,
            embeddingPair
          );
          break;
      }
    }

    // Load keyword strengths
    for (const [kw, strength] of Object.entries(data.kwStrengthEvent)) {
      this.kwStrengthEvent.set(kw, strength);
    }
    for (const [kw, strength] of Object.entries(data.kwStrengthThought)) {
      this.kwStrengthThought.set(kw, strength);
    }
  }

  /**
   * Add node to keyword index
   */
  private addToKeywordIndex(
    node: MemoryNode,
    keywords: Set<string>,
    index: Map<string, MemoryNode[]>
  ): void {
    for (const kw of keywords) {
      const key = kw.toLowerCase();
      const existing = index.get(key) || [];
      existing.unshift(node);
      index.set(key, existing);
    }
  }
}

// ============================================================================
// Serialization Types
// ============================================================================

interface SerializedNode {
  nodeCount: number;
  typeCount: number;
  type: MemoryNodeType;
  depth: number;
  created: string;
  expiration: string | null;
  lastAccessed: string;
  subject: string;
  predicate: string;
  object: string;
  description: string;
  embeddingKey: string;
  poignancy: number;
  keywords: string[];
  evidence: string[];
  sourceId?: string;
  sourcePassage?: string;
}

export interface MemoryStreamData {
  nodes: Record<string, SerializedNode>;
  embeddings: Record<string, number[]>;
  kwStrengthEvent: Record<string, number>;
  kwStrengthThought: Record<string, number>;
}
