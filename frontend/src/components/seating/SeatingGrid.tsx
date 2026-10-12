import React, { useState, useMemo } from 'react';
import {
  LogIn,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { RoomGrid, SeatAssignment, Department } from '../../types';
import { BenchCard } from './BenchCard';

interface SeatingGridProps {
  room: RoomGrid;
  deptMap: Map<number, Department>;
  selectedSeatId: number | null;
  swapSourceSeatId: number | null;
  searchMatchSeatId: number | null;
  onSeatClick: (seat: SeatAssignment) => void;
  onDragStart?: (seat: SeatAssignment) => void;
  onDrop?: (targetSeat: SeatAssignment) => void;
}

export const SeatingGrid: React.FC<SeatingGridProps> = ({
  room,
  deptMap,
  selectedSeatId,
  swapSourceSeatId,
  searchMatchSeatId,
  onSeatClick,
  onDragStart,
  onDrop,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Group seats by (row, col)
  const benchMap = useMemo(() => {
    const map = new Map<string, SeatAssignment[]>();
    room.seats.forEach((seat) => {
      const key = `${seat.row}-${seat.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(seat);
    });
    return map;
  }, [room.seats]);

  // Determine row count & col count from seats in this room
  const maxRow = useMemo(() => {
    return room.seats.reduce((max, s) => Math.max(max, s.row), 0) + 1;
  }, [room.seats]);

  const maxCol = useMemo(() => {
    return room.seats.reduce((max, s) => Math.max(max, s.col), 0) + 1;
  }, [room.seats]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(140, z + 15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(70, z - 15));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col min-w-0">
      {/* Zoom and Grid Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">
            Hall Layout &amp; Bench Grid
          </span>
          <span className="text-muted-foreground text-[11px]">
            ({maxRow} Rows &times; {maxCol} Benches/Row)
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-muted/40 border border-border/70 rounded-xl p-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 70}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 text-[11px] font-mono font-bold text-foreground select-none">
            {zoomLevel}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 140}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-border mx-1" />

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Reset Zoom to 100%"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontally scrollable container with zoom transform */}
      <div className="overflow-x-auto overflow-y-visible pb-4 pt-1 px-1">
        <div
          className="transition-transform duration-150 origin-top-left space-y-5 inline-block min-w-full"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {/* Blackboard / Front Banner */}
          <div className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-center shadow-xs flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest uppercase select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            &uarr; FRONT OF HALL &bull; BLACKBOARD &bull; INVIGILATOR DESK &uarr;
          </div>

          {/* Grid with Side Door and Axis Coordinates */}
          <div className="flex gap-4 items-start">
            {/* Side Entrance Door */}
            <div className="flex flex-col items-center justify-center px-2 py-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 select-none flex-shrink-0 self-stretch min-h-[220px]">
              <LogIn className="w-4 h-4 mb-2" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                Hall Entry / Exit Door
              </span>
            </div>

            {/* Main Bench Matrix */}
            <div className="space-y-4">
              {/* Column Numbers Header (C1, C2, C3...) */}
              <div className="flex items-center gap-4 pl-12">
                {Array.from({ length: maxCol }).map((_, cIdx) => (
                  <div
                    key={cIdx}
                    className="text-center font-mono font-bold text-xs text-muted-foreground select-none flex-shrink-0"
                    style={{
                      width: `${Math.max(130, 2 * 76 + 24)}px`, // match BenchCard approximate width
                    }}
                  >
                    Column {cIdx + 1} (C{cIdx + 1})
                  </div>
                ))}
              </div>

              {/* Rows with Benches */}
              {Array.from({ length: maxRow }).map((_, rIdx) => (
                <div key={rIdx} className="flex items-center gap-4">
                  {/* Row Coordinate Label (R1, R2...) */}
                  <div className="w-8 text-right font-mono font-bold text-xs text-muted-foreground select-none flex-shrink-0">
                    R{rIdx + 1}
                  </div>

                  {/* Benches in this Row with at least 16px gap (gap-4 = 16px) */}
                  <div className="flex items-center gap-4">
                    {Array.from({ length: maxCol }).map((_, cIdx) => {
                      const benchKey = `${rIdx}-${cIdx}`;
                      const benchSeats = benchMap.get(benchKey) || [];

                      return (
                        <BenchCard
                          key={cIdx}
                          row={rIdx}
                          col={cIdx}
                          seats={benchSeats}
                          deptMap={deptMap}
                          selectedSeatId={selectedSeatId}
                          swapSourceSeatId={swapSourceSeatId}
                          searchMatchSeatId={searchMatchSeatId}
                          onSeatClick={onSeatClick}
                          onDragStart={onDragStart}
                          onDrop={onDrop}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rear of Hall Banner */}
          <div className="w-full py-2 text-center text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider select-none border-t border-border/80">
            &darr; Back of Examination Hall &darr;
          </div>
        </div>
      </div>
    </div>
  );
};
