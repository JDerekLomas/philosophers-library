/**
 * Dialogue Module
 * Manages philosophical conversations between agents
 * Based on converse.py from Stanford Generative Agents, adapted for dialectic
 */

import {
  Dialogue,
  DialogueTurn,
  DialogueStyle,
  PhilosopherAgent,
  ScoredMemoryNode,
  SourcePassage,
} from '../types';
import { AgentController } from '../agents';
import { formatPassagesForContext } from '../sources';

/**
 * Generate unique dialogue ID
 */
function generateDialogueId(): string {
  return `dialogue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate unique turn ID
 */
function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Dialogue prompt templates
 */
export const DIALOGUE_PROMPTS = {
  /**
   * Generate a relationship summary between two philosophers
   */
  relationshipSummary: (
    name1: string,
    name2: string,
    sharedMemories: string[]
  ) => `
Based on the following memories, summarize the intellectual relationship between ${name1} and ${name2}:

${sharedMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Summarize in 2-3 sentences focusing on their philosophical agreements, disagreements, and shared interests.`,

  /**
   * Determine if agents should converse
   */
  shouldConverse: (
    name: string,
    otherName: string,
    context: string,
    currentActivity: string
  ) => `
${name} is currently ${currentActivity} when they encounter ${otherName} in the library.

Context about their relationship:
${context}

Should ${name} initiate a philosophical conversation with ${otherName}? Consider:
- Their intellectual interests and how they might intersect
- Their historical relationship (if any)
- The appropriateness of the moment

Respond with either:
YES: [brief reason for initiating conversation]
NO: [brief reason for not conversing]`,

  /**
   * Generate initial topic for conversation
   */
  generateTopic: (
    name: string,
    otherName: string,
    recentThoughts: string[],
    sharedInterests: string[]
  ) => `
${name} is about to begin a philosophical dialogue with ${otherName}.

${name}'s recent contemplations:
${recentThoughts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Areas of shared intellectual interest:
${sharedInterests.join(', ')}

What philosophical question or topic should ${name} raise to begin the dialogue? The topic should:
- Connect to ${name}'s recent thinking
- Be potentially engaging for ${otherName}
- Be substantive enough for genuine dialectic

Propose a single topic or question in one sentence.`,

  /**
   * Generate an utterance in the dialogue
   */
  generateUtterance: (
    speaker: PhilosopherAgent,
    topic: string,
    conversationSoFar: string,
    relevantMemories: string,
    sourceContext: string,
    style: DialogueStyle
  ) => `
You are ${speaker.identity.name}, a ${speaker.identity.archetype.replace('_', ' ')} (${speaker.identity.era}).

Your core beliefs:
${speaker.identity.coreBeliefs.map(b => `- ${b}`).join('\n')}

Your intellectual style: ${speaker.identity.intellectualStyle}

The current dialogue with another philosopher concerns: ${topic}

${conversationSoFar ? `The conversation so far:\n${conversationSoFar}\n` : 'You are beginning this dialogue.'}

Your relevant memories and thoughts:
${relevantMemories}

${sourceContext ? `Relevant passages from your works:\n${sourceContext}\n` : ''}

In the style of ${getStyleDescription(style)}, compose your next utterance. You should:
- Stay in character as ${speaker.identity.name}
- Ground your response in your documented thought where possible
- Engage substantively with the topic and any arguments raised
- ${getStyleGuidance(style)}

Keep your response to 2-4 sentences. If citing your own works, note the reference naturally.

${speaker.identity.name}:`,

  /**
   * Determine rhetorical move type
   */
  classifyMove: (utterance: string, context: string) => `
Given this utterance in a philosophical dialogue:
"${utterance}"

Context:
${context}

Classify the rhetorical move as one of:
- thesis: Stating a position
- antithesis: Opposing a position
- synthesis: Reconciling opposing views
- question: Asking for clarification or probing
- objection: Raising a specific counter-argument
- clarification: Explaining or elaborating
- evidence: Providing support from texts or reasoning
- concession: Acknowledging a point from the other side

Respond with just the single word classification.`,

  /**
   * Generate dialogue summary and insights
   */
  summarizeDialogue: (turns: DialogueTurn[], topic: string) => `
Summarize the following philosophical dialogue on "${topic}":

${turns.map(t => `${t.speakerName}: ${t.utterance}`).join('\n\n')}

Provide:
1. KEY INSIGHTS: 2-3 significant philosophical insights that emerged
2. UNRESOLVED: 1-2 questions or tensions that remain unresolved
3. SOURCES: Notable texts or ideas referenced

Format your response with these exact headers.`,
};

/**
 * Get description of dialogue style
 */
function getStyleDescription(style: DialogueStyle): string {
  switch (style) {
    case 'socratic':
      return 'Socratic dialogue - questions leading to insight';
    case 'disputatio':
      return 'formal academic disputation - thesis, objections, replies';
    case 'commentary':
      return 'shared commentary on a text - interpretation and analysis';
    case 'epistle':
      return 'epistolary exchange - as if writing letters';
    case 'free':
    default:
      return 'free philosophical conversation';
  }
}

/**
 * Get guidance for dialogue style
 */
function getStyleGuidance(style: DialogueStyle): string {
  switch (style) {
    case 'socratic':
      return 'Ask probing questions that lead your interlocutor to examine their assumptions';
    case 'disputatio':
      return 'Present clear arguments with premises and conclusions, or raise formal objections';
    case 'commentary':
      return 'Focus on interpreting and explicating the meaning of texts';
    case 'epistle':
      return 'Write with the measured formality of scholarly correspondence';
    case 'free':
    default:
      return 'Engage naturally while maintaining philosophical depth';
  }
}

/**
 * Dialogue Manager - orchestrates conversations between agents
 */
export class DialogueManager {
  private activeDialogues: Map<string, Dialogue> = new Map();
  private llmCall: (prompt: string) => Promise<string>;

  constructor(llmCall: (prompt: string) => Promise<string>) {
    this.llmCall = llmCall;
  }

  /**
   * Determine if two agents should have a conversation
   */
  async shouldInitiateDialogue(
    initiator: AgentController,
    target: AgentController,
    context: {
      initiatorMemories: ScoredMemoryNode[];
      targetMemories: ScoredMemoryNode[];
    }
  ): Promise<{ shouldConverse: boolean; reason: string }> {
    // Check if either is already in conversation
    if (initiator.isInConversation || target.isInConversation) {
      return { shouldConverse: false, reason: 'One or both agents are busy' };
    }

    // Build relationship context
    const sharedMemories = context.initiatorMemories
      .filter(m => m.node.keywords.has(target.name.toLowerCase()))
      .map(m => m.node.description)
      .slice(0, 5);

    const relationshipContext =
      sharedMemories.length > 0
        ? await this.llmCall(
            DIALOGUE_PROMPTS.relationshipSummary(
              initiator.name,
              target.name,
              sharedMemories
            )
          )
        : `${initiator.name} and ${target.name} have not interacted before.`;

    const prompt = DIALOGUE_PROMPTS.shouldConverse(
      initiator.name,
      target.name,
      relationshipContext,
      initiator['agent'].scratch.currentActivity
    );

    const response = await this.llmCall(prompt);
    const shouldConverse = response.trim().toUpperCase().startsWith('YES');
    const reason = response.split(':')[1]?.trim() || response;

    return { shouldConverse, reason };
  }

  /**
   * Start a new dialogue between two agents
   */
  async startDialogue(
    initiator: AgentController,
    target: AgentController,
    style: DialogueStyle = 'free',
    suggestedTopic?: string
  ): Promise<Dialogue> {
    // Generate topic if not provided
    let topic = suggestedTopic;
    if (!topic) {
      const recentThoughts = initiator['agent'].scratch.recentInsights;
      const sharedInterests = this.findSharedInterests(
        initiator['agent'].identity.coreBeliefs,
        target['agent'].identity.coreBeliefs
      );

      topic = await this.llmCall(
        DIALOGUE_PROMPTS.generateTopic(
          initiator.name,
          target.name,
          recentThoughts,
          sharedInterests
        )
      );
    }

    const dialogue: Dialogue = {
      id: generateDialogueId(),
      participants: [initiator.id, target.id],
      style,
      topic: topic.trim(),
      startTime: initiator['agent'].scratch.currTime,
      endTime: null,
      turns: [],
      keyInsights: [],
      unresolvedQuestions: [],
      sourcesDiscussed: [],
    };

    // Update agent states
    const estimatedEndTime = new Date(
      dialogue.startTime.getTime() + 10 * 60 * 1000 // 10 minutes
    );

    initiator.startConversation(target.name, estimatedEndTime);
    target.startConversation(initiator.name, estimatedEndTime);

    this.activeDialogues.set(dialogue.id, dialogue);
    return dialogue;
  }

  /**
   * Generate the next turn in a dialogue
   */
  async generateTurn(
    dialogueId: string,
    speaker: AgentController,
    context: {
      relevantMemories: ScoredMemoryNode[];
      sourcePassages: SourcePassage[];
    }
  ): Promise<DialogueTurn> {
    const dialogue = this.activeDialogues.get(dialogueId);
    if (!dialogue) {
      throw new Error(`Dialogue ${dialogueId} not found`);
    }

    // Format conversation so far
    const conversationSoFar = dialogue.turns
      .map(t => `${t.speakerName}: ${t.utterance}`)
      .join('\n\n');

    // Format relevant memories
    const relevantMemories = context.relevantMemories
      .slice(0, 10)
      .map(m => `- ${m.node.description}`)
      .join('\n');

    // Format source passages
    const sourceContext = formatPassagesForContext(context.sourcePassages, 1000);

    // Generate utterance
    const utterance = await this.llmCall(
      DIALOGUE_PROMPTS.generateUtterance(
        speaker['agent'],
        dialogue.topic,
        conversationSoFar,
        relevantMemories,
        sourceContext,
        dialogue.style
      )
    );

    // Classify the rhetorical move
    const moveResponse = await this.llmCall(
      DIALOGUE_PROMPTS.classifyMove(utterance, conversationSoFar)
    );
    const rhetoricMove = this.parseRhetoricMove(moveResponse);

    // Create turn
    const turn: DialogueTurn = {
      id: generateTurnId(),
      speakerId: speaker.id,
      speakerName: speaker.name,
      timestamp: speaker['agent'].scratch.currTime,
      utterance: utterance.trim(),
      citations: context.sourcePassages.slice(0, 2).map(p => ({
        sourceId: p.bookId,
        passage: p.text.slice(0, 200),
        relevance: 'supporting context',
      })),
      rhetoricMove,
      informingMemories: context.relevantMemories.slice(0, 5).map(m => m.node.id),
    };

    // Add to dialogue
    dialogue.turns.push(turn);

    // Update agent conversation records
    speaker.addUtterance(speaker.name, utterance.trim());

    return turn;
  }

  /**
   * End a dialogue and generate summary
   */
  async endDialogue(dialogueId: string): Promise<Dialogue> {
    const dialogue = this.activeDialogues.get(dialogueId);
    if (!dialogue) {
      throw new Error(`Dialogue ${dialogueId} not found`);
    }

    dialogue.endTime = new Date();

    // Generate summary
    if (dialogue.turns.length > 0) {
      const summary = await this.llmCall(
        DIALOGUE_PROMPTS.summarizeDialogue(dialogue.turns, dialogue.topic)
      );

      // Parse summary sections
      const insightsMatch = summary.match(/KEY INSIGHTS:([\s\S]*?)(?=UNRESOLVED:|$)/i);
      const unresolvedMatch = summary.match(/UNRESOLVED:([\s\S]*?)(?=SOURCES:|$)/i);
      const sourcesMatch = summary.match(/SOURCES:([\s\S]*?)$/i);

      if (insightsMatch) {
        dialogue.keyInsights = this.parseListItems(insightsMatch[1]);
      }
      if (unresolvedMatch) {
        dialogue.unresolvedQuestions = this.parseListItems(unresolvedMatch[1]);
      }
      if (sourcesMatch) {
        dialogue.sourcesDiscussed = this.parseListItems(sourcesMatch[1]);
      }
    }

    this.activeDialogues.delete(dialogueId);
    return dialogue;
  }

  /**
   * Get an active dialogue by ID
   */
  getDialogue(dialogueId: string): Dialogue | undefined {
    return this.activeDialogues.get(dialogueId);
  }

  /**
   * Find shared intellectual interests between two sets of beliefs
   */
  private findSharedInterests(beliefs1: string[], beliefs2: string[]): string[] {
    const terms1 = new Set(
      beliefs1.flatMap(b => b.toLowerCase().split(/\s+/))
    );
    const terms2 = new Set(
      beliefs2.flatMap(b => b.toLowerCase().split(/\s+/))
    );

    const shared: string[] = [];
    const importantTerms = [
      'soul', 'nature', 'divine', 'wisdom', 'truth', 'knowledge',
      'transformation', 'unity', 'spirit', 'matter', 'light',
      'microcosm', 'macrocosm', 'philosophy', 'alchemy', 'hermes',
    ];

    for (const term of importantTerms) {
      if (terms1.has(term) && terms2.has(term)) {
        shared.push(term);
      }
    }

    return shared;
  }

  /**
   * Parse rhetorical move from LLM response
   */
  private parseRhetoricMove(
    response: string
  ): DialogueTurn['rhetoricMove'] {
    const move = response.trim().toLowerCase();
    const validMoves: DialogueTurn['rhetoricMove'][] = [
      'thesis', 'antithesis', 'synthesis', 'question',
      'objection', 'clarification', 'evidence', 'concession',
    ];

    for (const validMove of validMoves) {
      if (move.includes(validMove)) {
        return validMove;
      }
    }

    return 'clarification'; // Default
  }

  /**
   * Parse list items from summary text
   */
  private parseListItems(text: string): string[] {
    return text
      .split(/\n/)
      .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(line => line.length > 0);
  }
}

/**
 * Serialize dialogue for storage
 */
export function serializeDialogue(dialogue: Dialogue): string {
  return JSON.stringify({
    ...dialogue,
    startTime: dialogue.startTime.toISOString(),
    endTime: dialogue.endTime?.toISOString() || null,
    turns: dialogue.turns.map(t => ({
      ...t,
      timestamp: t.timestamp.toISOString(),
    })),
  });
}

/**
 * Deserialize dialogue from storage
 */
export function deserializeDialogue(json: string): Dialogue {
  const data = JSON.parse(json);
  return {
    ...data,
    startTime: new Date(data.startTime),
    endTime: data.endTime ? new Date(data.endTime) : null,
    turns: data.turns.map((t: Record<string, unknown>) => ({
      ...t,
      timestamp: new Date(t.timestamp as string),
    })),
  };
}
