import React from 'react';
import { Building2, User, Edit3, Trash2, Users, LayoutGrid } from 'lucide-react';
import { Room } from '../../types';

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (id: number, name: string) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onEdit, onDelete }) => {
  const totalBenches = room.rows * room.columns;

  return (
    <div className="group relative bg-card border border-border hover:border-primary/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
      {/* Header with Title & Action Buttons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-base text-foreground tracking-tight">
              {room.name}
            </h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-primary/70" />
              {room.invigilator_name || 'No Invigilator Assigned'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(room)}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title={`Edit ${room.name}`}
            aria-label={`Edit ${room.name}`}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(room.id, room.name)}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={`Delete ${room.name}`}
            aria-label={`Delete ${room.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
        <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-center">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            Grid
          </span>
          <span className="font-extrabold text-foreground text-xs mt-0.5 block">
            {room.rows}R &times; {room.columns}C
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-center">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            Bench Type
          </span>
          <span className="font-extrabold text-foreground text-xs mt-0.5 block">
            {room.seats_per_bench} {room.seats_per_bench === 1 ? 'seat' : 'seats'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-center">
          <span className="text-[10px] uppercase font-bold text-primary block">
            Capacity
          </span>
          <span className="font-extrabold text-primary text-xs mt-0.5 block">
            {room.capacity} seats
          </span>
        </div>
      </div>

      {/* Footer Pill */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <LayoutGrid className="w-3.5 h-3.5" />
          {totalBenches} benches total
        </span>
        <button
          type="button"
          onClick={() => onEdit(room)}
          className="text-primary font-semibold hover:underline text-xs"
        >
          Modify Layout &rarr;
        </button>
      </div>
    </div>
  );
};
