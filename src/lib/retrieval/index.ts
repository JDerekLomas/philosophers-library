/**
 * Retrieval Module
 * Based on retrieve.py from Stanford Generative Agents
 * Implements recency, relevance, and importance scoring
 */

import { MemoryNode, ScoredMemoryNode } from '../types';
import { MemoryStream } from '../memory';

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Normalize dictionary values to a target range
 */
export function normalizeScores(
  scores: Map<string, number>,
  targetMin: number,
  targetMax: number
): Map<string, number> {
  const values = Array.from(scores.values());
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  const normalized = new Map<string, number>();

  if (range === 0) {
    const midpoint = (targetMax - targetMin) / 2;
    for (const key of scores.keys()) {
      normalized.set(key, midpoint);
    }
  } else {
    for (const [key, val] of scores) {
      const normalizedVal =
        ((val - minVal) * (targetMax - targetMin)) / range + targetMin;
      normalized.set(key, normalizedVal);
    }
  }

  return normalized;
}

/**
 * Get top N entries by value
 */
export function topN<T>(
  items: Map<string, T>,
  n: number,
  getValue: (item: T) => number
): Map<string, T> {
  const sorted = Array.from(items.entries()).sort(
    (a, b) => getValue(b[1]) - getValue(a[1])
  );
  return new Map(sorted.slice(0, n));
}

/**
 * Extract recency scores for nodes
 * More recently accessed = higher score
 */
export function extractRecency(
  nodes: MemoryNode[],
  recencyDecay: number
): Map<string, number> {
  // Sort by last accessed time (most recent first)
  const sorted = [...nodes].sort(
    (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
  );

  const scores = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    // Exponential decay: most recent = highest score
    scores.set(sorted[i].id, Math.pow(recencyDecay, i));
  }

  return scores;
}

/**
 * Extract importance scores from node poignancy
 */
export function extractImportance(nodes: MemoryNode[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const node of nodes) {
    scores.set(node.id, node.poignancy);
  }
  return scores;
}

/**
 * Extract relevance scores based on embedding similarity
 */
export function extractRelevance(
  nodes: MemoryNode[],
  focalPointEmbedding: number[],
  memoryStream: MemoryStream
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const node of nodes) {
    const nodeEmbedding = memoryStream.getEmbedding(node.embeddingKey);
    if (nodeEmbedding) {
      const similarity = cosineSimilarity(nodeEmbedding, focalPointEmbedding);
      scores.set(node.id, similarity);
    } else {
      scores.set(node.id, 0);
    }
  }

  return scores;
}

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  recencyWeight: number;
  relevanceWeight: number;
  importanceWeight: number;
  recencyDecay: number;
  maxResults: number;
}

const DEFAULT_CONFIG: RetrievalConfig = {
  // From Stanford: gw = [0.5, 3, 2] - relevance weighted highest
  recencyWeight: 0.5,
  relevanceWeight: 3,
  importanceWeight: 2,
  recencyDecay: 0.99,
  maxResults: 30,
};

/**
 * Main retrieval function
 * Given focal points, retrieve relevant memories weighted by recency, relevance, and importance
 */
export async function retrieve(
  memoryStream: MemoryStream,
  focalPoints: string[],
  getEmbedding: (text: string) => Promise<number[]>,
  config: Partial<RetrievalConfig> = {}
): Promise<Map<string, ScoredMemoryNode[]>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const results = new Map<string, ScoredMemoryNode[]>();

  for (const focalPoint of focalPoints) {
    // Get all memories (excluding idle observations)
    const allNodes = memoryStream
      .getAllMemoriesWithSources()
      .filter(node => !node.embeddingKey.includes('idle'));

    if (allNodes.length === 0) {
      results.set(focalPoint, []);
      continue;
    }

    // Sort by last accessed time
    const sortedNodes = [...allNodes].sort(
      (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
    );

    // Calculate component scores
    let recencyScores = extractRecency(sortedNodes, cfg.recencyDecay);
    recencyScores = normalizeScores(recencyScores, 0, 1);

    let importanceScores = extractImportance(sortedNodes);
    importanceScores = normalizeScores(importanceScores, 0, 1);

    // Get embedding for focal point
    const focalEmbedding = await getEmbedding(focalPoint);
    let relevanceScores = extractRelevance(
      sortedNodes,
      focalEmbedding,
      memoryStream
    );
    relevanceScores = normalizeScores(relevanceScores, 0, 1);

    // Combine scores
    const scoredNodes: ScoredMemoryNode[] = sortedNodes.map(node => {
      const recency = recencyScores.get(node.id) || 0;
      const relevance = relevanceScores.get(node.id) || 0;
      const importance = importanceScores.get(node.id) || 0;

      return {
        node,
        recencyScore: recency,
        relevanceScore: relevance,
        importanceScore: importance,
        totalScore:
          cfg.recencyWeight * recency +
          cfg.relevanceWeight * relevance +
          cfg.importanceWeight * importance,
      };
    });

    // Sort by total score and take top N
    scoredNodes.sort((a, b) => b.totalScore - a.totalScore);
    const topNodes = scoredNodes.slice(0, cfg.maxResults);

    // Update last accessed time
    const now = new Date();
    for (const scored of topNodes) {
      memoryStream.touchNode(scored.node.id, now);
    }

    results.set(focalPoint, topNodes);
  }

  return results;
}

/**
 * Retrieve memories relevant to a conversation topic
 * Includes source citations for grounding
 */
export async function retrieveForDialogue(
  memoryStream: MemoryStream,
  topic: string,
  otherParticipant: string,
  getEmbedding: (text: string) => Promise<number[]>,
  config: Partial<RetrievalConfig> = {}
): Promise<{
  topicalMemories: ScoredMemoryNode[];
  relationshipMemories: ScoredMemoryNode[];
  sourceMemories: ScoredMemoryNode[];
}> {
  // Retrieve memories about the topic
  const topicalResults = await retrieve(
    memoryStream,
    [topic],
    getEmbedding,
    config
  );
  const topicalMemories = topicalResults.get(topic) || [];

  // Retrieve memories about the other participant
  const relationshipResults = await retrieve(
    memoryStream,
    [otherParticipant],
    getEmbedding,
    { ...config, maxResults: 10 }
  );
  const relationshipMemories = relationshipResults.get(otherParticipant) || [];

  // Filter for source citations specifically
  const sourceMemories = topicalMemories.filter(
    scored => scored.node.type === 'source'
  );

  return {
    topicalMemories: topicalMemories.filter(s => s.node.type !== 'source'),
    relationshipMemories,
    sourceMemories,
  };
}

/**
 * Simple keyword-based retrieval (no embedding needed)
 * Useful for quick lookups
 */
export function retrieveByKeywords(
  memoryStream: MemoryStream,
  subject: string,
  predicate: string,
  object: string
): {
  events: MemoryNode[];
  thoughts: MemoryNode[];
} {
  const keywords = [subject, predicate, object].filter(k => k.length > 0);

  const events = new Set<MemoryNode>();
  const thoughts = new Set<MemoryNode>();

  for (const kw of keywords) {
    for (const node of memoryStream.getByKeyword(kw, 'event')) {
      events.add(node);
    }
    for (const node of memoryStream.getByKeyword(kw, 'thought')) {
      thoughts.add(node);
    }
  }

  return {
    events: Array.from(events),
    thoughts: Array.from(thoughts),
  };
}
