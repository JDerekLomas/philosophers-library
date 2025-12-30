/**
 * Simulation Loop
 * Separated into sync movement (60fps) and async conversations
 */

import { SimulationState, SimAgent } from './state';
import { updateAgentMovement, findConversationCandidates, startWandering } from './movement';
import {
  startConversation,
  endConversation,
  shouldEndConversation,
  getNextSpeaker,
  addTurn,
  buildDialogueContext,
} from './conversation';

// Track if we're currently generating dialogue
let isGeneratingDialogue = false;
let lastConversationCheck = 0;

// Source passage type
interface SourcePassage {
  text: string;
  bookTitle: string;
  page?: number;
  citation: string;
}

// Fetch relevant source passages for dialogue
async function fetchDialogueSources(
  speaker: SimAgent,
  topic: string
): Promise<SourcePassage[]> {
  try {
    const response = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        philosopherId: speaker.id,
        topic,
        limit: 2,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.passages || [];
  } catch {
    return [];
  }
}

// Generate dialogue turn via API - grounded in source texts
async function generateDialogueTurn(
  state: SimulationState
): Promise<string | null> {
  const conv = state.activeConversation;
  if (!conv || conv.isGenerating) return null;

  const speaker = getNextSpeaker(conv, state.agents);
  if (!speaker) return null;

  const otherAgentId = conv.participants.find(id => id !== speaker.id);
  const otherAgent = state.agents.find(a => a.id === otherAgentId);
  if (!otherAgent) return null;

  conv.isGenerating = true;

  try {
    // Fetch relevant source passages for this speaker and topic
    const sourcePassages = await fetchDialogueSources(speaker, conv.topic);

    const { systemPrompt, conversationHistory } = buildDialogueContext(
      speaker,
      otherAgent,
      conv,
      sourcePassages
    );

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        conversationHistory,
        speakerName: speaker.name,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate dialogue');
    }

    const data = await response.json();
    addTurn(conv, speaker.id, speaker.name, data.text);

    return data.text;
  } catch (error) {
    console.error('Error generating dialogue:', error);
    return null;
  } finally {
    conv.isGenerating = false;
  }
}

/**
 * Update movement only - called every frame (sync)
 */
export function updateMovement(
  state: SimulationState,
  deltaTime: number
): void {
  if (state.isPaused) return;

  // Update time
  state.time += deltaTime * state.speed;

  // Update agent positions
  updateAgentMovement(state, deltaTime);
}

/**
 * Handle conversations - called periodically (async)
 */
export async function handleConversations(
  state: SimulationState,
  onStateChange: () => void
): Promise<void> {
  if (state.isPaused || isGeneratingDialogue) return;

  const now = Date.now();

  // Check for new conversations (throttled)
  if (!state.activeConversation && now - lastConversationCheck > 1000) {
    lastConversationCheck = now;

    const candidates = findConversationCandidates(state);
    if (candidates) {
      const [agent1, agent2] = candidates;
      startConversation(state, agent1, agent2);
      onStateChange();

      // Generate first turn
      isGeneratingDialogue = true;
      await generateDialogueTurn(state);
      isGeneratingDialogue = false;
      onStateChange();
    }
  }

  // Continue active conversation
  if (state.activeConversation) {
    const conv = state.activeConversation;

    if (shouldEndConversation(conv)) {
      endConversation(state);
      onStateChange();
    } else if (!conv.isGenerating && !isGeneratingDialogue) {
      // Generate next turn
      isGeneratingDialogue = true;
      await generateDialogueTurn(state);
      isGeneratingDialogue = false;
      onStateChange();
    }
  }
}

// Initialize simulation
export function initializeSimulation(state: SimulationState): void {
  startWandering(state);
}
