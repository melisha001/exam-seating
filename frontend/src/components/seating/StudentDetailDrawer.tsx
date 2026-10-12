import React from 'react';
import {
  X,
  User,
  GraduationCap,
  BookOpen,
  MapPin,
  ArrowLeftRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { SeatAssignment, Department, RoomGrid } from '../../types';
import { getDeptColor } from '../../lib/utils';

interface StudentDetailDrawerProps {
  seat: SeatAssignment | null;
  room: RoomGrid | null;
  dept?: Department | null;
  onClose: () => void;
  onStartSwap: (seat: SeatAssignment) => void;
}

export const StudentDetailDrawer: React.FC<StudentDetailDrawerProps> = ({
  seat,
  room,
  dept,
  onClose,
  onStartSwap,
}) => {
  if (!seat) return null;

  const colors = getDeptColor(seat.department_id);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
      {/* Drawer Header */}
      <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground leading-tight">
              Candidate Seating Details
            </h3>
            <p className="text-xs text-muted-foreground">
              Official examination desk assignment
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Close drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {seat.is_empty ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-muted/10 space-y-3">
            <span className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground font-bold text-lg">
              &empty;
            </span>
            <h4 className="font-bold text-foreground text-base">Empty Seat Slot</h4>
            <p className="text-xs text-muted-foreground">
              This seat is currently unassigned or deliberately left empty by the non-adjacent interleaving optimizer.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onStartSwap(seat)}
                className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Swap Candidate into This Seat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Candidate Card */}
            <div className={`p-5 rounded-2xl border ${colors.bg} ${colors.border} space-y-3`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                    Candidate Roll Number
                  </span>
                  <div className="text-2xl font-black tracking-tight font-mono text-foreground mt-0.5">
                    {seat.roll_number}
                  </div>
                </div>
                {dept && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${colors.badge}`}>
                    {dept.code}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-current/15 flex items-center gap-2 text-xs font-medium">
                <ShieldCheck className="w-4 h-4 opacity-80" />
                <span>Anti-Malpractice Constraint Verified</span>
              </div>
            </div>

            {/* Department & Exam Subject */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Academic &amp; Course Information
              </h4>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <GraduationCap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Academic Department
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {dept ? `${dept.name} (${dept.code})` : `Department ID #${seat.department_id}`}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Examination Paper / Subject
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {seat.subject || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hall Location */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Physical Desk Location
              </h4>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">
                      Hall &amp; Invigilator
                    </span>
                    <span className="font-bold text-foreground text-sm block">
                      {room?.room_name || 'Examination Hall'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      In-charge: {room?.invigilator_name || 'Assigned Invigilator'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Row</span>
                    <span className="font-extrabold text-foreground font-mono text-sm">
                      Row {seat.row + 1}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Column</span>
                    <span className="font-extrabold text-foreground font-mono text-sm">
                      Col {seat.col + 1}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground block">Bench Slot</span>
                    <span className="font-extrabold text-foreground font-mono text-sm">
                      Seat #{seat.seat_index + 1}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="p-5 border-t border-border bg-muted/10 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            onStartSwap(seat);
            onClose();
          }}
          className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Swap Seat with Another Student
        </button>

        <button
          type="button"
          onClick={onClose}
          className="py-2.5 px-4 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
