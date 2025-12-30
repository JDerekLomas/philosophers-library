/**
 * Simulation Loop
 * Main game loop that updates agent positions and triggers conversations
 */

import { SimulationState } from './state';
import { updateAgentMovement, findConversationCandidates, startWandering } from './movement';
import {
  startConversation,
  endConversation,
  shouldEndConversation,
  getNextSpeaker,
  addTurn,
  buildDialogueContext,
} from './conversation';

// Generate dialogue turn via API
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
    const { systemPrompt, conversationHistory } = buildDialogueContext(
      speaker,
      otherAgent,
      conv
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

// Single simulation step
export async function simulationStep(
  state: SimulationState,
  deltaTime: number,
  onStateChange: () => void
): Promise<void> {
  if (state.isPaused) return;

  // Update time
  state.time += deltaTime * state.speed;

  // Update agent movement
  updateAgentMovement(state, deltaTime);

  // Check for conversation triggers
  if (!state.activeConversation) {
    const candidates = findConversationCandidates(state);
    if (candidates) {
      const [agent1, agent2] = candidates;
      startConversation(state, agent1, agent2);
      onStateChange();

      // Generate first turn
      await generateDialogueTurn(state);
      onStateChange();
    }
  } else {
    // Continue active conversation
    const conv = state.activeConversation;

    if (shouldEndConversation(conv)) {
      endConversation(state);
      onStateChange();
    } else if (!conv.isGenerating) {
      // Generate next turn after a short delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (state.activeConversation === conv) {
        await generateDialogueTurn(state);
        onStateChange();
      }
    }
  }
}

// Initialize simulation
export function initializeSimulation(state: SimulationState): void {
  startWandering(state);
}
