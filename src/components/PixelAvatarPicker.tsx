'use client';
import { useState, useRef, useCallback } from 'react';

const PALETTE = ['#F5F5F5','#1A1A1A','#EF4444','#F97316','#EAB308','#22C55E','#14B8A6','#3B82F6','#6366F1','#A855F7','#EC4899','#78350F','#FFFFFF','transparent'];
const GRID_SIZE = 16;

export default function PixelAvatarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const grid = value.length === GRID_SIZE * GRID_SIZE ? value.split('').map(c => parseInt(c, 36)) : new Array(GRID_SIZE * GRID_SIZE).fill(0);
  const [activeColor, setActiveColor] = useState(1);
  const painting = useRef(false);

  const paint = useCallback((idx: number) => {
    if (grid[idx] === activeColor) return;
    const next = [...grid];
    next[idx] = activeColor;
    onChange(next.map(i => i.toString(36)).join(''));
  }, [grid, activeColor, onChange]);

  const clear = () => onChange(new Array(GRID_SIZE * GRID_SIZE).fill(0).map(i => i.toString(36)).join(''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div
        onMouseDown={() => (painting.current = true)}
        onMouseUp={() => (painting.current = false)}
        onMouseLeave={() => (painting.current = false)}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, width: 288, height: 288, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, overflow: 'hidden', userSelect: 'none', touchAction: 'none', backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: `${288/GRID_SIZE}px ${288/GRID_SIZE}px` }}
      >
        {grid.map((c, i) => (
          <div
            key={i}
            onMouseDown={() => paint(i)}
            onMouseEnter={() => painting.current && paint(i)}
            style={{ width: '100%', aspectRatio: '1', background: PALETTE[c] === 'transparent' ? '#0A0E16' : PALETTE[c], cursor: 'pointer' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 288 }}>
        {PALETTE.map((color, i) => (
          <button
            key={i}
            onClick={() => setActiveColor(i)}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: color === 'transparent' ? '#0A0E16' : color,
              border: activeColor === i ? '2px solid #70B5F9' : '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer', padding: 0,
            }}
          />
        ))}
      </div>
      <button onClick={clear} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#8A93A3', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        clear
      </button>
    </div>
  );
}