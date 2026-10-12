import React, { useState, useEffect } from 'react';
import {
  Building2,
  User,
  Plus,
  Save,
  X,
  Sparkles,
  HelpCircle,
  LayoutGrid,
} from 'lucide-react';
import { Room } from '../../types';
import { NumberStepper } from './NumberStepper';
import { RoomPreview } from './RoomPreview';

interface RoomFormProps {
  initialRoom?: Room | null;
  onSubmit: (data: {
    name: string;
    rows: number;
    columns: number;
    seats_per_bench: number;
    invigilator_name: string | null;
  }) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export const RoomForm: React.FC<RoomFormProps> = ({
  initialRoom,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const isEditing = Boolean(initialRoom);

  const [name, setName] = useState<string>('');
  const [rows, setRows] = useState<number>(8);
  const [columns, setColumns] = useState<number>(5);
  const [seatsPerBench, setSeatsPerBench] = useState<number>(2);
  const [invigilatorName, setInvigilatorName] = useState<string>('');
  const [disabledBenches, setDisabledBenches] = useState<Set<string>>(new Set());

  // Populate fields if initialRoom changes (Edit mode)
  useEffect(() => {
    if (initialRoom) {
      setName(initialRoom.name);
      setRows(initialRoom.rows);
      setColumns(initialRoom.columns);
      setSeatsPerBench(initialRoom.seats_per_bench);
      setInvigilatorName(initialRoom.invigilator_name || '');
      setDisabledBenches(new Set());
    } else {
      setName('');
      setRows(8);
      setColumns(5);
      setSeatsPerBench(2);
      setInvigilatorName('');
      setDisabledBenches(new Set());
    }
  }, [initialRoom]);

  // Clean up disabled benches if rows or columns shrink
  const handleRowsChange = (newRows: number) => {
    setRows(newRows);
    setDisabledBenches((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        const [r] = key.split('-').map(Number);
        if (r < newRows) next.add(key);
      });
      return next;
    });
  };

  const handleColsChange = (newCols: number) => {
    setColumns(newCols);
    setDisabledBenches((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        const [, c] = key.split('-').map(Number);
        if (c < newCols) next.add(key);
      });
      return next;
    });
  };

  const toggleBenchDisabled = (benchKey: string) => {
    setDisabledBenches((prev) => {
      const next = new Set(prev);
      if (next.has(benchKey)) {
        next.delete(benchKey);
      } else {
        next.add(benchKey);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      rows,
      columns,
      seats_per_bench: seatsPerBench,
      invigilator_name: invigilatorName.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-md space-y-6 animate-in fade-in duration-200"
    >
      {/* Form Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {isEditing ? `Edit Examination Hall: ${initialRoom?.name}` : 'Design & Add Examination Hall'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure room grid layout with live visual preview and interactive bench capacity control.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Two-Column Grid: Form Controls on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Room Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
              <span>Room Name / Number</span>
              <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hall A, LH-201, or Audi-1"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Unique identifier for students and staff.
            </p>
          </div>

          {/* Steppers for Rows and Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberStepper
              label="Number of Rows"
              value={rows}
              min={1}
              max={25}
              unit="rows"
              helperText="Length of hall"
              onChange={handleRowsChange}
            />

            <NumberStepper
              label="Benches per Row"
              value={columns}
              min={1}
              max={15}
              unit="cols"
              helperText="Width of hall"
              onChange={handleColsChange}
            />
          </div>

          {/* Seats Per Bench (1, 2 or 3) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground tracking-wide">
                Seats per Bench
              </label>
              <span className="text-[11px] text-muted-foreground">
                Configured bench capacity
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3].map((num) => {
                const isSelected = seatsPerBench === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSeatsPerBench(num)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all select-none ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'border-input bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground font-medium'
                    }`}
                  >
                    <div className="text-sm">{num} {num === 1 ? 'Seat' : 'Seats'}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">
                      {num === 1 ? 'Single Desk' : num === 2 ? 'Standard 2-Seater' : 'Wide 3-Seater'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hall In-Charge (Invigilator) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
              <span>Hall In-Charge (Invigilator Name)</span>
              <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={invigilatorName}
                onChange={(e) => setInvigilatorName(e.target.value)}
                placeholder="e.g. Dr. Ramesh Kumar, Dept of Mathematics"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Appears on the official printed seating charts and attendance sheets.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-3 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Save Examination Hall
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="py-3 px-4 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (7 cols) */}
        <div className="lg:col-span-7 h-full">
          <RoomPreview
            roomName={name}
            rows={rows}
            columns={columns}
            seatsPerBench={seatsPerBench}
            invigilatorName={invigilatorName}
            disabledBenches={disabledBenches}
            onToggleBench={toggleBenchDisabled}
          />
        </div>
      </div>
    </form>
  );
};
