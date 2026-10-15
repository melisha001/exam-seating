import React from 'react';
import { SeatAssignment, Department } from '../../types';
import { SeatCell } from './SeatCell';

interface BenchCardProps {
  row: number;
  col: number;
  seats: SeatAssignment[];
  deptMap: Map<number, Department>;
  selectedSeatId: number | null;
  swapSourceSeatId: number | null;
  searchMatchSeatId: number | null;
  onSeatClick: (seat: SeatAssignment) => void;
  onDragStart?: (seat: SeatAssignment) => void;
  onDrop?: (targetSeat: SeatAssignment) => void;
}

export const BenchCard: React.FC<BenchCardProps> = ({
  row,
  col,
  seats,
  deptMap,
  selectedSeatId,
  swapSourceSeatId,
  searchMatchSeatId,
  onSeatClick,
  onDragStart,
  onDrop,
}) => {
  // Sort seats by seat_index (0, 1, 2)
  const sortedSeats = React.useMemo(() => {
    return [...seats].sort((a, b) => a.seat_index - b.seat_index);
  }, [seats]);

  const seatsCount = sortedSeats.length;

  return (
    <div
      className="bg-card border border-border/80 hover:border-primary/40 rounded-2xl p-2.5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-1.5 flex-shrink-0"
      style={{
        // Fixed comfortable width depending on bench capacity
        width: `${Math.max(130, seatsCount * 76 + 24)}px`,
        minHeight: '88px',
      }}
    >
      {/* Bench Header Label */}
      <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-muted-foreground select-none">
        <span className="font-mono">
          R{row + 1} &bull; C{col + 1}
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 uppercase">
          {seatsCount}S
        </span>
      </div>

      {/* Seat Slots Container */}
      <div className="flex items-center gap-1.5 w-full">
        {sortedSeats.map((seat) => (
          <SeatCell
            key={seat.id}
            seat={seat}
            dept={seat.department_id ? deptMap.get(seat.department_id) : null}
            isSelectedForDrawer={selectedSeatId === seat.id}
            isSelectedForSwap={swapSourceSeatId === seat.id}
            isSearchMatch={searchMatchSeatId === seat.id}
            onClick={onSeatClick}
            onDragStart={onDragStart}
            onDrop={onDrop}
          />
        ))}
      </div>
    </div>
  );
};
