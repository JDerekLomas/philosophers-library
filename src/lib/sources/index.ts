/**
 * Source Library Integration
 * Connects to sourcelibrary-v2 for grounding philosophical dialogue in actual texts
 */

import { SourceBook, SourcePassage } from '../types';

/**
 * Configuration for Source Library connection
 */
export interface SourceLibraryConfig {
  baseUrl: string;
  apiKey?: string;
}

const DEFAULT_CONFIG: SourceLibraryConfig = {
  baseUrl: process.env.SOURCELIBRARY_URL || 'https://sourcelibrary-v2.vercel.app',
};

/**
 * Client for interacting with sourcelibrary-v2
 */
export class SourceLibraryClient {
  private config: SourceLibraryConfig;

  constructor(config: Partial<SourceLibraryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all books by an author
   */
  async getBooksByAuthor(authorId: string): Promise<SourceBook[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/books?author=${encodeURIComponent(authorId)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch books: ${response.statusText}`);
    }

    const data = await response.json();
    return data.books.map(this.mapBook);
  }

  /**
   * Get a specific book by ID
   */
  async getBook(bookId: string): Promise<SourceBook | null> {
    const response = await fetch(
      `${this.config.baseUrl}/api/books/${encodeURIComponent(bookId)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch book: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapBook(data.book);
  }

  /**
   * Search for passages across the library
   */
  async searchPassages(
    query: string,
    options: {
      authorId?: string;
      bookId?: string;
      limit?: number;
    } = {}
  ): Promise<SourcePassage[]> {
    const params = new URLSearchParams({ q: query });
    if (options.authorId) params.append('author', options.authorId);
    if (options.bookId) params.append('book', options.bookId);
    if (options.limit) params.append('limit', options.limit.toString());

    const response = await fetch(
      `${this.config.baseUrl}/api/search?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results.map(this.mapPassage);
  }

  /**
   * Get the full text content of a book
   */
  async getBookContent(bookId: string): Promise<string | null> {
    const response = await fetch(
      `${this.config.baseUrl}/api/books/${encodeURIComponent(bookId)}/content`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }

  /**
   * Get passages from a specific chapter
   */
  async getChapterContent(
    bookId: string,
    chapterTitle: string
  ): Promise<string | null> {
    const response = await fetch(
      `${this.config.baseUrl}/api/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterTitle)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch chapter: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }

  private mapBook(raw: Record<string, unknown>): SourceBook {
    return {
      id: raw._id as string || raw.id as string,
      title: raw.title as string,
      author: raw.author as string,
      authorId: raw.authorId as string || (raw.author as string).toLowerCase().replace(/\s+/g, '-'),
      year: raw.year as number | null,
      language: raw.language as string || 'Latin',
      translatedFrom: raw.originalLanguage as string,
      hasOCR: !!raw.ocrContent || !!raw.hasOCR,
      hasTranslation: !!raw.translatedContent || !!raw.hasTranslation,
      blobUrl: raw.blobUrl as string,
      themes: (raw.themes as string[]) || [],
      keyTerms: (raw.keyTerms as string[]) || [],
    };
  }

  private mapPassage(raw: Record<string, unknown>): SourcePassage {
    return {
      bookId: raw.bookId as string,
      bookTitle: raw.bookTitle as string,
      author: raw.author as string,
      pageNumber: raw.page as number,
      chapterTitle: raw.chapter as string,
      text: raw.text as string,
      translatedText: raw.translatedText as string,
      relevanceScore: raw.score as number,
    };
  }
}

/**
 * Passage retrieval with semantic search
 * Uses embeddings to find relevant passages for a topic
 */
export interface SemanticPassageSearchConfig {
  client: SourceLibraryClient;
  getEmbedding: (text: string) => Promise<number[]>;
  cosineSimilarity: (a: number[], b: number[]) => number;
}

/**
 * Find passages semantically relevant to a query
 * Combines keyword search with embedding-based reranking
 */
export async function findRelevantPassages(
  query: string,
  config: SemanticPassageSearchConfig,
  options: {
    authorId?: string;
    bookId?: string;
    topK?: number;
  } = {}
): Promise<SourcePassage[]> {
  const { client, getEmbedding, cosineSimilarity } = config;
  const topK = options.topK || 10;

  // First, do keyword search to get candidates
  const candidates = await client.searchPassages(query, {
    authorId: options.authorId,
    bookId: options.bookId,
    limit: topK * 3, // Get more candidates for reranking
  });

  if (candidates.length === 0) {
    return [];
  }

  // Get query embedding
  const queryEmbedding = await getEmbedding(query);

  // Get embeddings for candidates and compute similarity
  const scoredPassages = await Promise.all(
    candidates.map(async passage => {
      const textToEmbed = passage.translatedText || passage.text;
      const passageEmbedding = await getEmbedding(textToEmbed.slice(0, 1000)); // Truncate for embedding
      const similarity = cosineSimilarity(queryEmbedding, passageEmbedding);
      return {
        passage: { ...passage, relevanceScore: similarity },
        similarity,
      };
    })
  );

  // Sort by similarity and return top K
  scoredPassages.sort((a, b) => b.similarity - a.similarity);
  return scoredPassages.slice(0, topK).map(sp => sp.passage);
}

/**
 * Format passages for inclusion in agent context
 */
export function formatPassagesForContext(
  passages: SourcePassage[],
  maxLength: number = 2000
): string {
  let result = '';
  let currentLength = 0;

  for (const passage of passages) {
    const text = passage.translatedText || passage.text;
    const formatted = `[${passage.author}, "${passage.bookTitle}"${passage.chapterTitle ? `, ${passage.chapterTitle}` : ''}]\n${text}\n\n`;

    if (currentLength + formatted.length > maxLength) {
      // Add truncated version if there's space
      const remaining = maxLength - currentLength - 50;
      if (remaining > 100) {
        result += `[${passage.author}, "${passage.bookTitle}"]\n${text.slice(0, remaining)}...\n`;
      }
      break;
    }

    result += formatted;
    currentLength += formatted.length;
  }

  return result.trim();
}

/**
 * Extract key concepts from a passage for keyword indexing
 */
export function extractKeyConcepts(text: string): string[] {
  // Common philosophical/alchemical terms to look for
  const importantTerms = [
    // Alchemical
    'quintessence', 'fifth essence', 'quinta essentia', 'philosopher\'s stone',
    'mercury', 'sulphur', 'salt', 'transmutation', 'calcination', 'sublimation',
    'conjunction', 'fermentation', 'distillation', 'coagulation',
    // Hermetic
    'hermes', 'thoth', 'emerald tablet', 'as above', 'macrocosm', 'microcosm',
    'prima materia', 'anima mundi', 'world soul',
    // Mystical
    'divine', 'spirit', 'soul', 'illumination', 'gnosis', 'sophia', 'wisdom',
    'light', 'darkness', 'unity', 'duality', 'trinity',
    // Philosophical
    'nature', 'reason', 'truth', 'knowledge', 'being', 'essence', 'substance',
    'form', 'matter', 'cause', 'principle', 'element',
    // Kabbalistic
    'sephiroth', 'ein sof', 'tree of life', 'emanation',
  ];

  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const term of importantTerms) {
    if (lowerText.includes(term)) {
      found.push(term);
    }
  }

  return found;
}

/**
 * Build a reading context for an agent about to engage in dialogue
 * Retrieves relevant passages from the agent's key works
 */
export async function buildReadingContext(
  client: SourceLibraryClient,
  authorId: string,
  topic: string,
  getEmbedding: (text: string) => Promise<number[]>,
  cosineSimilarity: (a: number[], b: number[]) => number,
  maxPassages: number = 5
): Promise<{
  passages: SourcePassage[];
  formattedContext: string;
  keyConcepts: string[];
}> {
  // Find relevant passages from the author's works
  const passages = await findRelevantPassages(topic, {
    client,
    getEmbedding,
    cosineSimilarity,
  }, {
    authorId,
    topK: maxPassages,
  });

  const formattedContext = formatPassagesForContext(passages);

  // Extract key concepts for memory indexing
  const keyConcepts = new Set<string>();
  for (const passage of passages) {
    const text = passage.translatedText || passage.text;
    for (const concept of extractKeyConcepts(text)) {
      keyConcepts.add(concept);
    }
  }

  return {
    passages,
    formattedContext,
    keyConcepts: Array.from(keyConcepts),
  };
}
