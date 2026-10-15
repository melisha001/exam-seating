import React, { useState, useMemo } from 'react';
import {
  LogIn,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { RoomGrid, SeatAssignment, Department } from '../../types';
import { BenchCard } from './BenchCard';
import { validateGrid } from '../../lib/validation';
import { getSeaterBreakdown } from '../../lib/utils';

interface SeatingGridProps {
  room: RoomGrid;
  allRooms?: RoomGrid[];
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
  allRooms,
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

  const totalBenches = maxRow * maxCol;
  const breakdown = room.seater_breakdown || getSeaterBreakdown({
    rows: maxRow,
    columns: maxCol,
    seats_per_bench: 2,
    seater_breakdown: room.seater_breakdown,
  });

  const handleZoomIn = () => setZoomLevel((z) => Math.min(140, z + 15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(70, z - 15));
  const handleResetZoom = () => setZoomLevel(100);

  // Calculate department and medium distribution for this room
  const roomDeptCounts = useMemo(() => {
    const counts = new Map<string, { dept: Department | undefined; medium: string; count: number }>();
    room.seats.forEach((s) => {
      if (s.department_id) {
        const med = s.medium || 'EN';
        const key = `${s.department_id}-${med}`;
        if (!counts.has(key)) {
          counts.set(key, { dept: deptMap.get(s.department_id), medium: med, count: 0 });
        }
        counts.get(key)!.count += 1;
      }
    });
    return Array.from(counts.values());
  }, [room.seats, deptMap]);

  // Validation report for the current room grid
  const validation = useMemo(() => {
    return validateGrid(room, false, allRooms);
  }, [room, allRooms]);

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col min-w-0">
      {/* Red Warning Banner for Violations */}
      {!validation.isValid && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>Seating Layout Violations ({validation.violations.length})</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-rose-900/90 dark:text-rose-200/90 font-mono text-[11px]">
            {validation.violations.map((v, idx) => (
              <li key={idx}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hall Seater Info Chips & Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Header chips: total benches, seater breakdown, capacity, occupancy % */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-muted border border-border text-foreground">
            {totalBenches} Benches
          </span>
          {breakdown && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-muted border border-border text-foreground font-mono">
              {breakdown}
            </span>
          )}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary">
            {room.assigned}/{room.capacity} Seats
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
            room.utilization_pct === 100
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}>
            {room.utilization_pct}% Occupancy
          </span>

          {/* Color-coded branch chips with medium in hall header */}
          <div className="flex items-center gap-1.5 ml-2 flex-wrap">
            {roomDeptCounts.map(({ dept, medium, count }, idx) => {
              if (!dept) return null;
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-border/80 bg-muted/60 text-foreground"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: `hsl(${((dept.id * 53) % 360)}, 70%, 50%)` }}
                  />
                  <span>{dept.code}</span>
                  <span className={`px-1 py-0.2 rounded text-[8px] uppercase ${
                    medium === 'TA' ? 'bg-amber-500/20 text-amber-600' : 'bg-sky-500/20 text-sky-600'
                  }`}>
                    {medium}
                  </span>
                  <span className="font-mono">: {count}</span>
                </span>
              );
            })}
          </div>
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

      {/* Real Validation Checklist */}
      <div className="mt-2 pt-4 border-t border-border/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="font-bold text-xs text-foreground uppercase tracking-wider">
              Hall Allocation Integrity Checklist
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              validation.isValid
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {validation.isValid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                All 6 Integrity Checks Passed
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                {validation.violations.length} Violation{validation.violations.length > 1 ? 's' : ''} Detected
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.fixedLayoutUnchanged ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">1. Fixed Layouts Unchanged</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.noUnexpectedEmptySeats ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">2. No Unexpected Empty Seats</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.noLeftRightConflicts ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">3. Horizontal Anti-Copying</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.noDiagonalConflicts ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">4. Diagonal Anti-Copying</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.allStudentsUnique ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">5. Candidate Integrity (Unique)</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60">
            {validation.checklist.equalOccupancy ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            )}
            <span className="text-foreground font-medium">6. Equal Occupancy (&le; 5% diff)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
