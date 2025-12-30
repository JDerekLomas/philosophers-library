'use client';

import { SimAgent, ActiveConversation } from '@/lib/simulation/state';

interface ThoughtBubbleProps {
  agent: SimAgent | null;
  conversation: ActiveConversation | null;
  onClose: () => void;
}

export default function ThoughtBubble({
  agent,
  conversation,
  onClose,
}: ThoughtBubbleProps) {
  if (!agent) return null;

  // If agent is conversing, show the conversation
  const isConversing = agent.state === 'conversing' && conversation;

  // Get recent memories (last 10)
  const recentMemories = agent.memoryStream.slice(-10).reverse();

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold relative"
            style={{ backgroundColor: agent.color }}
          >
            {agent.shortName}
            {agent.isGeneratingThought && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <div className="font-medium text-gray-200">{agent.name}</div>
            <div className="text-xs text-gray-500 capitalize">
              {isConversing ? 'In conversation' : agent.activity || agent.state}
              {agent.isGeneratingThought && (
                <span className="text-amber-500 ml-2">thinking...</span>
              )}
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
      <div className="bg-gray-800 rounded p-3 max-h-64 overflow-y-auto">
        {isConversing && conversation ? (
          // Show conversation
          <div className="space-y-2">
            <div className="text-xs text-gray-500 mb-2">Dialogue</div>
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
        ) : recentMemories.length > 0 ? (
          // Show memory stream
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-2">Stream of Consciousness</div>
            {recentMemories.map((memory, i) => (
              <div key={memory.id} className={`text-sm ${i === 0 ? 'text-gray-200' : 'text-gray-400'}`}>
                <span className="text-gray-600 text-xs mr-2">
                  {memory.type === 'observation' ? '👁' : memory.type === 'reflection' ? '💭' : '·'}
                </span>
                <span className={i === 0 ? 'italic' : ''}>&ldquo;{memory.content}&rdquo;</span>
                {memory.context && i === 0 && (
                  <div className="text-xs text-gray-600 mt-1 ml-5">{memory.context}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // No memories yet
          <div className="text-gray-500 text-sm text-center py-4">
            <p>{agent.name.split(' ')[0]}&apos;s mind is quiet...</p>
            <p className="text-xs mt-1">Thoughts will appear as they form</p>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-2 flex justify-between text-xs text-gray-600">
        <span>{agent.memoryStream.length} memories</span>
        <span>{agent.archetype}</span>
      </div>
    </div>
  );
}
