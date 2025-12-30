'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  SimulationState,
  SimAgent,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BOUNDS,
} from '@/lib/simulation/state';

interface SimulationCanvasProps {
  state: SimulationState;
}

// Draw the library background
function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Floor - warm wood pattern
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Checkerboard floor pattern
  const tileSize = 40;
  for (let x = 0; x < CANVAS_WIDTH; x += tileSize) {
    for (let y = BOUNDS.minY; y < CANVAS_HEIGHT; y += tileSize) {
      if ((x / tileSize + y / tileSize) % 2 === 0) {
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // Bookshelves at top
  const shelfHeight = BOUNDS.minY - 10;
  ctx.fillStyle = '#2d1f14';
  ctx.fillRect(0, 0, CANVAS_WIDTH, shelfHeight);

  // Book spines
  const bookColors = ['#8B0000', '#00008B', '#006400', '#8B4513', '#4B0082', '#2F4F4F'];
  let bookX = 10;
  while (bookX < CANVAS_WIDTH - 10) {
    const bookWidth = 15 + Math.random() * 20;
    const bookHeight = 60 + Math.random() * 30;
    ctx.fillStyle = bookColors[Math.floor(Math.random() * bookColors.length)];
    ctx.fillRect(bookX, shelfHeight - bookHeight - 5, bookWidth - 2, bookHeight);
    bookX += bookWidth;
  }

  // Shelf edge
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(0, shelfHeight - 5, CANVAS_WIDTH, 8);

  // Decorative rug in center
  const rugX = CANVAS_WIDTH / 2 - 150;
  const rugY = CANVAS_HEIGHT / 2 - 50;
  ctx.fillStyle = '#722F37';
  ctx.fillRect(rugX, rugY, 300, 150);
  ctx.fillStyle = '#8B4513';
  ctx.strokeStyle = '#DAA520';
  ctx.lineWidth = 3;
  ctx.strokeRect(rugX + 10, rugY + 10, 280, 130);
  ctx.strokeRect(rugX + 20, rugY + 20, 260, 110);

  // Reading desk on right
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(CANVAS_WIDTH - 150, BOUNDS.minY + 50, 120, 80);
  ctx.fillStyle = '#f5deb3';
  ctx.fillRect(CANVAS_WIDTH - 140, BOUNDS.minY + 60, 40, 30); // Paper
  ctx.fillRect(CANVAS_WIDTH - 90, BOUNDS.minY + 55, 50, 40); // Paper

  // Alchemy table on left
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(30, BOUNDS.minY + 80, 100, 60);

  // Glowing orbs on table
  const orbColors = ['#00ff88', '#ff00ff', '#ffff00'];
  orbColors.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(50 + i * 30, BOUNDS.minY + 100, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50 + i * 30, BOUNDS.minY + 100, 12, 0, Math.PI * 2);
    ctx.fillStyle = color + '40';
    ctx.fill();
  });

  // Candles
  const candlePositions = [
    { x: 200, y: BOUNDS.minY + 40 },
    { x: CANVAS_WIDTH - 200, y: BOUNDS.minY + 40 },
    { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 },
  ];
  for (const pos of candlePositions) {
    // Candle body
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect(pos.x - 4, pos.y, 8, 20);
    // Flame
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 5, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffa500';
    ctx.fill();
    // Glow
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 5, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.15)';
    ctx.fill();
  }
}

// Draw a single agent
function drawAgent(ctx: CanvasRenderingContext2D, agent: SimAgent): void {
  const { x, y, color, shortName, name, state } = agent;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(x, y + 25, 20, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();

  // Agent body (circle)
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Border
  ctx.strokeStyle = state === 'conversing' ? '#FFD700' : '#ffffff';
  ctx.lineWidth = state === 'conversing' ? 3 : 2;
  ctx.stroke();

  // Initials
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shortName, x, y);

  // Name label below
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';
  ctx.fillText(name.split(' ')[0], x, y + 42);

  // Speech bubble if conversing
  if (state === 'conversing') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 20, y - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 28, y - 38, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 33, y - 44, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thinking indicator if idle
  if (state === 'thinking') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '16px sans-serif';
    ctx.fillText('...', x, y - 35);
  }
}

export default function SimulationCanvas({ state }: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize background canvas once
  useEffect(() => {
    if (!bgCanvasRef.current) {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = CANVAS_WIDTH;
      bgCanvas.height = CANVAS_HEIGHT;
      const bgCtx = bgCanvas.getContext('2d');
      if (bgCtx) {
        drawBackground(bgCtx);
      }
      bgCanvasRef.current = bgCanvas;
    }
  }, []);

  // Draw frame
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw cached background
    ctx.drawImage(bgCanvas, 0, 0);

    // Draw agents (sorted by Y for depth)
    const sortedAgents = [...state.agents].sort((a, b) => a.y - b.y);
    for (const agent of sortedAgents) {
      drawAgent(ctx, agent);
    }

    // Pause overlay
    if (state.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [state]);

  // Redraw when state changes
  useEffect(() => {
    draw();
  }, [draw, state]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        border: '2px solid #4a4a6a',
        borderRadius: '4px',
        imageRendering: 'crisp-edges',
      }}
    />
  );
}
