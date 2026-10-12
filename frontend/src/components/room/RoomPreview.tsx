import React from 'react';
import { LogIn, Wrench, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface RoomPreviewProps {
  roomName: string;
  rows: number;
  columns: number;
  seatsPerBench: number;
  invigilatorName: string;
  disabledBenches: Set<string>; // Set of "row-col" strings
  onToggleBench: (benchKey: string) => void;
}

export const RoomPreview: React.FC<RoomPreviewProps> = ({
  roomName,
  rows,
  columns,
  seatsPerBench,
  invigilatorName,
  disabledBenches,
  onToggleBench,
}) => {
  const totalBenches = rows * columns;
  const brokenCount = disabledBenches.size;
  const activeBenches = Math.max(0, totalBenches - brokenCount);
  const totalSeats = activeBenches * seatsPerBench;
  const rawTheoreticalCapacity = totalBenches * seatsPerBench;

  return (
    <div className="flex flex-col h-full bg-card/60 backdrop-blur-xs border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header Info & Capacity Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-foreground text-base tracking-tight">
              {roomName.trim() || 'Untitled Hall'}
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Live Preview
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invigilator: <span className="text-foreground font-medium">{invigilatorName.trim() || 'Not assigned'}</span>
          </p>
        </div>

        {/* Capacity Chips */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Benches
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {activeBenches} <span className="text-xs font-normal text-muted-foreground">/ {totalBenches}</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Usable Capacity
            </div>
            <div className="text-sm font-extrabold text-primary flex items-baseline justify-end gap-1">
              <span>{totalSeats}</span>
              <span className="text-[10px] font-medium text-muted-foreground">seats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notice on Broken Benches */}
      {brokenCount > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Wrench className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            {brokenCount} bench(es) marked as disabled (-{brokenCount * seatsPerBench} seats).
          </span>
          <span className="text-[10px] opacity-80">Click a bench to re-enable</span>
        </div>
      )}

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
                    const isBroken = disabledBenches.has(benchKey);

                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => onToggleBench(benchKey)}
                        title={
                          isBroken
                            ? `Bench R${rIdx + 1}-C${cIdx + 1} (Broken/Disabled) - Click to restore`
                            : `Bench R${rIdx + 1}-C${cIdx + 1} (${seatsPerBench} seats) - Click to disable`
                        }
                        className={`group relative rounded-lg p-1.5 transition-all flex flex-col items-center justify-center gap-1 border shadow-2xs select-none ${
                          isBroken
                            ? 'bg-rose-500/10 border-rose-400/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                            : 'bg-card border-border hover:border-primary hover:shadow-sm text-foreground active:scale-95'
                        }`}
                        style={{
                          width: `${Math.max(48, seatsPerBench * 24 + 14)}px`,
                          height: '42px',
                        }}
                      >
                        {/* Bench Seat Segments */}
                        {isBroken ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold">
                            <Wrench className="w-3 h-3 text-rose-500" />
                            <span className="text-[9px]">BROKEN</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 w-full justify-center">
                              {Array.from({ length: seatsPerBench }).map((_, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="h-4 flex-1 rounded-sm bg-muted/80 border border-border/80 group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors flex items-center justify-center text-[8px] font-bold text-muted-foreground group-hover:text-primary"
                                >
                                  {sIdx + 1}
                                </div>
                              ))}
                            </div>
                            <span className="text-[8px] font-mono font-medium text-muted-foreground group-hover:text-foreground">
                              C{cIdx + 1}
                            </span>
                          </>
                        )}
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
          Back of Hall &bull; Click any bench above to toggle &quot;broken / disabled&quot;
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-card border border-border" />
            <span>Usable Bench ({seatsPerBench} seats)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-xs bg-rose-500/20 border border-rose-400" />
            <span>Disabled / Broken Bench (0 seats)</span>
          </div>
        </div>
        <div className="text-[10px]">
          {rows} Rows &times; {columns} Columns = {totalBenches} benches
        </div>
      </div>
    </div>
  );
};
