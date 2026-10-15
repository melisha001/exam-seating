import React from 'react';
import { SeatAssignment, Department } from '../../types';
import { getDeptColor } from '../../lib/utils';

interface SeatCellProps {
  seat: SeatAssignment;
  dept?: Department | null;
  isSelectedForDrawer?: boolean;
  isSelectedForSwap?: boolean;
  isSearchMatch?: boolean;
  onClick: (seat: SeatAssignment) => void;
  onDragStart?: (seat: SeatAssignment) => void;
  onDrop?: (targetSeat: SeatAssignment) => void;
}

export const SeatCell: React.FC<SeatCellProps> = ({
  seat,
  dept,
  isSelectedForDrawer = false,
  isSelectedForSwap = false,
  isSearchMatch = false,
  onClick,
  onDragStart,
  onDrop,
}) => {
  // Extract last 3-4 digits of roll number for clean uncluttered display
  const shortRoll = React.useMemo(() => {
    if (!seat.roll_number) return '';
    const roll = seat.roll_number.trim();
    // If alphanumeric like 21CSE045, extract trailing digits or last 4 chars
    const match = roll.match(/\d+$/);
    if (match) {
      const digits = match[0];
      return digits.length > 4 ? digits.slice(-4) : digits;
    }
    return roll.length > 4 ? roll.slice(-4) : roll;
  }, [seat.roll_number]);

  const colors = getDeptColor(seat.department_id);

  const posLetter = String.fromCharCode(65 + seat.seat_index);
  const benchNum = seat.row * 10 + seat.col + 1; // fallback
  const labelDisplay = seat.seat_label || `${posLetter}${benchNum}`;

  if (seat.is_empty) {
    return (
      <div
        onClick={() => onClick(seat)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop && onDrop(seat)}
        title={`Seat ${labelDisplay} (Unused seat)`}
        className={`relative flex-1 min-w-[58px] h-14 rounded-xl border border-dashed border-border/80 bg-muted/15 hover:bg-muted/30 hover:border-muted-foreground/40 transition-all flex flex-col items-center justify-center p-1.5 cursor-pointer select-none ${
          isSelectedForSwap ? 'ring-2 ring-primary border-solid bg-primary/10' : ''
        }`}
      >
        <span className="text-[10px] font-semibold text-muted-foreground/60 tracking-wider uppercase">
          Unused
        </span>
        <span className="text-[9px] text-muted-foreground/70 font-mono font-bold mt-0.5">
          {labelDisplay}
        </span>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart && onDragStart(seat)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop && onDrop(seat)}
      onClick={() => onClick(seat)}
      title={`${labelDisplay}: ${seat.roll_number} (${dept?.code || ''}) - ${seat.subject || ''}\nClick for full details`}
      className={`group relative flex-1 min-w-[62px] h-14 rounded-xl border p-1.5 flex flex-col justify-between cursor-pointer transition-all select-none shadow-2xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
        colors.bg
      } ${colors.border} ${colors.text} ${
        isSelectedForDrawer ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background scale-[1.03] shadow-md' : ''
      } ${isSelectedForSwap ? 'ring-2 ring-amber-500 scale-[1.03]' : ''} ${
        isSearchMatch ? 'ring-3 ring-amber-500 shadow-lg animate-bounce' : ''
      }`}
    >
      {/* Top Bar: Dept Tag, Medium Tag & Seat Label (A1, B1, etc.) */}
      <div className="flex items-center justify-between text-[10px] font-bold leading-none">
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${colors.badge}`}>
            {dept?.code || 'DEP'}
          </span>
          <span className={`px-1 py-0.2 rounded text-[8px] font-extrabold uppercase ${
            seat.medium === 'TA'
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              : 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30'
          }`}>
            {seat.medium || 'EN'}
          </span>
        </div>
        <span className="text-[9px] font-bold font-mono opacity-80">
          {labelDisplay}
        </span>
      </div>

      {/* Main Display: Roll Number Suffix & Arrear Indicator */}
      <div className="text-center flex items-center justify-center gap-1">
        <span className="font-extrabold text-xs tracking-tight font-mono">
          {shortRoll}
        </span>
        {seat.is_arrear && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Arrear Student" />
        )}
      </div>

      {/* Lightweight Hover Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
        <div className="bg-popover/95 backdrop-blur-md text-popover-foreground border border-border text-[11px] rounded-xl px-2.5 py-1.5 shadow-xl whitespace-nowrap font-sans font-medium space-y-0.5">
          <div className="font-bold flex items-center gap-1.5 text-foreground">
            <span>{seat.roll_number}</span>
            <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">
              {dept?.code} {seat.medium || 'EN'}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
            {seat.subject}
          </div>
        </div>
      </div>
    </div>
  );
};
