import React, { useState } from 'react';
import {
  Building2,
  Users,
  Plus,
  LayoutGrid,
  Sparkles,
  Layers,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Room, Department } from '../types';
import { api } from '../services/api';
import { RoomCard } from './room/RoomCard';
import { RoomForm } from './room/RoomForm';

interface RoomManagerProps {
  rooms: Room[];
  departments: Department[];
  onRefreshData: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  rooms,
  departments,
  onRefreshData,
  showToast,
}) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Departments State
  const [showDeptSection, setShowDeptSection] = useState<boolean>(false);
  const [deptName, setDeptName] = useState<string>('');
  const [deptCode, setDeptCode] = useState<string>('');
  const [isSubmittingDept, setIsSubmittingDept] = useState<boolean>(false);

  // Calculate high-level stats
  const totalBenches = rooms.reduce((acc, r) => acc + r.rows * r.columns, 0);
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);

  // Handle Create or Update Room
  const handleSaveRoom = async (data: {
    name: string;
    rows: number;
    columns: number;
    seats_per_bench: number;
    invigilator_name: string | null;
    invigilator2_name?: string | null;
    invigilator1_subject?: string | null;
    invigilator2_subject?: string | null;
    bench_config?: string | null;
  }) => {
    try {
      setIsSubmitting(true);
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, data);
        showToast(`Hall '${data.name}' updated successfully!`, 'success');
        setEditingRoom(null);
      } else {
        await api.createRoom(data);
        showToast(`Hall '${data.name}' added successfully!`, 'success');
        setShowAddForm(false);
      }
      await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save examination hall', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This will remove it from future exam plans.`)) {
      return;
    }
    try {
      await api.deleteRoom(id);
      showToast(`Hall '${name}' deleted`, 'info');
      await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete room', 'error');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) return;
    try {
      setIsSubmittingDept(true);
      await api.createDepartment({
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
      });
      showToast(`Department '${deptCode}' registered!`, 'success');
      setDeptName('');
      setDeptCode('');
      await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to register department', 'error');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Stats Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
              Examination Halls &amp; Venues
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {rooms.length} Halls
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure seating layouts, test dimensions in real-time preview, and mark damaged benches.
          </p>
        </div>

        {/* Global Metric Badges */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-muted/40 border border-border/80 text-center sm:text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Total Benches
            </span>
            <span className="text-base font-extrabold text-foreground">
              {totalBenches}
            </span>
          </div>

          <div className="flex-1 sm:flex-none px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 text-center sm:text-right">
            <span className="text-[10px] uppercase font-bold text-primary block">
              Total Seat Capacity
            </span>
            <span className="text-base font-extrabold text-primary">
              {totalCapacity}
            </span>
          </div>

          {!showAddForm && !editingRoom && (
            <button
              onClick={() => {
                setEditingRoom(null);
                setShowAddForm(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Hall
            </button>
          )}
        </div>
      </div>

      {/* Inline Room Form (Shown when Adding or Editing) */}
      {(showAddForm || editingRoom) && (
        <RoomForm
          initialRoom={editingRoom}
          onSubmit={handleSaveRoom}
          onCancel={() => {
            setShowAddForm(false);
            setEditingRoom(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Saved Room Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Configured Examination Halls
          </h3>
          <span className="text-xs text-muted-foreground">
            Click &quot;Modify Layout&quot; on any hall to adjust its rows, columns, or benches.
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
            <h4 className="font-bold text-foreground text-base">No Examination Halls Configured</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add your first examination hall with custom bench dimensions to begin assigning seats.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
            >
              Add First Hall
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={(r) => {
                  setShowAddForm(false);
                  setEditingRoom(r);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={handleDeleteRoom}
              />
            ))}
          </div>
        )}
      </div>

      {/* Academic Departments Section (Collapsible Accordion) */}
      <div className="border border-border rounded-3xl bg-card overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowDeptSection(!showDeptSection)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-base text-foreground">
                Academic Departments ({departments.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Manage branch codes (e.g. CSE, ECE, MECH) used by the interleaving engine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{showDeptSection ? 'Hide' : 'Manage Departments'}</span>
            {showDeptSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showDeptSection && (
          <div className="p-6 border-t border-border space-y-6 animate-in slide-in-from-top-2 duration-200">
            {/* Quick Register Department Form */}
            <form onSubmit={handleCreateDept} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. AI-DS"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground uppercase focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Full Department Name
                </label>
                <input
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSubmittingDept}
                  className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmittingDept ? 'Registering...' : 'Register Department'}
                </button>
              </div>
            </form>

            {/* Existing Departments Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-foreground text-sm">
                      {dept.code}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      #{dept.id}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate mt-1">
                    {dept.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
