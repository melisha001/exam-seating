import React, { useState } from 'react';
import {
  Calendar,
  Users,
  Building2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Sliders,
  Check,
} from 'lucide-react';
import { Room, Department, ExamSession, ExamEntry, PlanDetail } from '../types';
import { api } from '../services/api';

interface WizardProps {
  rooms: Room[];
  departments: Department[];
  sessions: ExamSession[];
  entries: ExamEntry[];
  onRefreshData: () => Promise<void>;
  onPlanGenerated: (plan: PlanDetail) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const Wizard: React.FC<WizardProps> = ({
  rooms,
  departments,
  sessions,
  entries,
  onRefreshData,
  onPlanGenerated,
  showToast,
}) => {
  const [step, setStep] = useState<number>(1);

  // Step 1 State: Session
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    sessions.length > 0 ? sessions[0].id : null
  );
  const [newDate, setNewDate] = useState<string>('2025-05-15');
  const [newLabel, setNewLabel] = useState<string>('FN');
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  // Step 2 State: Entries (Departments, Subject, Student Count, Roll range, Exclusions)
  const [entryDeptId, setEntryDeptId] = useState<number>(
    departments.length > 0 ? departments[0].id : 1
  );
  const [entrySubject, setEntrySubject] = useState<string>('');
  const [entrySubjectCode, setEntrySubjectCode] = useState<string>('');
  const [entryCount, setEntryCount] = useState<number>(40);
  const [entryRollStart, setEntryRollStart] = useState<string>('');
  const [entryRollEnd, setEntryRollEnd] = useState<string>('');
  const [entryExclusions, setEntryExclusions] = useState<string>('');
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [isAddingEntry, setIsAddingEntry] = useState<boolean>(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState<boolean>(false);
  const [newDeptCode, setNewDeptCode] = useState<string>('');
  const [newDeptName, setNewDeptName] = useState<string>('');
  const [isCreatingDept, setIsCreatingDept] = useState<boolean>(false);

  // Auto-calculate student count when roll start, roll end, or exclusions change
  React.useEffect(() => {
    if (entryRollStart.trim() && entryRollEnd.trim()) {
      const startMatch = entryRollStart.trim().match(/^(.*?)(\d+)$/);
      const endMatch = entryRollEnd.trim().match(/^(.*?)(\d+)$/);
      if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
        const sNum = parseInt(startMatch[2], 10);
        const eNum = parseInt(endMatch[2], 10);
        if (eNum >= sNum) {
          const rawTotal = eNum - sNum + 1;
          const exclCount = entryExclusions
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0).length;
          const computed = Math.max(0, rawTotal - exclCount);
          setEntryCount(computed);
        }
      }
    }
  }, [entryRollStart, entryRollEnd, entryExclusions]);

  // Step 3 State: Selected Rooms (ordered)
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>(
    rooms.map((r) => r.id)
  );

  // Step 4 State: Algorithm Options
  const [checkFrontBack, setCheckFrontBack] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Filter entries for the selected session
  const currentSessionEntries = entries.filter(
    (e) => e.session_id === selectedSessionId
  );
  const totalStudents = currentSessionEntries.reduce(
    (acc, e) => acc + e.student_count,
    0
  );

  const selectedRooms = rooms.filter((r) => selectedRoomIds.includes(r.id));
  const totalSelectedCapacity = selectedRooms.reduce((acc, r) => acc + r.capacity, 0);

  // Handler: Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingSession(true);
      const created = await api.createSession({ date: newDate, label: newLabel });
      await onRefreshData();
      setSelectedSessionId(created.id);
      showToast(`Created exam session ${created.date} (${created.label})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create session', 'error');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Quick department create handler
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptCode.trim() || !newDeptName.trim()) {
      showToast('Department code and name are required', 'error');
      return;
    }
    try {
      setIsCreatingDept(true);
      const created = await api.createDepartment({
        code: newDeptCode.trim().toUpperCase(),
        name: newDeptName.trim(),
      });
      await onRefreshData();
      setEntryDeptId(created.id);
      setNewDeptCode('');
      setNewDeptName('');
      setShowAddDeptModal(false);
      showToast(`Added department ${created.code}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add department', 'error');
    } finally {
      setIsCreatingDept(false);
    }
  };

  // Handler: Save or Update Entry
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) {
      showToast('Please select or create a session first', 'error');
      return;
    }
    if (!entrySubject.trim()) {
      showToast('Please enter subject name', 'error');
      return;
    }

    // Validation: Start & End prefix check & bounds
    if (entryRollStart.trim() && entryRollEnd.trim()) {
      const startMatch = entryRollStart.trim().match(/^(.*?)(\d+)$/);
      const endMatch = entryRollEnd.trim().match(/^(.*?)(\d+)$/);
      if (!startMatch || !endMatch) {
        showToast('Roll numbers must end in digits (e.g. 927623BCS001)', 'error');
        return;
      }
      if (startMatch[1] !== endMatch[1]) {
        showToast(`Roll prefix mismatch: "${startMatch[1]}" vs "${endMatch[1]}"`, 'error');
        return;
      }
      if (parseInt(endMatch[2], 10) < parseInt(startMatch[2], 10)) {
        showToast('Roll end number cannot be less than Roll start number', 'error');
        return;
      }
    }

    if (entryCount <= 0) {
      showToast('Candidate count must be greater than 0', 'error');
      return;
    }

    try {
      setIsAddingEntry(true);
      if (editingEntryId) {
        await api.updateEntry(editingEntryId, {
          department_id: entryDeptId,
          subject: entrySubject.trim(),
          subject_code: entrySubjectCode.trim() || null,
          student_count: Number(entryCount),
          roll_start: entryRollStart.trim() || null,
          roll_end: entryRollEnd.trim() || null,
          exclusions: entryExclusions.trim() || null,
        });
        showToast('Department entry updated', 'success');
        setEditingEntryId(null);
      } else {
        await api.createEntry({
          session_id: selectedSessionId,
          department_id: entryDeptId,
          subject: entrySubject.trim(),
          subject_code: entrySubjectCode.trim() || null,
          student_count: Number(entryCount),
          roll_start: entryRollStart.trim() || null,
          roll_end: entryRollEnd.trim() || null,
          exclusions: entryExclusions.trim() || null,
        });
        showToast('Department entry added', 'success');
      }
      await onRefreshData();
      // Reset form
      setEntrySubject('');
      setEntrySubjectCode('');
      setEntryRollStart('');
      setEntryRollEnd('');
      setEntryExclusions('');
      setEntryCount(40);
    } catch (err: any) {
      showToast(err.message || 'Failed to save entry', 'error');
    } finally {
      setIsAddingEntry(false);
    }
  };

  const handleEditEntry = (entry: ExamEntry) => {
    setEditingEntryId(entry.id);
    setEntryDeptId(entry.department_id);
    setEntrySubject(entry.subject);
    setEntrySubjectCode(entry.subject_code || '');
    setEntryCount(entry.student_count);
    setEntryRollStart(entry.roll_start || '');
    setEntryRollEnd(entry.roll_end || '');
    setEntryExclusions(entry.exclusions || '');
  };

  const handleDeleteEntry = async (id: number) => {
    try {
      await api.deleteEntry(id);
      await onRefreshData();
      if (editingEntryId === id) {
        setEditingEntryId(null);
        setEntrySubject('');
        setEntrySubjectCode('');
        setEntryRollStart('');
        setEntryRollEnd('');
        setEntryExclusions('');
      }
      showToast('Entry removed', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete entry', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEntrySubject('');
    setEntrySubjectCode('');
    setEntryRollStart('');
    setEntryRollEnd('');
    setEntryExclusions('');
    setEntryCount(40);
  };

  // Handler: Toggle Room Selection
  const toggleRoom = (roomId: number) => {
    if (selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds(selectedRoomIds.filter((id) => id !== roomId));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomId]);
    }
  };

  // Handler: Generate Plan
  const handleGenerate = async () => {
    if (!selectedSessionId) {
      showToast('Please select an exam session', 'error');
      return;
    }
    if (currentSessionEntries.length === 0) {
      showToast('Please add at least one department exam entry', 'error');
      setStep(2);
      return;
    }
    if (selectedRoomIds.length === 0) {
      showToast('Please select at least one examination hall', 'error');
      setStep(3);
      return;
    }

    try {
      setIsGenerating(true);
      const plan = await api.generatePlan({
        session_id: selectedSessionId,
        room_ids: selectedRoomIds,
        check_front_back: checkFrontBack,
      });
      showToast('Exam seating plan generated successfully!', 'success');
      onPlanGenerated(plan);
    } catch (err: any) {
      showToast(err.message || 'Plan generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const stepsList = [
    { num: 1, title: 'Date & Session', icon: Calendar },
    { num: 2, title: 'Departments & Counts', icon: Users },
    { num: 3, title: 'Select Halls', icon: Building2 },
    { num: 4, title: 'Review & Constraints', icon: Sliders },
    { num: 5, title: 'Generate Plan', icon: Sparkles },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Wizard Step Tracker */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto pb-2 sm:pb-0 gap-2">
          {stepsList.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;

            return (
              <React.Fragment key={s.num}>
                <div
                  onClick={() => s.num < step && setStep(s.num)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer select-none ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : isCompleted
                      ? 'text-foreground hover:bg-muted font-medium'
                      : 'text-muted-foreground opacity-60 pointer-events-none'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span className="text-xs sm:text-sm whitespace-nowrap hidden sm:inline">
                    {s.title}
                  </span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div className="h-px w-6 sm:w-12 bg-border flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* STEP 1: Session */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Step 1: Exam Date &amp; Session
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose an existing examination schedule or schedule a new exam slot.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-foreground">
                Select Existing Session
              </label>
              {sessions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
                  No sessions exist yet. Create one below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => setSelectedSessionId(sess.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedSessionId === sess.id
                          ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                          : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-foreground text-sm block">
                          {sess.date}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sess.label} Session
                        </span>
                      </div>
                      {selectedSessionId === sess.id && (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-semibold">
                  Or Create New Session
                </span>
              </div>
            </div>

            <form
              onSubmit={handleCreateSession}
              className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Session Label (FN / AN / Custom)
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. FN or Morning"
                    required
                    className="w-full px-3.5 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreatingSession}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isCreatingSession ? 'Creating...' : 'Create Session'}
              </button>
            </form>

            <div className="flex justify-end pt-4">
              <button
                disabled={!selectedSessionId}
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Next: Add Departments <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Departments & Exam Entries */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Step 2: Department Exam Registration
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add all participating departments for this session. Interleaved allocation distributes students across halls to prevent cheating.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDeptModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                + Add New Department
              </button>
            </div>

            {/* Quick Add Department Modal / Popover */}
            {showAddDeptModal && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Create New Department
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddDeptModal(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Dept Code (e.g. MECH, CIVIL, AIDS)"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Department Name (e.g. Mechanical Engineering)"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isCreatingDept}
                    onClick={handleCreateDepartment}
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    {isCreatingDept ? 'Saving...' : 'Save Department'}
                  </button>
                </div>
              </div>
            )}

            {/* Repeatable Department Summary Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Departments ({currentSessionEntries.length}) &bull; Total Candidates: <span className="font-bold text-foreground">{totalStudents}</span>
                </h4>
              </div>

              {currentSessionEntries.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
                  No departments added yet for this session. Fill in the form below to register your first branch.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Branch</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Roll Range</th>
                        <th className="py-2.5 px-3">Exclusions</th>
                        <th className="py-2.5 px-3 text-right">Students</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {currentSessionEntries.map((entry) => {
                        const dept = departments.find((d) => d.id === entry.department_id);
                        const isEditing = editingEntryId === entry.id;
                        return (
                          <tr
                            key={entry.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isEditing ? 'bg-primary/5 font-medium' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span className="font-bold text-foreground">
                                {dept?.code || `Dept #${entry.department_id}`}
                              </span>
                              <div className="text-[10px] text-muted-foreground">
                                {dept?.name}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-foreground">{entry.subject}</span>
                              {entry.subject_code && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                  {entry.subject_code}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px]">
                              {entry.roll_start && entry.roll_end ? (
                                <span className="text-foreground">
                                  {entry.roll_start} &rarr; {entry.roll_end}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">Sequential auto-gen</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] max-w-[120px] truncate">
                              {entry.exclusions ? (
                                <span className="text-rose-500 font-medium" title={entry.exclusions}>
                                  {entry.exclusions.split(',').length} absent ({entry.exclusions})
                                </span>
                              ) : (
                                <span className="text-muted-foreground">&mdash;</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-foreground text-sm">
                              {entry.student_count}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditEntry(entry)}
                                  className="px-2 py-1 rounded hover:bg-muted text-xs text-foreground font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-colors"
                                  title="Remove entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Department Entry Form (Add / Edit) */}
            <form
              onSubmit={handleSaveEntry}
              className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  {editingEntryId ? 'Edit Department Exam Entry' : 'Add Department / Subject'}
                </h4>
                {editingEntryId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Department
                  </label>
                  <select
                    value={entryDeptId}
                    onChange={(e) => setEntryDeptId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={entrySubject}
                    onChange={(e) => setEntrySubject(e.target.value)}
                    placeholder="e.g. Database Management"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Subject Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={entrySubjectCode}
                    onChange={(e) => setEntrySubjectCode(e.target.value)}
                    placeholder="e.g. CS8492"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Roll range and student count row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Start Roll Number
                  </label>
                  <input
                    type="text"
                    value={entryRollStart}
                    onChange={(e) => setEntryRollStart(e.target.value)}
                    placeholder="e.g. 927623BCS001"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    End Roll Number
                  </label>
                  <input
                    type="text"
                    value={entryRollEnd}
                    onChange={(e) => setEntryRollEnd(e.target.value)}
                    placeholder="e.g. 927623BCS060"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Exclusions / Absentees
                  </label>
                  <input
                    type="text"
                    value={entryExclusions}
                    onChange={(e) => setEntryExclusions(e.target.value)}
                    placeholder="e.g. 927623BCS015, 927623BCS032"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                    <span>Student Count</span>
                    <span className="text-[10px] text-primary font-bold">Auto-calculated</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={entryCount}
                    onChange={(e) => setEntryCount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-muted-foreground">
                  Tip: Provide Start &amp; End roll numbers to auto-calculate student counts and exclude absentees.
                </span>

                <button
                  type="submit"
                  disabled={isAddingEntry}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingEntry
                    ? 'Saving...'
                    : editingEntryId
                    ? 'Update Department'
                    : 'Add This Department'}
                </button>
              </div>
            </form>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={currentSessionEntries.length === 0}
                onClick={() => setStep(3)}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Next: Select Halls ({currentSessionEntries.length} Depts) <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Select Halls */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Step 3: Select Examination Halls
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                The algorithm fills halls in the order selected to maximize room utilization and minimize empty halls.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
              <span className="font-medium text-muted-foreground">
                Required Capacity: <strong className="text-foreground">{totalStudents} students</strong>
              </span>
              <span className={`font-semibold ${totalSelectedCapacity >= totalStudents ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                Selected Capacity: {totalSelectedCapacity} seats
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id);
                return (
                  <div
                    key={room.id}
                    onClick={() => toggleRoom(room.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-base">
                          {room.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Invigilator: {room.invigilator_name || 'Unassigned'}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center ${
                          isSelected ? 'bg-primary text-white' : 'border border-border'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {room.rows} rows &times; {room.columns} cols &times; {room.seats_per_bench} seat/bench
                      </span>
                      <span className="font-bold text-foreground">
                        {room.capacity} seats
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={selectedRoomIds.length === 0}
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Next: Review Constraints <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review Constraints */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Step 4: Review &amp; Anti-Malpractice Rules
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure constraint strictness before the optimizer runs.
              </p>
            </div>

            {/* Constraints overview */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Hard Rule 1: Same Department Separation
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Candidates from the same department are strictly prevented from sitting on the same bench or directly adjacent left/right benches.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Hard Rule 2: Same Subject Separation
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Candidates from different departments writing the exact same subject are also prohibited from adjacent seats.
                </p>
              </div>

              {/* Front-Back Toggle */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-foreground block">
                    Front / Back Bench Separation
                  </span>
                  <p className="text-xs text-muted-foreground">
                    When enabled, students directly ahead or behind on the same column cannot share department/subject (strictest anti-cheating mode).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkFrontBack}
                    onChange={(e) => setCheckFrontBack(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Capacity check alert */}
            {totalSelectedCapacity < totalStudents && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-3 text-xs leading-relaxed">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                <div>
                  <strong>Capacity Deficit Warning:</strong> You have {totalStudents} students but only {totalSelectedCapacity} seats selected. At least {totalStudents - totalSelectedCapacity} students will remain unseated. Go back to step 3 to add more halls.
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                Next: Generate <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Generate */}
        {step === 5 && (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-2xl font-bold text-foreground">
                Ready to Run Optimization
              </h3>
              <p className="text-sm text-muted-foreground">
                The engine will interleave candidate queues by largest group first, guarantee zero adjacency violations, and produce per-room seating arrangements.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-muted/20 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Date:</span>
                <span className="font-semibold text-foreground">
                  {sessions.find((s) => s.id === selectedSessionId)?.date} ({sessions.find((s) => s.id === selectedSessionId)?.label})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Candidates:</span>
                <span className="font-semibold text-foreground">{totalStudents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Halls Allocated:</span>
                <span className="font-semibold text-foreground">{selectedRoomIds.length} halls ({totalSelectedCapacity} capacity)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Front/Back Adjacency:</span>
                <span className="font-semibold text-foreground">{checkFrontBack ? 'Active (Strict)' : 'Disabled'}</span>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => setStep(4)}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Optimizing Arrangement...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Seating Plan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
