/**
 * Conversation Management
 * Handles initiating and managing dialogues between agents
 */

import {
  SimAgent,
  SimulationState,
  ActiveConversation,
  ConversationTurn,
  MAX_CONVERSATION_TURNS,
} from './state';

// Generate a unique conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Pick a philosophical topic based on agent beliefs
export function pickTopic(agent1: SimAgent, agent2: SimAgent): string {
  // Find shared themes
  const themes = [
    'the nature of the soul',
    'the transmutation of matter',
    'the relationship between microcosm and macrocosm',
    'the source of divine wisdom',
    'the role of fire in transformation',
    'the hidden properties of nature',
    'the path to illumination',
    'the unity of all things',
  ];

  return themes[Math.floor(Math.random() * themes.length)];
}

// Start a conversation between two agents
export function startConversation(
  state: SimulationState,
  agent1: SimAgent,
  agent2: SimAgent
): ActiveConversation {
  const topic = pickTopic(agent1, agent2);

  const conversation: ActiveConversation = {
    id: generateConversationId(),
    participants: [agent1.id, agent2.id],
    topic,
    turns: [],
    startTime: state.time,
    isGenerating: false,
  };

  // Update agent states
  agent1.state = 'conversing';
  agent1.conversationPartner = agent2.id;
  agent2.state = 'conversing';
  agent2.conversationPartner = agent1.id;

  state.activeConversation = conversation;

  return conversation;
}

// End the current conversation
export function endConversation(state: SimulationState): void {
  if (!state.activeConversation) return;

  const conv = state.activeConversation;

  // Update agent states
  for (const agent of state.agents) {
    if (conv.participants.includes(agent.id)) {
      agent.state = 'idle';
      agent.conversationPartner = null;
      agent.lastConversationTime = state.time;
    }
  }

  // Archive the conversation
  state.conversationHistory.push(conv);
  state.activeConversation = null;
}

// Add a turn to the conversation
export function addTurn(
  conversation: ActiveConversation,
  speakerId: string,
  speakerName: string,
  text: string
): ConversationTurn {
  const turn: ConversationTurn = {
    speakerId,
    speakerName,
    text,
    timestamp: Date.now(),
  };

  conversation.turns.push(turn);
  return turn;
}

// Check if conversation should end
export function shouldEndConversation(conversation: ActiveConversation): boolean {
  return conversation.turns.length >= MAX_CONVERSATION_TURNS;
}

// Get the agent who should speak next
export function getNextSpeaker(
  conversation: ActiveConversation,
  agents: SimAgent[]
): SimAgent | null {
  const lastTurn = conversation.turns[conversation.turns.length - 1];

  // First turn - pick randomly
  if (!lastTurn) {
    const firstSpeakerId = conversation.participants[Math.floor(Math.random() * 2)];
    return agents.find(a => a.id === firstSpeakerId) || null;
  }

  // Alternate speakers
  const nextSpeakerId = conversation.participants.find(id => id !== lastTurn.speakerId);
  return agents.find(a => a.id === nextSpeakerId) || null;
}

// Format conversation for display
export function formatConversation(conversation: ActiveConversation): string {
  return conversation.turns
    .map(turn => `${turn.speakerName}: ${turn.text}`)
    .join('\n\n');
}

// Build context for generating a response
export function buildDialogueContext(
  speaker: SimAgent,
  otherAgent: SimAgent,
  conversation: ActiveConversation
): {
  systemPrompt: string;
  conversationHistory: string;
} {
  const systemPrompt = `You are ${speaker.name}, a ${speaker.archetype} philosopher.

Your core beliefs:
${speaker.coreBeliefs.map(b => `- ${b}`).join('\n')}

You are having a philosophical dialogue with ${otherAgent.name}, a ${otherAgent.archetype}.

The topic of discussion is: ${conversation.topic}

Guidelines:
- Stay in character as ${speaker.name}
- Speak in a manner befitting a Renaissance philosopher
- Reference your core beliefs when relevant
- Engage thoughtfully with what the other philosopher says
- Keep responses to 2-3 sentences
- Be substantive but concise`;

  const conversationHistory = conversation.turns.length > 0
    ? 'The conversation so far:\n' + formatConversation(conversation)
    : 'You are beginning this dialogue. Open with a thought on the topic.';

  return { systemPrompt, conversationHistory };
}
