'use client';

import { AgentThought, SimAgent, ActiveConversation } from '@/lib/simulation/state';

interface ThoughtBubbleProps {
  agent: SimAgent | null;
  thought: AgentThought | null;
  conversation: ActiveConversation | null;
  isGenerating: boolean;
  onClose: () => void;
}

export default function ThoughtBubble({
  agent,
  thought,
  conversation,
  isGenerating,
  onClose,
}: ThoughtBubbleProps) {
  if (!agent) return null;

  // If agent is conversing, show the conversation
  const isConversing = agent.state === 'conversing' && conversation;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: agent.color }}
          >
            {agent.shortName}
          </div>
          <div>
            <div className="font-medium text-gray-200">{agent.name}</div>
            <div className="text-xs text-gray-500 capitalize">
              {isConversing ? 'In conversation' : agent.activity || agent.state}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded p-3 min-h-[60px]">
        {isConversing && conversation ? (
          // Show conversation
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {conversation.turns.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Starting conversation...</p>
            ) : (
              conversation.turns.map((turn, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-amber-500">
                    {turn.speakerName.split(' ')[0]}:
                  </span>{' '}
                  <span className="text-gray-300">{turn.text}</span>
                </div>
              ))
            )}
            {conversation.isGenerating && (
              <p className="text-gray-500 italic text-sm">Thinking...</p>
            )}
          </div>
        ) : isGenerating ? (
          // Loading thought
          <div className="flex items-center gap-2 text-gray-500">
            <span className="animate-pulse">Pondering...</span>
          </div>
        ) : thought ? (
          // Show thought
          <p className="text-gray-300 italic">&ldquo;{thought.thought}&rdquo;</p>
        ) : (
          // Prompt to generate thought
          <p className="text-gray-500 text-sm">
            {agent.state === 'walking'
              ? `${agent.name.split(' ')[0]} is walking...`
              : `Click to see what ${agent.name.split(' ')[0]} is thinking about.`}
          </p>
        )}
      </div>

      {/* Context */}
      {thought && thought.context && (
        <div className="mt-2 text-xs text-gray-600">
          {thought.context}
        </div>
      )}
    </div>
  );
}
