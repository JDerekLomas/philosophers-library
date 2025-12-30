'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SimulationCanvas from '@/components/game/SimulationCanvas';
import ThoughtBubble from '@/components/game/ThoughtBubble';
import { createInitialState, SimulationState, SimAgent, LIBRARY_LOCATIONS } from '@/lib/simulation/state';
import { initializeSimulation, updateMovement, handleConversations } from '@/lib/simulation/loop';

export default function Home() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stateRef = useRef<SimulationState | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  // Initialize simulation
  useEffect(() => {
    const initialState = createInitialState();
    initializeSimulation(initialState);
    setState(initialState);
    stateRef.current = initialState;
  }, []);

  // Trigger re-render
  const triggerUpdate = useCallback(() => {
    if (stateRef.current) {
      setState({ ...stateRef.current });
      setIsGenerating(stateRef.current.activeConversation?.isGenerating || false);
    }
  }, []);

  // Render loop - smooth 60fps, no async
  useEffect(() => {
    if (!state) return;

    const renderLoop = (currentTime: number) => {
      if (!stateRef.current || stateRef.current.isPaused) {
        animationRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const deltaTime = lastTimeRef.current ? currentTime - lastTimeRef.current : 16;
      lastTimeRef.current = currentTime;

      // Update movement only (sync, fast)
      updateMovement(stateRef.current, deltaTime);
      triggerUpdate();

      animationRef.current = requestAnimationFrame(renderLoop);
    };

    animationRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, triggerUpdate]);

  // Conversation loop - separate, async
  useEffect(() => {
    if (!state) return;

    const conversationTick = async () => {
      if (!stateRef.current || stateRef.current.isPaused) return;
      await handleConversations(stateRef.current, triggerUpdate);
    };

    const interval = setInterval(conversationTick, 500); // Check every 500ms
    return () => clearInterval(interval);
  }, [state, triggerUpdate]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.isPaused = !stateRef.current.isPaused;
      triggerUpdate();
    }
  }, [triggerUpdate]);

  // Change speed
  const setSpeed = useCallback((speed: number) => {
    if (stateRef.current) {
      stateRef.current.speed = speed;
      triggerUpdate();
    }
  }, [triggerUpdate]);

  // Handle agent click
  const handleAgentClick = useCallback(async (agent: SimAgent | null) => {
    if (!stateRef.current) return;

    // Deselect if clicking empty space or same agent
    if (!agent || agent.id === stateRef.current.selectedAgentId) {
      stateRef.current.selectedAgentId = null;
      stateRef.current.agentThought = null;
      triggerUpdate();
      return;
    }

    // Select the agent
    stateRef.current.selectedAgentId = agent.id;
    stateRef.current.agentThought = null;
    triggerUpdate();

    // If agent is conversing, just show the conversation (no need to generate thought)
    if (agent.state === 'conversing') {
      return;
    }

    // Generate thought for reading/contemplating/idle agents
    if (agent.state === 'reading' || agent.state === 'contemplating' || agent.state === 'idle') {
      stateRef.current.isGeneratingThought = true;
      triggerUpdate();

      try {
        const locationName = agent.targetLocation
          ? LIBRARY_LOCATIONS.find(l => l.id === agent.targetLocation)?.name || 'the library'
          : 'the library';

        const response = await fetch('/api/thought', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName: agent.name,
            archetype: agent.archetype,
            coreBeliefs: agent.coreBeliefs,
            activity: agent.activity || agent.state,
            location: locationName,
            interests: agent.interests,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (stateRef.current && stateRef.current.selectedAgentId === agent.id) {
            stateRef.current.agentThought = {
              agentId: agent.id,
              agentName: agent.name,
              context: `${agent.activity || agent.state} at ${locationName}`,
              thought: data.thought,
              timestamp: Date.now(),
            };
          }
        }
      } catch (error) {
        console.error('Failed to generate thought:', error);
      } finally {
        if (stateRef.current) {
          stateRef.current.isGeneratingThought = false;
          triggerUpdate();
        }
      }
    }
  }, [triggerUpdate]);

  // Close thought bubble
  const handleCloseThought = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.selectedAgentId = null;
      stateRef.current.agentThought = null;
      triggerUpdate();
    }
  }, [triggerUpdate]);

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading simulation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-amber-500">
            The Philosopher&apos;s Library
          </h1>
          <p className="text-gray-400 mt-1">
            Watch historical philosophers discuss their ideas
          </p>
        </header>

        <div className="flex gap-6">
          {/* Main canvas area */}
          <div className="flex-1">
            <SimulationCanvas state={state} onAgentClick={handleAgentClick} />
            <p className="text-gray-600 text-xs mt-2">Click on a philosopher to see their thoughts</p>

            {/* Controls */}
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={togglePause}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  state.isPaused
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {state.isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Speed:</span>
                {[0.5, 1, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setSpeed(speed)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      state.speed === speed
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="text-gray-500 text-sm ml-auto">
                Conversations: {state.conversationHistory.length}
              </div>
            </div>

            {/* Thought/Dialogue display */}
            {state.selectedAgentId && (
              <ThoughtBubble
                agent={state.agents.find(a => a.id === state.selectedAgentId) || null}
                thought={state.agentThought}
                conversation={state.activeConversation}
                isGenerating={state.isGeneratingThought}
                onClose={handleCloseThought}
              />
            )}
          </div>

          {/* Sidebar - Agent list */}
          <div className="w-64 bg-gray-900 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">
              Philosophers
            </h2>
            <div className="space-y-3">
              {state.agents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-2 rounded bg-gray-800"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: agent.color }}
                  >
                    {agent.shortName}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {agent.name}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {agent.state === 'conversing' ? (
                        <span className="text-amber-500">
                          conversing with{' '}
                          {state.agents.find(a => a.id === agent.conversationPartner)?.name.split(' ')[0]}
                        </span>
                      ) : agent.state === 'walking' ? (
                        <span>
                          walking to {agent.activity === 'seeking_conversation' ? 'find someone' : agent.targetLocation?.replace('_', ' ') || 'somewhere'}
                        </span>
                      ) : (
                        <span>{agent.activity || agent.state}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent conversation log */}
            {state.conversationHistory.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Recent Topics
                </h3>
                <div className="space-y-1">
                  {state.conversationHistory.slice(-5).reverse().map((conv, i) => (
                    <div key={conv.id} className="text-xs text-gray-500 truncate">
                      • {conv.topic}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
