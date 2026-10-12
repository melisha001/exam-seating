import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Search,
  ArrowLeftRight,
  User,
  Building2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';
import { PlanDetail, SeatAssignment, RoomGrid, Department } from '../types';
import { getDeptColor } from '../lib/utils';
import { api } from '../services/api';
import { RoomSelector } from './seating/RoomSelector';
import { SeatingGrid } from './seating/SeatingGrid';
import { StudentDetailDrawer } from './seating/StudentDetailDrawer';
import { BranchView } from './seating/BranchView';

interface SeatingViewProps {
  plan: PlanDetail | null;
  departments: Department[];
  onRefreshPlan: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SeatingView: React.FC<SeatingViewProps> = ({
  plan,
  departments,
  onRefreshPlan,
  showToast,
}) => {
  const [viewMode, setViewMode] = useState<'halls' | 'branches'>('halls');
  const [activeRoomId, setActiveRoomId] = useState<number>(() => {
    return plan?.rooms[0]?.room_id || 0;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [drawerSeat, setDrawerSeat] = useState<SeatAssignment | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<SeatAssignment | null>(null);
  const [draggedSeat, setDraggedSeat] = useState<SeatAssignment | null>(null);
  const [showWarnings, setShowWarnings] = useState<boolean>(true);

  // If activeRoomId is not in rooms, fallback to first room
  const activeRoom: RoomGrid | null = useMemo(() => {
    if (!plan || plan.rooms.length === 0) return null;
    return plan.rooms.find((r) => r.room_id === activeRoomId) || plan.rooms[0];
  }, [plan, activeRoomId]);

  // Dept map for O(1) lookup
  const deptMap = useMemo(() => {
    const map = new Map<number, Department>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  // Search candidate roll number across all rooms
  const matchingSeatPos = useMemo(() => {
    if (!plan || !searchQuery.trim()) return null;
    const query = searchQuery.trim().toLowerCase();
    for (const room of plan.rooms) {
      const found = room.seats.find(
        (s) => s.roll_number && s.roll_number.toLowerCase().includes(query)
      );
      if (found) {
        return { roomId: room.room_id, seatId: found.id, seat: found };
      }
    }
    return null;
  }, [plan, searchQuery]);

  // Jump to searched seat in another room
  const handleJumpToSearch = () => {
    if (matchingSeatPos) {
      setActiveRoomId(matchingSeatPos.roomId);
      setDrawerSeat(matchingSeatPos.seat);
      showToast(`Located in ${plan?.rooms.find((r) => r.room_id === matchingSeatPos.roomId)?.room_name}`, 'info');
    }
  };

  // Execute swap
  const executeSwap = async (seatA: SeatAssignment, seatB: SeatAssignment) => {
    if (!plan || seatA.id === seatB.id) {
      setSwapSourceSeat(null);
      return;
    }
    try {
      await api.swapSeats(plan.plan_id, {
        seat_id_a: seatA.id,
        seat_id_b: seatB.id,
      });
      showToast(
        `Swapped: ${seatA.roll_number || 'Empty'} ⇄ ${seatB.roll_number || 'Empty'}!`,
        'success'
      );
      setSwapSourceSeat(null);
      await onRefreshPlan();
    } catch (err: any) {
      showToast(err.message || 'Swap violates anti-malpractice rules!', 'error');
    }
  };

  // Handle seat click
  const handleSeatClick = (seat: SeatAssignment) => {
    if (swapSourceSeat) {
      executeSwap(swapSourceSeat, seat);
    } else {
      setDrawerSeat(seat);
    }
  };

  // Quick window print for clean one-page room chart
  const handlePrintRoom = () => {
    window.print();
  };

  if (!plan || plan.rooms.length === 0 || !activeRoom) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-card border border-border rounded-3xl shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">No Active Seating Plan</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Please run the Seating Wizard or pick an examination session to view its allocated seating arrangements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar: Department Color Legend & Search & Quick Export Actions */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Candidate Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate roll number..."
              className="w-full pl-9 pr-24 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
            {matchingSeatPos && (
              <button
                type="button"
                onClick={handleJumpToSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Jump &rarr;
              </button>
            )}
          </div>

          {/* Export & Print Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrintRoom}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
              title="Print clean layout for this room"
            >
              <Printer className="w-4 h-4 text-blue-500" />
              Print Room Chart
            </button>

            <a
              href={api.getPdfExportUrl(plan.plan_id)}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              Full PDF
            </a>

            <a
              href={api.getExcelExportUrl(plan.plan_id)}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Full Excel
            </a>

            {swapSourceSeat && (
              <button
                type="button"
                onClick={() => setSwapSourceSeat(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/20"
              >
                Cancel Swap Mode
              </button>
            )}
          </div>
        </div>

        {/* Department Color Legend */}
        <div className="pt-3 border-t border-border/60 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Department Legend:
          </span>
          {departments.map((d) => {
            const colors = getDeptColor(d.id);
            return (
              <div
                key={d.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${colors.bg} ${colors.border} ${colors.text}`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colors.hex }}
                />
                <span>{d.code}</span>
                <span className="font-normal opacity-75 hidden sm:inline">&bull; {d.name}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-border text-muted-foreground text-xs">
            <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span>Empty Slot</span>
          </div>
        </div>
      </div>

      {/* Warnings Banner (Collapsible) */}
      {plan.warnings && plan.warnings.length > 0 && showWarnings && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Seating Arrangement Warnings ({plan.warnings.length})
            </span>
            <button
              type="button"
              onClick={() => setShowWarnings(false)}
              className="text-muted-foreground hover:text-foreground text-[11px]"
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
            {plan.warnings.map((w, idx) => (
              <li key={idx} className={w.startsWith('ERROR') ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Swap Mode Notice */}
      {swapSourceSeat && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-medium animate-pulse">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-600" />
            <span>
              <strong>Swap Mode Active:</strong> Selected candidate <strong>{swapSourceSeat.roll_number || 'Empty'}</strong>. Click any target seat on the grid to validate and exchange.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSwapSourceSeat(null)}
            className="text-[11px] underline font-bold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* View Switcher Tabs (Hall Layout vs Branch View) */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('halls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              viewMode === 'halls'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Hall View ({plan.rooms.length} Halls)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('branches')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              viewMode === 'branches'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Layers className="w-4 h-4" />
            Branch-Wise Allocation View
          </button>
        </div>

        <div className="text-xs text-muted-foreground font-medium hidden sm:block">
          Plan #{plan.plan_id} &bull; {plan.total_assigned} Total Seated
        </div>
      </div>

      {viewMode === 'branches' ? (
        <BranchView planId={plan.plan_id} showToast={showToast} />
      ) : (
        <>
          {/* Main Two-Column Layout: Room Selector Sidebar (Left) & Room Seating View (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Room Selector (3 cols on desktop) */}
            <div className="lg:col-span-3 lg:sticky lg:top-20">
              <RoomSelector
                rooms={plan.rooms}
                activeRoomId={activeRoom.room_id}
                onSelectRoom={(rId) => {
                  setActiveRoomId(rId);
                  setDrawerSeat(null);
                }}
              />
            </div>

        {/* Right Column: Room Header & Seating Grid (9 cols on desktop) */}
        <div className="lg:col-span-9 space-y-5 min-w-0">
          {/* Room Header Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    {activeRoom.room_name}
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    {activeRoom.utilization_pct}% Utilized
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Hall In-Charge: <strong className="text-foreground">{activeRoom.invigilator_name || 'Unassigned'}</strong>
                </p>
              </div>

              {/* Utilization Bar */}
              <div className="w-full sm:w-56 space-y-1.5 bg-muted/30 p-3 rounded-2xl border border-border/60">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Candidates Seated:</span>
                  <span className="font-extrabold text-foreground">{activeRoom.assigned} / {activeRoom.capacity}</span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, activeRoom.utilization_pct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Seating Grid */}
          <SeatingGrid
            room={activeRoom}
            deptMap={deptMap}
            selectedSeatId={drawerSeat?.id || null}
            swapSourceSeatId={swapSourceSeat?.id || null}
            searchMatchSeatId={matchingSeatPos?.roomId === activeRoom.room_id ? matchingSeatPos.seatId : null}
            onSeatClick={handleSeatClick}
            onDragStart={(seat) => setDraggedSeat(seat)}
            onDrop={(targetSeat) => {
              if (draggedSeat && draggedSeat.id !== targetSeat.id) {
                executeSwap(draggedSeat, targetSeat);
                setDraggedSeat(null);
              }
            }}
          />
        </div>
      </div>

          {/* Side Detail Drawer for Clicked Seat */}
          <StudentDetailDrawer
            seat={drawerSeat}
            room={activeRoom}
            dept={drawerSeat?.department_id ? deptMap.get(drawerSeat.department_id) : null}
            onClose={() => setDrawerSeat(null)}
            onStartSwap={(seat) => {
              setSwapSourceSeat(seat);
              showToast(`Seat selected for swap. Click any target seat on the grid.`, 'info');
            }}
          />
        </>
      )}
    </div>
  );
};
