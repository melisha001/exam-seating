import React from 'react';
import { Building2, User, CheckCircle2, ChevronRight } from 'lucide-react';
import { RoomGrid } from '../../types';

interface RoomSelectorProps {
  rooms: RoomGrid[];
  activeRoomId: number;
  onSelectRoom: (roomId: number) => void;
}

export const RoomSelector: React.FC<RoomSelectorProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Examination Halls ({rooms.length})
        </span>
      </div>

      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-none">
        {rooms.map((room) => {
          const isActive = room.room_id === activeRoomId;
          const isFull = room.assigned >= room.capacity && room.capacity > 0;

          // Utilization Badge styling
          const badgeColor =
            room.utilization_pct >= 90
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : room.utilization_pct >= 60
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

          return (
            <button
              key={room.room_id}
              type="button"
              onClick={() => onSelectRoom(room.room_id)}
              className={`text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 min-w-[200px] lg:min-w-0 flex-shrink-0 select-none ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary'
                  : 'bg-card border-border hover:border-primary/40 hover:bg-muted/40 text-foreground'
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                  <span className="font-bold text-sm tracking-tight truncate">
                    {room.room_name}
                  </span>
                </div>

                <div className={`text-xs flex items-center gap-1 truncate ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{room.invigilator_name || 'No Invigilator'}</span>
                </div>
              </div>

              {/* Utilization Badge & Count */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : badgeColor
                  }`}
                >
                  {room.utilization_pct}%
                </span>
                <span className={`text-[10px] font-mono font-medium ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {room.assigned}/{room.capacity}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
