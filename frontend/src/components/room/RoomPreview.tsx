import React from 'react';
import { LogIn, Sparkles, Lock } from 'lucide-react';

interface RoomPreviewProps {
  roomName: string;
  rows: number;
  columns: number;
  seatsPerBench: number;
  invigilatorName: string;
  benchConfig?: Record<string, number>; // maps "row-col" -> 2 or 3
  onToggleBench?: (benchKey: string) => void;
  isLocked?: boolean;
  targetCount?: number;
}

export const RoomPreview: React.FC<RoomPreviewProps> = ({
  roomName,
  rows,
  columns,
  seatsPerBench,
  invigilatorName,
  benchConfig = {},
  onToggleBench,
  isLocked = false,
  targetCount,
}) => {
  const totalBenches = rows * columns;

  // Calculate total seats based on benchConfig
  let totalSeats = 0;
  let count1Seaters = 0;
  let count2Seaters = 0;
  let count3Seaters = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const key = `${r}-${c}`;
      const seats = benchConfig[key] ?? seatsPerBench ?? 2;
      totalSeats += seats;
      if (seats === 1) count1Seaters++;
      else if (seats === 3) count3Seaters++;
      else count2Seaters++;
    }
  }

  const isMatched = targetCount !== undefined && totalSeats === targetCount;

  return (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur-xs border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Prominent Lock Banner if Allocation Exists */}
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300 font-semibold animate-in fade-in">
          <Lock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Layout locked — an allocation exists. Reset allocation in Seating Grid to edit.</span>
        </div>
      )}

      {/* Header Info & Capacity Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-foreground text-base tracking-tight">
              {roomName.trim() || 'Untitled Hall'}
            </h4>
            {isLocked ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                Live Layout Tuner
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invigilator: <span className="text-foreground font-medium">{invigilatorName.trim() || 'Not assigned'}</span>
          </p>
        </div>

        {/* Capacity Chips */}
        <div className="flex items-center gap-2">
          {targetCount !== undefined && (
            <div className={`px-3 py-1.5 rounded-xl border text-right ${
              isMatched
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">
                Target Students
              </div>
              <div className="text-sm font-extrabold flex items-baseline justify-end gap-1">
                <span>{targetCount}</span>
                <span className="text-[10px] font-medium">{isMatched ? 'Matched' : `(${totalSeats - targetCount > 0 ? '+' : ''}${totalSeats - targetCount})`}</span>
              </div>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Benches
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {totalBenches} <span className="text-xs font-normal text-muted-foreground">({count1Seaters} 1S / {count2Seaters} 2S / {count3Seaters} 3S)</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Hall Capacity
            </div>
            <div className="text-sm font-extrabold text-primary flex items-baseline justify-end gap-1">
              <span>{totalSeats}</span>
              <span className="text-[10px] font-medium text-muted-foreground">seats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Physical Hall Layout Visualizer */}
      <div className="flex-1 min-h-[320px] flex flex-col border border-border/80 rounded-xl bg-muted/20 p-3 sm:p-4 relative overflow-hidden">
        {/* Blackboard / Front Banner */}
        <div className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-center shadow-xs flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-widest uppercase mb-3 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Blackboard / Podium (Front of Hall)
        </div>

        {/* Main Floor Plan with Door Marker */}
        <div className="flex-1 flex gap-3 items-stretch relative overflow-auto pb-2">
          {/* Side Door Marker */}
          <div className="flex flex-col items-center justify-center px-1.5 py-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 select-none flex-shrink-0">
            <LogIn className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
              Entry Door
            </span>
          </div>

          {/* Bench Grid */}
          <div className="flex-1 flex flex-col justify-center gap-2.5 overflow-x-auto min-w-0">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <div key={rIdx} className="flex items-center gap-2 min-w-max">
                {/* Row Indicator */}
                <div className="w-6 text-[10px] font-bold text-muted-foreground text-center select-none">
                  R{rIdx + 1}
                </div>

                {/* Benches in Row */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: columns }).map((_, cIdx) => {
                    const benchKey = `${rIdx}-${cIdx}`;
                    const seats = benchConfig[benchKey] ?? seatsPerBench ?? 2;
                    const is1Seater = seats === 1;
                    const is3Seater = seats === 3;
                    const nextSeats = is1Seater ? 2 : is3Seater ? 1 : 3;

                    return (
                      <button
                        key={cIdx}
                        type="button"
                        disabled={isLocked || !onToggleBench}
                        onClick={() => onToggleBench && onToggleBench(benchKey)}
                        title={
                          isLocked
                            ? `Bench R${rIdx + 1}-C${cIdx + 1}: ${seats}-seater (Locked)`
                            : `Bench R${rIdx + 1}-C${cIdx + 1}: ${seats}-seater (Click to cycle to ${nextSeats}-seater)`
                        }
                        className={`group relative rounded-lg p-1.5 transition-all flex flex-col items-center justify-center gap-1 border shadow-2xs select-none ${
                          isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer active:scale-95'
                        } ${
                          is1Seater
                            ? 'bg-teal-500/10 border-teal-500/40 text-teal-700 dark:text-teal-300 hover:border-teal-500'
                            : is3Seater
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500'
                            : 'bg-card border-border hover:border-primary text-foreground'
                        }`}
                        style={{
                          width: `${Math.max(54, seats * 24 + 14)}px`,
                          height: '42px',
                        }}
                      >
                        {/* Bench Seat Segments */}
                        <div className="flex items-center gap-1 w-full justify-center">
                          {Array.from({ length: seats }).map((_, sIdx) => (
                            <div
                              key={sIdx}
                              className={`h-4 flex-1 rounded-sm border transition-colors flex items-center justify-center text-[8px] font-bold ${
                                is1Seater
                                  ? 'bg-teal-500/20 border-teal-500/30 text-teal-700 dark:text-teal-300'
                                  : is3Seater
                                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-muted/80 border-border/80 text-muted-foreground group-hover:text-primary group-hover:bg-primary/20'
                              }`}
                            >
                              {String.fromCharCode(65 + sIdx)}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between w-full px-0.5">
                          <span className="text-[8px] font-mono font-medium text-muted-foreground">
                            C{cIdx + 1}
                          </span>
                          <span className={`text-[7px] font-bold uppercase px-0.5 rounded ${
                            is1Seater
                              ? 'bg-teal-500/30 text-teal-700 dark:text-teal-200'
                              : is3Seater
                              ? 'bg-indigo-500/30 text-indigo-700 dark:text-indigo-200'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {seats}S
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rear of Hall */}
        <div className="text-center text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/60">
          {isLocked
            ? 'Back of Hall • Layout locked — an allocation exists. Reset allocation in Seating Grid to edit.'
            : 'Back of Hall • Click any bench to cycle between 1-seater, 2-seater and 3-seater.'}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-teal-500/20 border border-teal-400" />
            <span>1-Seater Bench</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-card border border-border" />
            <span>2-Seater Bench</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-indigo-500/20 border border-indigo-400" />
            <span>3-Seater Bench</span>
          </div>
        </div>
        <div className="text-[10px]">
          {rows} Rows &times; {columns} Columns = {totalBenches} benches
        </div>
      </div>
    </div>
  );
};

