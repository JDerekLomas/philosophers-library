/**
 * API route for fetching source passages from sourcelibrary-v2
 * Provides grounding for philosopher thoughts and dialogue
 */

import { NextResponse } from 'next/server';

const SOURCE_LIBRARY_API = process.env.SOURCE_LIBRARY_API || 'https://sourcelibrary.org/api';

// Map philosopher IDs to their book IDs in sourcelibrary
const PHILOSOPHER_BOOKS: Record<string, string[]> = {
  drebbel: ['on-the-fifth-essence'],
  ficino: ['de-mysteriis', 'theologia-platonica'],
  boehme: ['aurora'],
  paracelsus: ['archidoxis'],
  maier: ['silentium-post-clamores', 'atalanta-fugiens'],
};

interface SearchResult {
  id: string;
  type: 'book' | 'page';
  book_id: string;
  title: string;
  display_title?: string;
  author: string;
  page_number?: number;
  snippet?: string;
  snippet_type?: string;
}

export async function POST(request: Request) {
  try {
    const { philosopherId, topic, limit = 3 } = await request.json();

    // Get books for this philosopher
    const bookIds = PHILOSOPHER_BOOKS[philosopherId] || [];

    if (bookIds.length === 0) {
      return NextResponse.json({ passages: [] });
    }

    // Search for relevant passages across the philosopher's works
    const passages: Array<{
      text: string;
      bookTitle: string;
      page?: number;
      citation: string;
    }> = [];

    // Try searching with the topic
    for (const bookId of bookIds) {
      try {
        const searchParams = new URLSearchParams({
          q: topic,
          book_id: bookId,
          search_content: 'true',
          has_translation: 'true',
          limit: String(Math.ceil(limit / bookIds.length) + 1),
        });

        const searchResponse = await fetch(
          `${SOURCE_LIBRARY_API}/search?${searchParams}`,
          { next: { revalidate: 3600 } } // Cache for 1 hour
        );

        if (!searchResponse.ok) continue;

        const searchData = await searchResponse.json();

        for (const result of searchData.results as SearchResult[]) {
          if (result.type === 'page' && result.snippet && result.page_number) {
            // Get the full quote with citation
            try {
              const quoteResponse = await fetch(
                `${SOURCE_LIBRARY_API}/books/${result.book_id}/quote?page=${result.page_number}`,
                { next: { revalidate: 3600 } }
              );

              if (quoteResponse.ok) {
                const quoteData = await quoteResponse.json();
                passages.push({
                  text: quoteData.quote.translation,
                  bookTitle: quoteData.quote.display_title || quoteData.quote.book_title,
                  page: result.page_number,
                  citation: quoteData.citation.inline,
                });
              }
            } catch {
              // Fall back to snippet
              passages.push({
                text: result.snippet,
                bookTitle: result.display_title || result.title,
                page: result.page_number,
                citation: `${result.author}, ${result.display_title || result.title}, p. ${result.page_number}`,
              });
            }

            if (passages.length >= limit) break;
          }
        }

        if (passages.length >= limit) break;
      } catch (error) {
        console.error(`Error searching book ${bookId}:`, error);
      }
    }

    // If no topic-specific results, get a random passage from their works
    if (passages.length === 0 && bookIds.length > 0) {
      const randomBookId = bookIds[Math.floor(Math.random() * bookIds.length)];
      try {
        // Get book info to find page count
        const bookResponse = await fetch(
          `${SOURCE_LIBRARY_API}/books/${randomBookId}`,
          { next: { revalidate: 3600 } }
        );

        if (bookResponse.ok) {
          const bookData = await bookResponse.json();
          const pageCount = bookData.pages_translated || bookData.pages_count || 10;
          const randomPage = Math.floor(Math.random() * Math.min(pageCount, 20)) + 1;

          const quoteResponse = await fetch(
            `${SOURCE_LIBRARY_API}/books/${randomBookId}/quote?page=${randomPage}`,
            { next: { revalidate: 3600 } }
          );

          if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json();
            passages.push({
              text: quoteData.quote.translation,
              bookTitle: quoteData.quote.display_title || quoteData.quote.book_title,
              page: randomPage,
              citation: quoteData.citation.inline,
            });
          }
        }
      } catch (error) {
        console.error('Error getting random passage:', error);
      }
    }

    return NextResponse.json({ passages });
  } catch (error) {
    console.error('Error in sources API:', error);
    return NextResponse.json({ passages: [] });
  }
}
