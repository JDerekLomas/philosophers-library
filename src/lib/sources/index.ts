/**
 * Source Library Integration
 * Connects to sourcelibrary-v2 API for grounding philosophical dialogue in actual texts
 *
 * API: https://sourcelibrary.org/api
 * MCP Server: sourcelibrary-v2/mcp-server
 */

import { SourceBook, SourcePassage } from '../types';

/**
 * Configuration for Source Library connection
 */
export interface SourceLibraryConfig {
  baseUrl: string;
}

const DEFAULT_CONFIG: SourceLibraryConfig = {
  baseUrl: process.env.SOURCE_LIBRARY_API || 'https://sourcelibrary.org/api',
};

/**
 * Search result from the API
 */
interface SearchResult {
  id: string;
  type: 'book' | 'page';
  book_id: string;
  title: string;
  display_title?: string;
  author: string;
  language: string;
  published: string;
  page_count?: number;
  translated_count?: number;
  has_doi: boolean;
  doi?: string;
  summary?: string;
  page_number?: number;
  snippet?: string;
  snippet_type?: 'translation' | 'ocr' | 'summary';
}

/**
 * Quote response from the API
 */
interface QuoteResponse {
  quote: {
    translation: string;
    original?: string;
    page: number;
    book_id: string;
    book_title: string;
    display_title?: string;
    author: string;
    published: string;
    language: string;
  };
  citation: {
    inline: string;
    footnote: string;
    bibliography: string;
    bibtex: string;
    chicago: string;
    mla: string;
    url: string;
    short_url: string;
    doi_url?: string;
  };
  context?: {
    previous_page?: string;
    next_page?: string;
  };
}

/**
 * Book details from the API
 */
interface BookResponse {
  id: string;
  title: string;
  display_title?: string;
  author: string;
  language: string;
  published: string;
  pages_count?: number;
  pages_translated?: number;
  doi?: string;
  summary?: string | { data: string };
  categories?: string[];
}

/**
 * Client for interacting with sourcelibrary-v2 API
 */
export class SourceLibraryClient {
  private config: SourceLibraryConfig;

  constructor(config: Partial<SourceLibraryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search the library for books and pages matching a query
   */
  async search(options: {
    query: string;
    language?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    hasDoi?: boolean;
    hasTranslation?: boolean;
    bookId?: string;
    searchContent?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    results: SearchResult[];
    total: number;
    query: string;
  }> {
    const params = new URLSearchParams({ q: options.query });

    if (options.language) params.set('language', options.language);
    if (options.category) params.set('category', options.category);
    if (options.dateFrom) params.set('date_from', options.dateFrom);
    if (options.dateTo) params.set('date_to', options.dateTo);
    if (options.hasDoi) params.set('has_doi', 'true');
    if (options.hasTranslation) params.set('has_translation', 'true');
    if (options.bookId) params.set('book_id', options.bookId);
    if (options.searchContent !== undefined) {
      params.set('search_content', String(options.searchContent));
    }
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const response = await fetch(`${this.config.baseUrl}/search?${params}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a quote from a specific page with formatted citations
   */
  async getQuote(options: {
    bookId: string;
    page: number;
    includeOriginal?: boolean;
    includeContext?: boolean;
  }): Promise<QuoteResponse> {
    const params = new URLSearchParams({ page: String(options.page) });

    if (options.includeOriginal !== undefined) {
      params.set('include_original', String(options.includeOriginal));
    }
    if (options.includeContext) {
      params.set('include_context', 'true');
    }

    const response = await fetch(
      `${this.config.baseUrl}/books/${options.bookId}/quote?${params}`
    );

    if (!response.ok) {
      throw new Error(`Get quote failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed information about a book
   */
  async getBook(bookId: string): Promise<BookResponse> {
    const response = await fetch(`${this.config.baseUrl}/books/${bookId}`);

    if (!response.ok) {
      throw new Error(`Get book failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search and return passages formatted for agent consumption
   */
  async searchPassages(
    query: string,
    options: {
      authorName?: string;
      bookId?: string;
      limit?: number;
    } = {}
  ): Promise<SourcePassage[]> {
    const searchResults = await this.search({
      query,
      bookId: options.bookId,
      hasTranslation: true,
      limit: options.limit || 10,
    });

    const passages: SourcePassage[] = [];

    for (const result of searchResults.results) {
      // Filter by author if specified
      if (options.authorName &&
          !result.author.toLowerCase().includes(options.authorName.toLowerCase())) {
        continue;
      }

      if (result.type === 'page' && result.page_number && result.snippet) {
        // Get full quote with citation
        try {
          const quoteResponse = await this.getQuote({
            bookId: result.book_id,
            page: result.page_number,
            includeOriginal: true,
          });

          passages.push({
            bookId: result.book_id,
            bookTitle: result.display_title || result.title,
            author: result.author,
            pageNumber: result.page_number,
            text: quoteResponse.quote.original || '',
            translatedText: quoteResponse.quote.translation,
            relevanceScore: 1.0, // Will be reranked by embeddings
          });
        } catch {
          // If quote fetch fails, use snippet
          passages.push({
            bookId: result.book_id,
            bookTitle: result.display_title || result.title,
            author: result.author,
            pageNumber: result.page_number,
            text: result.snippet,
            translatedText: result.snippet,
          });
        }
      } else if (result.type === 'book' && result.summary) {
        // Include book summary as a passage
        passages.push({
          bookId: result.book_id,
          bookTitle: result.display_title || result.title,
          author: result.author,
          text: result.summary,
          translatedText: result.summary,
        });
      }
    }

    return passages;
  }

  /**
   * Map search result to SourceBook type
   */
  resultToBook(result: SearchResult): SourceBook {
    return {
      id: result.book_id,
      title: result.title,
      author: result.author,
      authorId: result.author.toLowerCase().split(',')[0].trim().replace(/\s+/g, '-'),
      year: result.published ? parseInt(result.published) : null,
      language: result.language,
      hasOCR: true,
      hasTranslation: (result.translated_count || 0) > 0,
      themes: [],
      keyTerms: [],
    };
  }
}

/**
 * Passage retrieval with semantic search
 * Uses embeddings to rerank keyword search results
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
    authorName?: string;
    bookId?: string;
    topK?: number;
  } = {}
): Promise<SourcePassage[]> {
  const { client, getEmbedding, cosineSimilarity } = config;
  const topK = options.topK || 10;

  // Get candidates from keyword search
  const candidates = await client.searchPassages(query, {
    authorName: options.authorName,
    bookId: options.bookId,
    limit: topK * 3, // Get more for reranking
  });

  if (candidates.length === 0) {
    return [];
  }

  // Get query embedding
  const queryEmbedding = await getEmbedding(query);

  // Score and rerank by embedding similarity
  const scoredPassages = await Promise.all(
    candidates.map(async passage => {
      const textToEmbed = passage.translatedText || passage.text;
      const passageEmbedding = await getEmbedding(textToEmbed.slice(0, 1000));
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
    const pageRef = passage.pageNumber ? `, p. ${passage.pageNumber}` : '';
    const formatted = `[${passage.author}, "${passage.bookTitle}"${pageRef}]\n${text}\n\n`;

    if (currentLength + formatted.length > maxLength) {
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
  return importantTerms.filter(term => lowerText.includes(term));
}

/**
 * Build a reading context for an agent about to engage in dialogue
 * Retrieves relevant passages from the agent's key works
 */
export async function buildReadingContext(
  client: SourceLibraryClient,
  authorName: string,
  topic: string,
  getEmbedding: (text: string) => Promise<number[]>,
  cosineSimilarity: (a: number[], b: number[]) => number,
  maxPassages: number = 5
): Promise<{
  passages: SourcePassage[];
  formattedContext: string;
  keyConcepts: string[];
}> {
  const passages = await findRelevantPassages(topic, {
    client,
    getEmbedding,
    cosineSimilarity,
  }, {
    authorName,
    topK: maxPassages,
  });

  const formattedContext = formatPassagesForContext(passages);

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

/**
 * Get a citable quote from a book page
 * Returns formatted citation in multiple styles
 */
export async function getCitableQuote(
  client: SourceLibraryClient,
  bookId: string,
  pageNumber: number
): Promise<{
  text: string;
  original?: string;
  citation: {
    inline: string;
    footnote: string;
    doiUrl?: string;
  };
  context?: {
    previous?: string;
    next?: string;
  };
}> {
  const response = await client.getQuote({
    bookId,
    page: pageNumber,
    includeOriginal: true,
    includeContext: true,
  });

  return {
    text: response.quote.translation,
    original: response.quote.original,
    citation: {
      inline: response.citation.inline,
      footnote: response.citation.footnote,
      doiUrl: response.citation.doi_url,
    },
    context: response.context ? {
      previous: response.context.previous_page,
      next: response.context.next_page,
    } : undefined,
  };
}
