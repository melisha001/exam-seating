import React, { useState, useEffect, useCallback } from 'react';
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
  RotateCcw,
  Lock,
  Edit3,
  X,
  Wand2,
} from 'lucide-react';
import { Room, Department, ExamSession, ExamEntry, PlanDetail, TargetCheckResponse } from '../types';
import { api } from '../services/api';
import { getSeaterBreakdown } from '../lib/utils';
import { RoomPreview } from './room/RoomPreview';
import { NumberStepper } from './room/NumberStepper';

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
  const [entryMedium, setEntryMedium] = useState<'EN' | 'TA'>('EN');
  const [entryIsArrear, setEntryIsArrear] = useState<boolean>(false);
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
    if (entryIsArrear && !entryRollEnd.trim() && entryRollStart.trim()) {
      // For arrear entries without an end roll, count comma-separated roll numbers
      const items = entryRollStart.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      const exclCount = entryExclusions.split(',').map((s) => s.trim()).filter((s) => s.length > 0).length;
      setEntryCount(Math.max(1, items.length - exclCount));
      return;
    }
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
  }, [entryRollStart, entryRollEnd, entryExclusions, entryIsArrear]);

  // Step 3 State: Selected Rooms (ordered)
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>(
    rooms.map((r) => r.id)
  );

  // Target Check & Distribution Mode State
  const [isPlanLocked, setIsPlanLocked] = useState<boolean>(false);
  const [targetCheck, setTargetCheck] = useState<TargetCheckResponse | null>(null);
  const [equalStudentsPerHall, setEqualStudentsPerHall] = useState<boolean>(false);

  // Check if session has an active generated plan
  useEffect(() => {
    if (!selectedSessionId) {
      setIsPlanLocked(false);
      return;
    }
    api.getPlanBySession(selectedSessionId)
      .then(() => setIsPlanLocked(true))
      .catch(() => setIsPlanLocked(false));
  }, [selectedSessionId]);

  // Target check computation
  const refreshTargetCheck = useCallback(async () => {
    if (!selectedSessionId || selectedRoomIds.length === 0) {
      setTargetCheck(null);
      return;
    }
    try {
      const res = await api.checkTargets(selectedSessionId, selectedRoomIds, equalStudentsPerHall);
      setTargetCheck(res);
    } catch {
      setTargetCheck(null);
    }
  }, [selectedSessionId, selectedRoomIds, equalStudentsPerHall]);

  useEffect(() => {
    refreshTargetCheck();
  }, [selectedSessionId, selectedRoomIds, rooms, equalStudentsPerHall, refreshTargetCheck]);

  // Step 4 State: Algorithm Options
  const [checkFrontBack, setCheckFrontBack] = useState<boolean>(true);
  const [treatDifferentMedium, setTreatDifferentMedium] = useState<boolean>(false);
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
    } else if (!entryIsArrear && (entryRollStart.trim() || entryRollEnd.trim())) {
      showToast('For regular entries, provide both start and end roll numbers (or leave blank for auto-gen)', 'error');
      return;
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
          medium: entryMedium,
          student_count: Number(entryCount),
          roll_start: entryRollStart.trim() || null,
          roll_end: entryRollEnd.trim() || null,
          exclusions: entryExclusions.trim() || null,
          is_arrear: entryIsArrear,
        });
        showToast('Department entry updated', 'success');
        setEditingEntryId(null);
      } else {
        await api.createEntry({
          session_id: selectedSessionId,
          department_id: entryDeptId,
          subject: entrySubject.trim(),
          subject_code: entrySubjectCode.trim() || null,
          medium: entryMedium,
          student_count: Number(entryCount),
          roll_start: entryRollStart.trim() || null,
          roll_end: entryRollEnd.trim() || null,
          exclusions: entryExclusions.trim() || null,
          is_arrear: entryIsArrear,
        });
        showToast(entryIsArrear ? 'Arrear exam entry registered' : 'Department entry added', 'success');
      }
      await onRefreshData();
      // Reset form
      setEntrySubject('');
      setEntrySubjectCode('');
      setEntryMedium('EN');
      setEntryIsArrear(false);
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
    setEntryMedium((entry.medium as 'EN' | 'TA') || 'EN');
    setEntryIsArrear(Boolean(entry.is_arrear));
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
        setEntryMedium('EN');
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
    setEntryMedium('EN');
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

  // Handler: Reset Allocation for Session
  const handleResetAllocation = async () => {
    if (!selectedSessionId) return;
    try {
      await api.deletePlanBySession(selectedSessionId);
      setIsPlanLocked(false);
      showToast('Previous allocation reset. Hall layout editing is now unlocked.', 'success');
      await onRefreshData();
      refreshTargetCheck();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset allocation', 'error');
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
    if (totalStudents > totalSelectedCapacity) {
      const shortage = totalStudents - totalSelectedCapacity;
      showToast(`Short by ${shortage} seat(s). Add a hall or edit benches in Halls & Depts.`, 'error');
      setStep(3);
      return;
    }

    try {
      setIsGenerating(true);
      const plan = await api.generatePlan({
        session_id: selectedSessionId,
        room_ids: selectedRoomIds,
        check_front_back: checkFrontBack,
        treat_different_medium_as_different_paper: treatDifferentMedium,
        equal_students_per_hall: equalStudentsPerHall,
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground">{entry.subject}</span>
                                {entry.subject_code && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                    {entry.subject_code}
                                  </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  entry.medium === 'TA'
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30'
                                }`}>
                                  {entry.medium || 'EN'}
                                </span>
                                {entry.is_arrear && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    Arrear
                                  </span>
                                )}
                              </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
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
                    Medium
                  </label>
                  <select
                    value={entryMedium}
                    onChange={(e) => setEntryMedium(e.target.value as 'EN' | 'TA')}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-semibold focus:ring-2 focus:ring-primary"
                  >
                    <option value="EN">English (EN)</option>
                    <option value="TA">Tamil (TA)</option>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Subject Code
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400">
                      <input
                        type="checkbox"
                        checked={entryIsArrear}
                        onChange={(e) => setEntryIsArrear(e.target.checked)}
                        className="rounded border-input text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                      />
                      <span>Arrear</span>
                    </label>
                  </div>
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
                    {entryIsArrear ? 'Roll Number(s)' : 'Start Roll Number'}
                  </label>
                  <input
                    type="text"
                    value={entryRollStart}
                    onChange={(e) => setEntryRollStart(e.target.value)}
                    placeholder={entryIsArrear ? 'e.g. 21CS045 or comma-separated' : 'e.g. 927623BCS001'}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    End Roll Number {entryIsArrear && <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>}
                  </label>
                  <input
                    type="text"
                    value={entryRollEnd}
                    onChange={(e) => setEntryRollEnd(e.target.value)}
                    placeholder={entryIsArrear ? 'Optional for arrear' : 'e.g. 927623BCS060'}
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

        {/* STEP 3: Select Halls & Fixed Layouts */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Step 3: Select Halls
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Hall layouts are strictly fixed as configured in Halls &amp; Depts. Students are distributed proportionally to each hall&apos;s capacity.
                </p>
              </div>
            </div>

            {/* Locked Allocation Notice */}
            {isPlanLocked && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Seater Configuration Locked:</strong> A seating arrangement is already active for this session. Reset the allocation to modify hall layouts.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetAllocation}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors flex-shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Allocation
                </button>
              </div>
            )}

            {/* Target vs Capacity Overview Bar */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-medium text-muted-foreground">
                  Total Students: <strong className="text-foreground">{totalStudents}</strong>
                </span>
                <span className="text-border">|</span>
                <span className="font-medium text-muted-foreground">
                  Selected Halls: <strong className="text-foreground">{selectedRoomIds.length}</strong>
                </span>
                <span className="text-border">|</span>
                <span className="font-medium text-muted-foreground">
                  Selected Capacity: <strong className="text-foreground">{totalSelectedCapacity} seats</strong>
                </span>
              </div>

              {selectedRoomIds.length > 0 && (
                <span className={`px-2.5 py-1 rounded-full font-bold text-xs border ${
                  totalStudents === totalSelectedCapacity
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : totalStudents < totalSelectedCapacity
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                  {totalStudents === totalSelectedCapacity
                    ? 'Zero Empty Seats (100% Match)'
                    : totalStudents < totalSelectedCapacity
                    ? `${totalSelectedCapacity - totalStudents} Seats Unused`
                    : `Short by ${totalStudents - totalSelectedCapacity} Seats`}
                </span>
              )}
            </div>

            {/* Capacity Status Banners */}
            {selectedRoomIds.length > 0 && totalStudents > totalSelectedCapacity && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-sm">Capacity Shortage</h4>
                  <p className="font-medium">
                    Short by {totalStudents - totalSelectedCapacity} seat{totalStudents - totalSelectedCapacity > 1 ? 's' : ''}. Add a hall or edit benches in Halls &amp; Depts.
                  </p>
                </div>
              </div>
            )}

            {selectedRoomIds.length > 0 && totalStudents < totalSelectedCapacity && totalStudents > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-sm">Partial Occupancy Notice</h4>
                  <p className="font-medium">
                    {totalSelectedCapacity - totalStudents} seat{totalSelectedCapacity - totalStudents > 1 ? 's' : ''} will stay unused. Edit halls in Halls &amp; Depts to match, or continue.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Unused seats will be neatly placed at the end of the hall(s) (last row benches), leaving all other benches fully occupied.
                  </p>
                </div>
              </div>
            )}

            {selectedRoomIds.length > 0 && totalStudents === totalSelectedCapacity && totalStudents > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                <div className="text-xs space-y-0.5">
                  <h4 className="font-bold text-sm">100% Occupancy</h4>
                  <p className="font-medium">
                    Zero empty seats. Every seat in all selected halls will be occupied.
                  </p>
                </div>
              </div>
            )}

            {/* Optional Equal Students per Hall Toggle */}
            {selectedRoomIds.length > 1 && totalStudents > 0 && (() => {
              const equalShare = Math.ceil(totalStudents / selectedRoomIds.length);
              const smallHall = selectedRooms.find((r) => r.capacity < equalShare);
              const canEqualize = !smallHall;

              return (
                <div className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-foreground block">
                      Equal students per hall
                    </span>
                    <p className="text-muted-foreground">
                      {canEqualize
                        ? 'Distribute students equally across halls (differing by at most 1 student) instead of proportionally to capacity.'
                        : `Disabled: Hall ${smallHall.name} capacity (${smallHall.capacity}) is smaller than equal share (${equalShare}).`}
                    </p>
                  </div>
                  <label className={`relative inline-flex items-center ${canEqualize ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="checkbox"
                      disabled={!canEqualize}
                      checked={equalStudentsPerHall && canEqualize}
                      onChange={(e) => setEqualStudentsPerHall(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              );
            })()}

            {/* Hall Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id);
                const hallTarget = targetCheck?.halls.find((h) => h.room_id === room.id);
                const breakdown = getSeaterBreakdown(room);

                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-start justify-between cursor-pointer" onClick={() => toggleRoom(room.id)}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-foreground text-base">
                            {room.name}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border font-mono">
                            {breakdown}
                          </span>
                        </div>
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

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        <span className="font-semibold text-foreground">
                          {room.capacity} seats
                        </span>
                        <span className="text-[11px] ml-1.5 opacity-75">
                          ({room.rows}R &times; {room.columns}C)
                        </span>
                      </div>

                      {isSelected && (
                        <div className="font-semibold text-foreground">
                          Target: <strong className="text-primary">{hallTarget ? hallTarget.target : '—'} students</strong>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 text-[11px] text-muted-foreground italic">
                      To change layout, edit in Halls &amp; Depts before generating.
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
                disabled={selectedRoomIds.length === 0 || totalStudents > totalSelectedCapacity}
                onClick={() => {
                  if (totalStudents > totalSelectedCapacity) {
                    showToast(`Short by ${totalStudents - totalSelectedCapacity} seat(s). Add a hall or edit benches in Halls & Depts.`, 'error');
                    return;
                  }
                  setStep(4);
                }}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Next: Review Layout &amp; Rules <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review Constraints & Layout */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Step 4: Review Layout &amp; Anti-Malpractice Rules
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Confirm hall capacity allocations and configure constraint strictness before the optimizer runs.
              </p>
            </div>

            {/* Review Layout Table */}
            <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Review Hall Layout &amp; Allocations
                </h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Fixed Layout Immutability Enforced
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-border rounded-xl">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Hall Name</th>
                      <th className="py-2.5 px-3">Seater Breakdown</th>
                      <th className="py-2.5 px-3">Capacity</th>
                      <th className="py-2.5 px-3">Students to be Seated</th>
                      <th className="py-2.5 px-3 text-right">Occupancy %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedRooms.map((r) => {
                      const ht = targetCheck?.halls.find((h) => h.room_id === r.id);
                      const target = ht ? ht.target : r.capacity;
                      const occPct = r.capacity > 0 ? Math.round((target / r.capacity) * 100) : 0;
                      const breakdown = getSeaterBreakdown(r);

                      return (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="py-3 px-3 font-bold text-foreground">
                            {r.name}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground font-mono">
                            {breakdown}
                          </td>
                          <td className="py-3 px-3 font-semibold text-foreground">
                            {r.capacity} seats
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-primary">
                              {target} students
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              occPct === 100
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {occPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                  Candidates writing the same subject code are strictly prohibited from adjacent seats (left/right and diagonal).
                </p>
              </div>

              {/* Treat different medium as a different paper toggle */}
              <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground block">
                      Treat Different Medium as a Different Paper
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground">
                      Default: OFF
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When OFF, EN and TA students writing the same subject code write the same exam paper and cannot sit next to each other. When ON, EN and TA are treated as different subjects.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={treatDifferentMedium}
                    onChange={(e) => setTreatDifferentMedium(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Front-Back Toggle */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-foreground block">
                    Front / Back Bench Separation
                  </span>
                  <p className="text-xs text-muted-foreground">
                    When enabled, students directly ahead or behind on the same column cannot share department/subject. When disabled, same subject ahead/behind is allowed and expected.
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
                The engine will solve column-by-column with zero mutations to configured hall layouts, guarantee zero horizontal/diagonal copy conflicts, and maximize occupancy.
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
                <span className="font-semibold text-foreground">{selectedRoomIds.length} halls ({totalSelectedCapacity} seats)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distribution Mode:</span>
                <span className="font-semibold text-foreground">{equalStudentsPerHall ? 'Equal Students per Hall' : 'Capacity Proportional (Hamilton)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Front/Back Adjacency:</span>
                <span className="font-semibold text-foreground">{checkFrontBack ? 'Active (Strict)' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Occupancy Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {totalStudents >= totalSelectedCapacity ? '100% Full Occupancy' : `${totalSelectedCapacity - totalStudents} Unused Seats (at Hall End)`}
                </span>
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
                disabled={isGenerating || totalStudents > totalSelectedCapacity}
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
