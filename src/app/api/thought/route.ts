/**
 * API route for generating agent internal thoughts
 * Continuous stream of consciousness - agents are always thinking
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const {
      agentName,
      archetype,
      coreBeliefs,
      activity,
      location,
      interests,
      recentMemories,
      mode = 'single'
    } = await request.json();

    // Build the situational context
    const situationContext = location || `in the library, thinking about ${interests[0] || 'philosophical matters'}`;

    // Include recent memories if available
    const memoryContext = recentMemories
      ? `\nYour recent thoughts:\n${recentMemories}\n`
      : '';

    const systemPrompt = `You are ${agentName}, a ${archetype}.

Your core beliefs:
${coreBeliefs.map((b: string) => `- ${b}`).join('\n')}

Current situation: ${situationContext}
${memoryContext}
You are a historical philosopher in a mystical library. Generate a single brief thought (1-2 sentences) that reflects your philosophical perspective. This should feel like an authentic moment in your stream of consciousness.

${mode === 'stream' ? 'This is part of your continuous inner monologue. Let your thoughts flow naturally from what you observe or from your recent reflections.' : ''}

Write in first person. Be authentic to your historical beliefs and writing style. Keep it concise but meaningful.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 120,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'What crosses your mind right now?',
        },
      ],
    });

    const textContent = message.content.find(block => block.type === 'text');
    const thought = textContent ? textContent.text : '';

    return NextResponse.json({ thought });
  } catch (error) {
    console.error('Error generating thought:', error);
    return NextResponse.json(
      { error: 'Failed to generate thought' },
      { status: 500 }
    );
  }
}
