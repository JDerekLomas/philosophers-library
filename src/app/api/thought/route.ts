/**
 * API route for generating agent internal thoughts
 * Used when user clicks on a reading/contemplating agent
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const { agentName, archetype, coreBeliefs, activity, location, interests } = await request.json();

    // Build context based on what the agent is doing
    let activityContext = '';
    if (activity === 'reading' || activity === 'studying') {
      activityContext = `You are currently reading at the ${location}. The books here relate to ${interests.slice(0, 2).join(' and ')}.`;
    } else if (activity === 'contemplating') {
      activityContext = `You are in quiet contemplation, reflecting on the nature of ${interests[0] || 'existence'}.`;
    } else {
      activityContext = `You are taking a moment of rest, your mind wandering to thoughts of ${interests[0] || 'your work'}.`;
    }

    const systemPrompt = `You are ${agentName}, a ${archetype}.

Your core beliefs:
${coreBeliefs.map((b: string) => `- ${b}`).join('\n')}

${activityContext}

Generate a brief internal thought (1-2 sentences) that reflects your philosophical perspective and current activity. Write in first person, as if thinking to yourself. Be authentic to your historical beliefs and writing style.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'What are you thinking about right now?',
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
