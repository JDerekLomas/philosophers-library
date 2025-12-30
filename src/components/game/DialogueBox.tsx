'use client';

import { ActiveConversation } from '@/lib/simulation/state';

interface DialogueBoxProps {
  conversation: ActiveConversation | null;
  isGenerating: boolean;
}

export default function DialogueBox({ conversation, isGenerating }: DialogueBoxProps) {
  if (!conversation) {
    return (
      <div className="h-48 bg-gray-900/90 border-2 border-gray-700 rounded-lg p-4 flex items-center justify-center">
        <p className="text-gray-500 italic">
          Philosophers are wandering the library...
        </p>
      </div>
    );
  }

  const { topic, turns } = conversation;

  return (
    <div className="h-48 bg-gray-900/90 border-2 border-amber-700 rounded-lg p-4 flex flex-col">
      {/* Topic header */}
      <div className="text-amber-500 text-sm mb-2 border-b border-amber-700/50 pb-2">
        Discussing: <span className="italic">{topic}</span>
      </div>

      {/* Conversation turns */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {turns.length === 0 && (
          <p className="text-gray-500 italic text-sm">
            The conversation is beginning...
          </p>
        )}

        {turns.map((turn, index) => (
          <div key={index} className="text-sm">
            <span className="text-amber-400 font-semibold">
              {turn.speakerName}:
            </span>{' '}
            <span className="text-gray-200">{turn.text}</span>
          </div>
        ))}

        {isGenerating && (
          <div className="text-gray-400 text-sm animate-pulse">
            Thinking...
          </div>
        )}
      </div>
    </div>
  );
}
