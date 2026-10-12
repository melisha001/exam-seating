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

  if (seat.is_empty) {
    return (
      <div
        onClick={() => onClick(seat)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop && onDrop(seat)}
        title={`Seat S${seat.seat_index + 1} (Empty slot)`}
        className={`relative flex-1 min-w-[58px] h-14 rounded-xl border border-dashed border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/40 transition-all flex flex-col items-center justify-center p-1.5 cursor-pointer select-none ${
          isSelectedForSwap ? 'ring-2 ring-primary border-solid bg-primary/10' : ''
        }`}
      >
        <span className="text-[10px] font-semibold text-muted-foreground/50 tracking-wide uppercase">
          Empty
        </span>
        <span className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
          S{seat.seat_index + 1}
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
      title={`${seat.roll_number} (${dept?.code || ''}) - ${seat.subject || ''}\nClick for full details`}
      className={`group relative flex-1 min-w-[62px] h-14 rounded-xl border p-1.5 flex flex-col justify-between cursor-pointer transition-all select-none shadow-2xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
        colors.bg
      } ${colors.border} ${colors.text} ${
        isSelectedForDrawer ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background scale-[1.03] shadow-md' : ''
      } ${isSelectedForSwap ? 'ring-2 ring-amber-500 scale-[1.03]' : ''} ${
        isSearchMatch ? 'ring-3 ring-amber-500 shadow-lg animate-bounce' : ''
      }`}
    >
      {/* Top Bar: Dept Tag & Seat Slot Number */}
      <div className="flex items-center justify-between text-[10px] font-bold leading-none">
        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${colors.badge}`}>
          {dept?.code || 'DEP'}
        </span>
        <span className="text-[9px] opacity-60 font-mono">
          S{seat.seat_index + 1}
        </span>
      </div>

      {/* Main Display: Roll Number Suffix */}
      <div className="text-center">
        <span className="font-extrabold text-xs tracking-tight font-mono">
          {shortRoll}
        </span>
      </div>

      {/* Lightweight Hover Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-40 pointer-events-none">
        <div className="bg-popover/95 backdrop-blur-md text-popover-foreground border border-border text-[11px] rounded-xl px-2.5 py-1.5 shadow-xl whitespace-nowrap font-sans font-medium space-y-0.5">
          <div className="font-bold flex items-center gap-1.5 text-foreground">
            <span>{seat.roll_number}</span>
            <span className="text-[9px] px-1 rounded bg-muted text-muted-foreground">
              {dept?.code}
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
