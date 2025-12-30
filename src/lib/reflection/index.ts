/**
 * Reflection Module
 * Based on reflect.py from Stanford Generative Agents
 * Generates higher-order thoughts from accumulated memories
 */

import { MemoryNode, ScoredMemoryNode, PhilosopherAgent } from '../types';
import { MemoryStream } from '../memory';
import { retrieve, RetrievalConfig } from '../retrieval';

/**
 * Check if reflection should be triggered
 * Reflection occurs when accumulated importance exceeds threshold
 */
export function shouldReflect(agent: PhilosopherAgent): boolean {
  const { importanceTriggerCurr, importanceTriggerMax } = agent.scratch;

  // Trigger when counter reaches zero and there are memories to reflect on
  return importanceTriggerCurr <= 0;
}

/**
 * Reset reflection counter after reflection
 */
export function resetReflectionCounter(agent: PhilosopherAgent): void {
  agent.scratch.importanceTriggerCurr = agent.scratch.importanceTriggerMax;
  agent.scratch.importanceEleN = 0;
}

/**
 * Decrement reflection counter based on event importance
 */
export function updateReflectionCounter(
  agent: PhilosopherAgent,
  eventPoignancy: number
): void {
  agent.scratch.importanceTriggerCurr -= eventPoignancy;
  agent.scratch.importanceEleN += 1;
}

/**
 * Reflection prompt templates
 */
export const REFLECTION_PROMPTS = {
  /**
   * Generate focal points - questions to reflect on
   */
  focalPoints: (name: string, recentStatements: string) => `
${name} has been observing and thinking about the following:

${recentStatements}

Given only the information above, what are 3 most salient high-level questions that ${name} can answer about their recent observations and thoughts?

1.`,

  /**
   * Generate insights from retrieved memories
   */
  insights: (name: string, statements: string) => `
Statements about ${name}:
${statements}

What 5 high-level insights can you infer from the above statements?

Format each insight as:
INSIGHT: [insight text]
EVIDENCE: [comma-separated list of statement numbers that support this insight]

1.`,

  /**
   * Generate philosophical insights (adapted for dialectic)
   */
  philosophicalInsights: (name: string, statements: string, archetype: string) => `
${name}, a ${archetype} of the early modern period, has been contemplating the following:

${statements}

As ${name}, what philosophical insights arise from these contemplations? Consider:
- How do these observations relate to your core beliefs?
- What tensions or contradictions emerge?
- What synthesis might resolve apparent conflicts?
- How might your sources (texts you have written or studied) illuminate these matters?

Provide 3-5 insights, each grounded in ${name}'s intellectual tradition.

Format each as:
INSIGHT: [the philosophical insight]
GROUNDING: [how this connects to ${name}'s documented thought]
EVIDENCE: [comma-separated list of statement numbers]

1.`,

  /**
   * Generate planning thought after conversation
   */
  planningThought: (name: string, conversationSummary: string) => `
${name} just had the following conversation:

${conversationSummary}

What is ${name}'s main takeaway from this conversation that will influence their future thinking and actions?

Provide a single planning thought that captures ${name}'s intellectual response to the exchange.`,

  /**
   * Generate memo/summary of conversation
   */
  conversationMemo: (name: string, conversationSummary: string) => `
${name} just had the following conversation:

${conversationSummary}

Summarize this conversation from ${name}'s perspective in a single sentence, capturing the key philosophical points discussed and any agreements or disagreements.`,
};

/**
 * Generate focal points for reflection
 * These are questions the agent should consider
 */
export interface FocalPointGenerator {
  (
    agent: PhilosopherAgent,
    memoryStream: MemoryStream,
    llmCall: (prompt: string) => Promise<string>
  ): Promise<string[]>;
}

export const generateFocalPoints: FocalPointGenerator = async (
  agent,
  memoryStream,
  llmCall
) => {
  // Get recent important memories
  const recentMemories = [
    ...memoryStream.getRecentEvents(agent.scratch.importanceEleN),
    ...memoryStream.getRecentThoughts(agent.scratch.importanceEleN),
  ];

  // Build statements string
  const statements = recentMemories
    .map(node => node.embeddingKey)
    .join('\n');

  const prompt = REFLECTION_PROMPTS.focalPoints(
    agent.identity.name,
    statements
  );

  const response = await llmCall(prompt);

  // Parse numbered list from response
  const focalPoints = response
    .split(/\d+\./)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return focalPoints.slice(0, 3);
};

/**
 * Generate insights and evidence from retrieved memories
 */
export interface InsightWithEvidence {
  insight: string;
  grounding?: string;
  evidenceNodeIds: string[];
}

export interface InsightGenerator {
  (
    agent: PhilosopherAgent,
    retrievedNodes: ScoredMemoryNode[],
    llmCall: (prompt: string) => Promise<string>
  ): Promise<InsightWithEvidence[]>;
}

export const generateInsights: InsightGenerator = async (
  agent,
  retrievedNodes,
  llmCall
) => {
  // Build numbered statements
  const statements = retrievedNodes
    .map((scored, i) => `${i}. ${scored.node.embeddingKey}`)
    .join('\n');

  const prompt = REFLECTION_PROMPTS.philosophicalInsights(
    agent.identity.name,
    statements,
    agent.identity.archetype.replace('_', ' ')
  );

  const response = await llmCall(prompt);

  // Parse insights and evidence
  const insights: InsightWithEvidence[] = [];
  const insightBlocks = response.split(/\d+\./).filter(s => s.trim());

  for (const block of insightBlocks) {
    const insightMatch = block.match(/INSIGHT:\s*(.+?)(?=GROUNDING:|EVIDENCE:|$)/is);
    const groundingMatch = block.match(/GROUNDING:\s*(.+?)(?=EVIDENCE:|$)/is);
    const evidenceMatch = block.match(/EVIDENCE:\s*(.+?)$/is);

    if (insightMatch) {
      const evidenceIndices = evidenceMatch
        ? evidenceMatch[1]
            .split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n >= 0 && n < retrievedNodes.length)
        : [];

      insights.push({
        insight: insightMatch[1].trim(),
        grounding: groundingMatch?.[1].trim(),
        evidenceNodeIds: evidenceIndices.map(i => retrievedNodes[i].node.id),
      });
    }
  }

  return insights.slice(0, 5);
};

/**
 * Generate SPO triple from a thought description
 */
export interface TripleGenerator {
  (description: string, llmCall: (prompt: string) => Promise<string>): Promise<{
    subject: string;
    predicate: string;
    object: string;
  }>;
}

export const generateTriple: TripleGenerator = async (description, llmCall) => {
  const prompt = `Convert this statement into a simple Subject-Predicate-Object triple:

Statement: "${description}"

Respond in this exact format:
Subject: [subject]
Predicate: [predicate/verb]
Object: [object]`;

  const response = await llmCall(prompt);

  const subjectMatch = response.match(/Subject:\s*(.+)/i);
  const predicateMatch = response.match(/Predicate:\s*(.+)/i);
  const objectMatch = response.match(/Object:\s*(.+)/i);

  return {
    subject: subjectMatch?.[1].trim() || description.split(' ')[0],
    predicate: predicateMatch?.[1].trim() || 'reflects on',
    object: objectMatch?.[1].trim() || description,
  };
};

/**
 * Generate importance score for a thought or event
 */
export interface PoignancyGenerator {
  (
    agent: PhilosopherAgent,
    description: string,
    eventType: 'event' | 'thought' | 'chat',
    llmCall: (prompt: string) => Promise<string>
  ): Promise<number>;
}

export const generatePoignancy: PoignancyGenerator = async (
  agent,
  description,
  eventType,
  llmCall
) => {
  if (description.includes('is idle')) {
    return 1;
  }

  const typeDescription = {
    event: 'observation or action',
    thought: 'thought or reflection',
    chat: 'conversation',
  }[eventType];

  const prompt = `On the scale of 1 to 10, where 1 is purely mundane (e.g., walking around) and 10 is extremely profound (e.g., a major philosophical breakthrough), rate the likely importance of the following ${typeDescription} to ${agent.identity.name}, a ${agent.identity.archetype.replace('_', ' ')}:

"${description}"

Rating (respond with just a number 1-10):`;

  const response = await llmCall(prompt);
  const rating = parseInt(response.trim());

  return isNaN(rating) ? 5 : Math.max(1, Math.min(10, rating));
};

/**
 * Run the full reflection process
 */
export async function runReflection(
  agent: PhilosopherAgent,
  memoryStream: MemoryStream,
  getEmbedding: (text: string) => Promise<number[]>,
  llmCall: (prompt: string) => Promise<string>,
  config?: Partial<RetrievalConfig>
): Promise<MemoryNode[]> {
  const newThoughts: MemoryNode[] = [];

  // 1. Generate focal points
  const focalPoints = await generateFocalPoints(agent, memoryStream, llmCall);

  // 2. Retrieve relevant memories for each focal point
  const retrieved = await retrieve(
    memoryStream,
    focalPoints,
    getEmbedding,
    config
  );

  // 3. Generate insights from each set of retrieved memories
  for (const [focalPoint, scoredNodes] of retrieved) {
    if (scoredNodes.length === 0) continue;

    const insights = await generateInsights(agent, scoredNodes, llmCall);

    // 4. Create memory nodes for each insight
    for (const { insight, evidenceNodeIds } of insights) {
      const created = agent.scratch.currTime;
      const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { subject, predicate, object } = await generateTriple(
        insight,
        llmCall
      );

      const keywords = new Set([subject, predicate, object]);
      const poignancy = await generatePoignancy(
        agent,
        insight,
        'thought',
        llmCall
      );

      const embedding = await getEmbedding(insight);
      const embeddingPair: [string, number[]] = [insight, embedding];

      const node = memoryStream.addThought(
        created,
        expiration,
        subject,
        predicate,
        object,
        insight,
        keywords,
        poignancy,
        embeddingPair,
        evidenceNodeIds
      );

      newThoughts.push(node);
    }
  }

  return newThoughts;
}

/**
 * Reflect on a completed conversation
 */
export async function reflectOnConversation(
  agent: PhilosopherAgent,
  memoryStream: MemoryStream,
  conversationTurns: Array<[string, string]>,
  otherParticipant: string,
  getEmbedding: (text: string) => Promise<number[]>,
  llmCall: (prompt: string) => Promise<string>
): Promise<{ planningThought: MemoryNode; memo: MemoryNode }> {
  // Format conversation
  const conversationSummary = conversationTurns
    .map(([speaker, utterance]) => `${speaker}: ${utterance}`)
    .join('\n');

  // Get last chat node as evidence
  const lastChat = memoryStream.getLastChat(otherParticipant);
  const evidence = lastChat ? [lastChat.id] : [];

  // Generate planning thought
  const planningPrompt = REFLECTION_PROMPTS.planningThought(
    agent.identity.name,
    conversationSummary
  );
  const planningResponse = await llmCall(planningPrompt);
  const planningDescription = `For ${agent.identity.name}'s planning: ${planningResponse}`;

  const created = agent.scratch.currTime;
  const expiration = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);

  const planningTriple = await generateTriple(planningDescription, llmCall);
  const planningPoignancy = await generatePoignancy(
    agent,
    planningDescription,
    'thought',
    llmCall
  );
  const planningEmbedding = await getEmbedding(planningDescription);

  const planningThought = memoryStream.addThought(
    created,
    expiration,
    planningTriple.subject,
    planningTriple.predicate,
    planningTriple.object,
    planningDescription,
    new Set([planningTriple.subject, planningTriple.predicate, planningTriple.object]),
    planningPoignancy,
    [planningDescription, planningEmbedding],
    evidence
  );

  // Generate memo
  const memoPrompt = REFLECTION_PROMPTS.conversationMemo(
    agent.identity.name,
    conversationSummary
  );
  const memoResponse = await llmCall(memoPrompt);
  const memoDescription = `${agent.identity.name} ${memoResponse}`;

  const memoTriple = await generateTriple(memoDescription, llmCall);
  const memoPoignancy = await generatePoignancy(
    agent,
    memoDescription,
    'thought',
    llmCall
  );
  const memoEmbedding = await getEmbedding(memoDescription);

  const memo = memoryStream.addThought(
    created,
    expiration,
    memoTriple.subject,
    memoTriple.predicate,
    memoTriple.object,
    memoDescription,
    new Set([memoTriple.subject, memoTriple.predicate, memoTriple.object]),
    memoPoignancy,
    [memoDescription, memoEmbedding],
    evidence
  );

  return { planningThought, memo };
}
