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
    invigilator2_name?: string | null;
    invigilator1_subject?: string | null;
    invigilator2_subject?: string | null;
    bench_config?: string | null;
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
  const [invigilator2Name, setInvigilator2Name] = useState<string>('');
  const [invigilator1Subject, setInvigilator1Subject] = useState<string>('');
  const [invigilator2Subject, setInvigilator2Subject] = useState<string>('');
  const [benchConfig, setBenchConfig] = useState<Record<string, number>>({});

  // Populate fields if initialRoom changes (Edit mode)
  useEffect(() => {
    if (initialRoom) {
      setName(initialRoom.name);
      setRows(initialRoom.rows);
      setColumns(initialRoom.columns);
      setSeatsPerBench(initialRoom.seats_per_bench);
      setInvigilatorName(initialRoom.invigilator_name || '');
      setInvigilator2Name(initialRoom.invigilator2_name || '');
      setInvigilator1Subject(initialRoom.invigilator1_subject || '');
      setInvigilator2Subject(initialRoom.invigilator2_subject || '');
      if (initialRoom.bench_config) {
        try {
          setBenchConfig(JSON.parse(initialRoom.bench_config));
        } catch {
          setBenchConfig({});
        }
      } else {
        setBenchConfig({});
      }
    } else {
      setName('');
      setRows(8);
      setColumns(5);
      setSeatsPerBench(2);
      setInvigilatorName('');
      setInvigilator2Name('');
      setInvigilator1Subject('');
      setInvigilator2Subject('');
      setBenchConfig({});
    }
  }, [initialRoom]);

  // Clean up benches outside bounds if rows or columns shrink
  const handleRowsChange = (newRows: number) => {
    setRows(newRows);
    setBenchConfig((prev) => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [r] = key.split('-').map(Number);
        if (r < newRows) next[key] = val;
      });
      return next;
    });
  };

  const handleColsChange = (newCols: number) => {
    setColumns(newCols);
    setBenchConfig((prev) => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [, c] = key.split('-').map(Number);
        if (c < newCols) next[key] = val;
      });
      return next;
    });
  };

  const toggleBench = (benchKey: string) => {
    setBenchConfig((prev) => {
      const cur = prev[benchKey] ?? seatsPerBench ?? 2;
      const nextVal = cur === 1 ? 2 : cur === 2 ? 3 : 1;
      return { ...prev, [benchKey]: nextVal };
    });
  };

  const setAllBenches = (type: 1 | 2 | 3) => {
    const nextCfg: Record<string, number> = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        nextCfg[`${r}-${c}`] = type;
      }
    }
    setSeatsPerBench(type);
    setBenchConfig(nextCfg);
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
      invigilator2_name: invigilator2Name.trim() || null,
      invigilator1_subject: invigilator1Subject.trim() || null,
      invigilator2_subject: invigilator2Subject.trim() || null,
      bench_config: Object.keys(benchConfig).length > 0 ? JSON.stringify(benchConfig) : null,
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
              Configure room grid layout with live visual preview and interactive 2-seater/3-seater bench capacity control.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main 2-Column Form Layout: Inputs (Left) & Visualizer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Hall Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground tracking-wide flex items-center justify-between">
              <span>Hall Name / Number *</span>
              <span className="text-[11px] text-muted-foreground font-normal">e.g. Hall A, LH-101</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hall D, Main Auditorium"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all font-medium"
            />
          </div>

          {/* Steppers for Rows & Columns */}
          <div className="grid grid-cols-2 gap-4">
            <NumberStepper
              label="Rows"
              value={rows}
              min={1}
              max={25}
              unit="rows"
              helperText="Front to back"
              onChange={handleRowsChange}
            />

            <NumberStepper
              label="Columns"
              value={columns}
              min={1}
              max={15}
              unit="cols"
              helperText="Width of hall"
              onChange={handleColsChange}
            />
          </div>

          {/* Seater Mode & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground tracking-wide">
                Bench Seater Presets
              </label>
              <span className="text-[11px] text-muted-foreground">
                Or click individual benches in preview
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAllBenches(1)}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all select-none ${
                  seatsPerBench === 1 && Object.values(benchConfig).every((v) => v === 1)
                    ? 'border-teal-500 bg-teal-600 text-white font-bold shadow-xs'
                    : 'border-input bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <div className="text-xs sm:text-sm">All 1-Seaters</div>
                <div className="text-[10px] opacity-75 mt-0.5">Single Desk</div>
              </button>

              <button
                type="button"
                onClick={() => setAllBenches(2)}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all select-none ${
                  seatsPerBench === 2 && Object.values(benchConfig).every((v) => v === 2)
                    ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'border-input bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <div className="text-xs sm:text-sm">All 2-Seaters</div>
                <div className="text-[10px] opacity-75 mt-0.5">Standard Dual Desk</div>
              </button>

              <button
                type="button"
                onClick={() => setAllBenches(3)}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all select-none ${
                  seatsPerBench === 3 && Object.values(benchConfig).every((v) => v === 3)
                    ? 'border-indigo-500 bg-indigo-600 text-white font-bold shadow-xs'
                    : 'border-input bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <div className="text-xs sm:text-sm">All 3-Seaters</div>
                <div className="text-[10px] opacity-75 mt-0.5">Wide Triple Bench</div>
              </button>
            </div>
          </div>

          {/* Hall In-Charge 1 & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Hall In-Charge 1 (Name)</span>
              </label>
              <input
                type="text"
                value={invigilatorName}
                onChange={(e) => setInvigilatorName(e.target.value)}
                placeholder="e.g. Dr. Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                <span>In-Charge 1 Subject</span>
              </label>
              <input
                type="text"
                value={invigilator1Subject}
                onChange={(e) => setInvigilator1Subject(e.target.value)}
                placeholder="e.g. CS3301"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Hall In-Charge 2 & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Hall In-Charge 2 (Name)</span>
              </label>
              <input
                type="text"
                value={invigilator2Name}
                onChange={(e) => setInvigilator2Name(e.target.value)}
                placeholder="e.g. Prof. Anitha Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                <span>In-Charge 2 Subject</span>
              </label>
              <input
                type="text"
                value={invigilator2Subject}
                onChange={(e) => setInvigilator2Subject(e.target.value)}
                placeholder="e.g. MA3151"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
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
            benchConfig={benchConfig}
            onToggleBench={toggleBench}
          />
        </div>
      </div>
    </form>
  );
};
