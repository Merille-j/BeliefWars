import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { selectHumanRole } from '../store/gameStore';
import { probabilityToColor } from '../utils/colorUtils';
import { pixelToCell, cellCenter } from '../utils/gridUtils';
import { GameRole, GamePhase, PendingActionMode } from '../types/client.types';

const GRID_SIZE = 10;
const CANVAS_SIZE = 500;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE; // 50px per cell

const PROB_LABEL_THRESHOLD = 0.005;

interface HoverCell {
  x: number;
  y: number;
  probability: number;
  elX: number;
  elY: number;
}

interface HeatmapCanvasProps {
  onCellClick: (x: number, y: number) => void;
}

export const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({ onCellClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);

  const { grid, entities, gameState, pendingAction, selectedCells } = useGameStore();
  const humanRole = useGameStore(selectHumanRole);
  const suggestedPath = useGameStore(s => s.suggestedPath);

  const phase = gameState?.phase ?? GamePhase.RECON;
  const isGhostMoving  = humanRole === GameRole.GHOST && phase === GamePhase.OBJECTIVE && pendingAction === 'move';
  const isManipulation = humanRole === GameRole.GHOST && phase === GamePhase.MANIPULATION;

  // ─── Draw ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Heat cells
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = grid.cells[y]?.[x];
        if (!cell) continue;
        const { r, g, b } = probabilityToColor(cell.probability);
        const alpha = 0.15 + cell.probability * 0.85;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // 2. Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE); ctx.stroke();
    }

    // 3. Probability % labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = grid.cells[y]?.[x];
        if (!cell || cell.probability < PROB_LABEL_THRESHOLD) continue;
        const pct = cell.probability * 100;
        const label = pct < 10 ? pct.toFixed(1) + '%' : Math.round(pct) + '%';
        const cx = x * CELL_SIZE + CELL_SIZE / 2;
        const cy = y * CELL_SIZE + CELL_SIZE / 2;
        ctx.font = `bold ${CELL_SIZE * 0.28}px monospace`;
        const textAlpha = 0.55 + cell.probability * 0.45;
        ctx.fillStyle = cell.probability > 0.35
          ? `rgba(0,0,0,${textAlpha})`
          : `rgba(255,255,255,${textAlpha})`;
        ctx.fillText(label, cx, cy);
      }
    }

    // 4. Objectives
    const objectives = gameState?.objectives ?? [];
    for (const obj of objectives) {
      const { px, py } = cellCenter(obj.position.x, obj.position.y, CELL_SIZE);
      if (obj.completed) {
        ctx.fillStyle = 'rgba(0,255,136,0.3)';
        ctx.fillRect(obj.position.x * CELL_SIZE, obj.position.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.fillStyle = '#00ff88';
        ctx.font = `${CELL_SIZE * 0.55}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✓', px, py);
      } else {
        ctx.fillStyle = 'rgba(255,221,0,0.18)';
        ctx.fillRect(obj.position.x * CELL_SIZE, obj.position.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
        ctx.strokeRect(obj.position.x * CELL_SIZE + 2, obj.position.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.fillStyle = '#ffdd00';
        ctx.font = `bold ${CELL_SIZE * 0.38}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(obj.label.slice(-1), px, obj.position.y * CELL_SIZE + 2);
        ctx.textBaseline = 'middle';
      }
    }

    // 5. False-trail selected cells
    if (pendingAction === 'lay_false_trail' && selectedCells.length > 0) {
      // Draw connecting line between trail points
      if (selectedCells.length > 1) {
        ctx.strokeStyle = 'rgba(255,102,0,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        const first = cellCenter(selectedCells[0].x, selectedCells[0].y, CELL_SIZE);
        ctx.moveTo(first.px, first.py);
        for (let i = 1; i < selectedCells.length; i++) {
          const c = cellCenter(selectedCells[i].x, selectedCells[i].y, CELL_SIZE);
          ctx.lineTo(c.px, c.py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Highlight each selected cell
      for (let i = 0; i < selectedCells.length; i++) {
        const cell = selectedCells[i];
        ctx.fillStyle = 'rgba(255,102,0,0.25)';
        ctx.fillRect(cell.x * CELL_SIZE, cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2;
        ctx.strokeRect(cell.x * CELL_SIZE + 1, cell.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        const { px, py } = cellCenter(cell.x, cell.y, CELL_SIZE);
        ctx.fillStyle = '#ff6600';
        ctx.font = `bold ${CELL_SIZE * 0.35}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px, py);
      }
      // Extend line to hover cell if we have one
      if (hoverCell && selectedCells.length > 0) {
        const last = cellCenter(selectedCells[selectedCells.length - 1].x, selectedCells[selectedCells.length - 1].y, CELL_SIZE);
        const { px, py } = cellCenter(hoverCell.x, hoverCell.y, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255,102,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(last.px, last.py);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 5.5 — A* suggested path overlay (drawn before move-mode overlay)
    // Show whenever a path exists in OBJECTIVE phase, regardless of pendingAction state
    const isObjectivePhase = humanRole === GameRole.GHOST && phase === GamePhase.OBJECTIVE;
    if (suggestedPath && suggestedPath.length > 0 && isObjectivePhase) {
      const ghostEntity = entities.find(e => e.role === GameRole.GHOST);
      const gx = ghostEntity?.position.x ?? -1;
      const gy = ghostEntity?.position.y ?? -1;

      // Draw path line connecting Ghost → each step
      ctx.strokeStyle = 'rgba(0,255,136,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      const startC = cellCenter(gx, gy, CELL_SIZE);
      ctx.moveTo(startC.px, startC.py);
      for (const step of suggestedPath) {
        const c = cellCenter(step.x, step.y, CELL_SIZE);
        ctx.lineTo(c.px, c.py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight each path cell with a faint green tint + step number
      suggestedPath.forEach((step, i) => {
        const isNext = i === 0; // first step is the immediate next move
        ctx.fillStyle = isNext ? 'rgba(0,255,136,0.22)' : 'rgba(0,255,136,0.10)';
        ctx.fillRect(step.x * CELL_SIZE, step.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        // Step number
        const { px, py } = cellCenter(step.x, step.y, CELL_SIZE);
        ctx.fillStyle = isNext ? 'rgba(0,255,136,0.9)' : 'rgba(0,255,136,0.5)';
        ctx.font = `bold ${CELL_SIZE * 0.3}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px, py + CELL_SIZE * 0.22);
      });

      // Goal marker (last cell in path)
      const goal = suggestedPath[suggestedPath.length - 1];
      const { px: gpx, py: gpy } = cellCenter(goal.x, goal.y, CELL_SIZE);
      ctx.strokeStyle = 'rgba(0,255,136,1.0)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(goal.x * CELL_SIZE + 2, goal.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      ctx.fillStyle = 'rgba(0,255,136,0.9)';
      ctx.font = `bold ${CELL_SIZE * 0.38}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', gpx, gpy - CELL_SIZE * 0.18);
    }

    // 6. Manipulation hover previews
    if (isManipulation && hoverCell) {
      const hx = hoverCell.x;
      const hy = hoverCell.y;
      const { px, py } = cellCenter(hx, hy, CELL_SIZE);

      if (pendingAction === 'throw_decoy') {
        // Highlight target cell with yellow spike indicator
        ctx.fillStyle = 'rgba(255,221,0,0.25)';
        ctx.fillRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255,221,0,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx * CELL_SIZE + 1, hy * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        // Spike icon — upward arrow
        ctx.fillStyle = 'rgba(255,221,0,0.9)';
        ctx.font = `bold ${CELL_SIZE * 0.5}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('▲', px, py);
      }

      if (pendingAction === 'make_noise') {
        // Highlight all cells in radius 2 (Chebyshev)
        const radius = 2;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = hx + dx;
            const ny = hy + dy;
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            const alpha = dist === 0 ? 0.35 : 0.18 - dist * 0.04;
            ctx.fillStyle = `rgba(255,170,0,${Math.max(0.05, alpha)})`;
            ctx.fillRect(nx * CELL_SIZE, ny * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
        // Outer border — clamped to canvas bounds
        const bx1 = Math.max(0, hx - radius) * CELL_SIZE + 1;
        const by1 = Math.max(0, hy - radius) * CELL_SIZE + 1;
        const bx2 = Math.min(GRID_SIZE, hx + radius + 1) * CELL_SIZE - 2;
        const by2 = Math.min(GRID_SIZE, hy + radius + 1) * CELL_SIZE - 2;
        ctx.strokeStyle = 'rgba(255,170,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
        // Centre icon
        ctx.fillStyle = 'rgba(255,170,0,0.9)';
        ctx.font = `bold ${CELL_SIZE * 0.5}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('📢', px, py);
      }

      if (pendingAction === 'lay_false_trail') {
        // Next-point preview
        ctx.fillStyle = 'rgba(255,102,0,0.22)';
        ctx.fillRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255,102,0,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(hx * CELL_SIZE + 1, hy * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,102,0,0.9)';
        ctx.font = `bold ${CELL_SIZE * 0.35}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(selectedCells.length + 1), px, py);
      }
    }

    // 7. Move-mode hover preview — only valid adjacent cells are highlighted
    if (isGhostMoving) {
      const ghostEntity = entities.find(e => e.role === GameRole.GHOST);
      const gx = ghostEntity?.position.x ?? -1;
      const gy = ghostEntity?.position.y ?? -1;

      // Compute the 4 valid adjacent cells
      const adjacent = [
        { x: gx,     y: gy - 1 },
        { x: gx,     y: gy + 1 },
        { x: gx - 1, y: gy     },
        { x: gx + 1, y: gy     },
      ].filter(c => c.x >= 0 && c.x < GRID_SIZE && c.y >= 0 && c.y < GRID_SIZE);

      // Dim all non-adjacent cells with a dark overlay
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const isAdj = adjacent.some(c => c.x === x && c.y === y);
          const isGhostCell = x === gx && y === gy;
          if (!isAdj && !isGhostCell) {
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }

      // Highlight each valid adjacent cell with a green border + arrow
      const ARROWS: Record<string, string> = {
        '0,-1': '↑', '0,1': '↓', '-1,0': '←', '1,0': '→',
      };
      for (const adj of adjacent) {
        const isHovered = hoverCell?.x === adj.x && hoverCell?.y === adj.y;
        const { px, py } = cellCenter(adj.x, adj.y, CELL_SIZE);

        ctx.fillStyle = isHovered ? 'rgba(0,255,136,0.30)' : 'rgba(0,255,136,0.12)';
        ctx.fillRect(adj.x * CELL_SIZE, adj.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        ctx.strokeStyle = isHovered ? 'rgba(0,255,136,1.0)' : 'rgba(0,255,136,0.55)';
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeRect(adj.x * CELL_SIZE + 1, adj.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        // Direction arrow
        const dirKey = `${adj.x - gx},${adj.y - gy}`;
        ctx.fillStyle = isHovered ? 'rgba(0,255,136,1.0)' : 'rgba(0,255,136,0.65)';
        ctx.font = `bold ${CELL_SIZE * 0.45}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ARROWS[dirKey] ?? '·', px, py);
      }

      // Ghost-preview circle on hovered adjacent cell
      if (hoverCell && adjacent.some(c => c.x === hoverCell.x && c.y === hoverCell.y)) {
        const { px, py } = cellCenter(hoverCell.x, hoverCell.y, CELL_SIZE);
        ctx.beginPath();
        ctx.arc(px, py, CELL_SIZE * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,136,0.55)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.font = `bold ${CELL_SIZE * 0.32}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G', px, py);
      }
    }

    // 8. Entities (always on top)
    for (const entity of entities) {
      const { px, py } = cellCenter(entity.position.x, entity.position.y, CELL_SIZE);
      if (entity.role === GameRole.GHOST) {
        if (humanRole === GameRole.GHOST) {
          ctx.beginPath(); ctx.arc(px, py, CELL_SIZE * 0.44, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,255,136,0.15)'; ctx.fill();
          ctx.beginPath(); ctx.arc(px, py, CELL_SIZE * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,255,136,0.95)'; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#000';
          ctx.font = `bold ${CELL_SIZE * 0.42}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('G', px, py);
        }
      } else if (entity.role === GameRole.SEEKER) {
        ctx.beginPath(); ctx.arc(px, py, CELL_SIZE * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,170,255,0.15)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, CELL_SIZE * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,170,255,0.95)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = `bold ${CELL_SIZE * 0.42}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('S', px, py);
      }
    }

    // 9. Hover highlight (non-action modes)
    if (hoverCell && pendingAction === 'none') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(hoverCell.x * CELL_SIZE + 1, hoverCell.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    // 10. Pending-action border glow
    if (pendingAction !== 'none') {
      const tints: Record<string, string> = {
        throw_decoy:     'rgba(255,221,0,0.10)',
        make_noise:      'rgba(255,170,0,0.10)',
        lay_false_trail: 'rgba(255,102,0,0.10)',
        move:            'rgba(0,255,136,0.08)',
        scan:            'rgba(0,170,255,0.08)',
        lock:            'rgba(255,50,50,0.10)',
      };
      const borders: Record<string, string> = {
        throw_decoy:     'rgba(255,221,0,0.7)',
        make_noise:      'rgba(255,170,0,0.7)',
        lay_false_trail: 'rgba(255,102,0,0.7)',
        move:            'rgba(0,255,136,0.7)',
        scan:            'rgba(0,170,255,0.7)',
        lock:            'rgba(255,50,50,0.7)',
      };
      ctx.fillStyle = tints[pendingAction] ?? 'rgba(255,170,0,0.10)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.strokeStyle = borders[pendingAction] ?? 'rgba(255,170,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, 1, CANVAS_SIZE - 2, CANVAS_SIZE - 2);
    }
  }, [grid, entities, gameState, humanRole, pendingAction, selectedCells, hoverCell, isGhostMoving, isManipulation, suggestedPath]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!grid) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cpx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
      const cpy = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height);
      const cell = pixelToCell(cpx, cpy, CELL_SIZE);
      if (!cell) { setHoverCell(null); return; }
      const gridCell = grid.cells[cell.y]?.[cell.x];
      if (!gridCell) return;
      setHoverCell({ x: cell.x, y: cell.y, probability: gridCell.probability, elX: e.clientX - rect.left, elY: e.clientY - rect.top });
    },
    [grid]
  );

  const handleMouseLeave = useCallback(() => setHoverCell(null), []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!grid) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cpx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
      const cpy = (e.clientY - rect.top)  * (CANVAS_SIZE / rect.height);
      const cell = pixelToCell(cpx, cpy, CELL_SIZE);
      if (!cell) return;
      onCellClick(cell.x, cell.y);
    },
    [grid, onCellClick]
  );

  const cursor = pendingAction !== 'none' ? 'crosshair' : 'default';

  // Tooltip content varies by action
  const tooltipAction = (): React.ReactNode => {
    if (!hoverCell) return null;
    switch (pendingAction as PendingActionMode) {
      case 'throw_decoy':
        return <div className="text-yellow-300 mt-0.5">Click → +30% spike here</div>;
      case 'make_noise':
        return <div className="text-orange-300 mt-0.5">Click → +15% in 5×5 area</div>;
      case 'lay_false_trail':
        return (
          <div className="text-orange-400 mt-0.5">
            {selectedCells.length === 0
              ? 'Click to start trail'
              : selectedCells.length < 2
              ? `Point ${selectedCells.length + 1} — click to add`
              : `Point ${selectedCells.length + 1} — click to submit`}
          </div>
        );
      case 'move': {
        if (!hoverCell) return null;
        const ghostEntity = entities.find(e => e.role === GameRole.GHOST);
        const gx = ghostEntity?.position.x ?? -1;
        const gy = ghostEntity?.position.y ?? -1;
        const dx = Math.abs(hoverCell.x - gx);
        const dy = Math.abs(hoverCell.y - gy);
        const isAdj = dx + dy === 1;
        return isAdj
          ? <div className="text-green-400 mt-0.5">Click to move here</div>
          : <div className="text-gray-500 mt-0.5">Not adjacent — can't move here</div>;
      }
      case 'scan':
        return <div className="text-blue-400 mt-0.5">Click → scan this zone</div>;
      case 'lock':
        return <div className="text-red-400 mt-0.5">Click → lock this cell</div>;
      default:
        return null;
    }
  };

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block rounded-lg border border-gray-700"
        style={{ width: '100%', maxWidth: `${CANVAS_SIZE}px`, cursor, imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hoverCell && (
        <div
          className="absolute pointer-events-none z-20 bg-gray-900/95 border border-gray-600 rounded px-2 py-1 text-xs font-mono text-white shadow-lg"
          style={{
            left: hoverCell.elX + 14,
            top:  hoverCell.elY - 12,
            transform: hoverCell.elX > 420 ? 'translateX(-115%)' : 'none',
          }}
        >
          <div className="text-gray-400">({hoverCell.x}, {hoverCell.y})</div>
          <div className="text-yellow-300 font-bold">{(hoverCell.probability * 100).toFixed(2)}%</div>
          {tooltipAction()}
        </div>
      )}

      {/* Action banner */}
      {pendingAction !== 'none' && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full pointer-events-none shadow whitespace-nowrap"
          style={{
            background:
              pendingAction === 'move'            ? 'rgba(0,255,136,0.92)' :
              pendingAction === 'lock'            ? 'rgba(255,50,50,0.92)' :
              pendingAction === 'scan'            ? 'rgba(0,170,255,0.92)' :
              pendingAction === 'throw_decoy'     ? 'rgba(255,221,0,0.92)' :
              pendingAction === 'make_noise'      ? 'rgba(255,170,0,0.92)' :
              pendingAction === 'lay_false_trail' ? 'rgba(255,102,0,0.92)' :
              'rgba(255,200,0,0.92)',
            color: '#000',
          }}
        >
          {BANNER_LABELS[pendingAction as PendingActionMode] ?? pendingAction.toUpperCase()} — Click grid to target
        </div>
      )}
    </div>
  );
};

const BANNER_LABELS: Record<PendingActionMode, string> = {
  throw_decoy:     '🎯 THROW DECOY',
  make_noise:      '📢 MAKE NOISE',
  lay_false_trail: '👣 LAY FALSE TRAIL',
  move:            '🚶 MOVE GHOST',
  scan:            '📡 SCAN ZONE',
  lock:            '🔒 LOCK CELL',
  none:            '',
};
