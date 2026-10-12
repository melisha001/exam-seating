import React, { useState } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Percent,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Room, Department, ExamSession, ExamEntry, PlanDetail } from '../types';
import { getDeptColor } from '../lib/utils';
import { api } from '../services/api';

interface DashboardProps {
  rooms: Room[];
  departments: Department[];
  sessions: ExamSession[];
  entries: ExamEntry[];
  currentPlan: PlanDetail | null;
  onStartWizard: () => void;
  onSelectSession: (sessionId: number) => void;
  onRefreshData?: () => Promise<void>;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  departments,
  sessions,
  entries,
  currentPlan,
  onStartWizard,
  onSelectSession,
  onRefreshData,
  showToast,
}) => {
  const [sessionToDelete, setSessionToDelete] = useState<ExamSession | null>(null);
  const [sessionToClearPlan, setSessionToClearPlan] = useState<ExamSession | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteSession(sessionToDelete.id);
      showToast?.(`Deleted exam session ${sessionToDelete.date} (${sessionToDelete.label}) and associated data`, 'success');
      setSessionToDelete(null);
      await onRefreshData?.();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delete session', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearPlan = async () => {
    if (!sessionToClearPlan) return;
    try {
      setIsDeleting(true);
      await api.deletePlanBySession(sessionToClearPlan.id);
      showToast?.(`Cleared seating plan for session ${sessionToClearPlan.date} (${sessionToClearPlan.label})`, 'success');
      setSessionToClearPlan(null);
      await onRefreshData?.();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to clear seating plan', 'error');
    } finally {
      setIsDeleting(false);
    }
  };
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const totalStudents = entries.reduce((acc, e) => acc + e.student_count, 0);

  // Calculate average utilization if currentPlan exists, or theoretical
  const avgUtilization = currentPlan
    ? (
        currentPlan.rooms.reduce((acc, r) => acc + r.utilization_pct, 0) /
        (currentPlan.rooms.length || 1)
      ).toFixed(1)
    : rooms.length > 0 && totalStudents > 0
    ? Math.min(100, (totalStudents / totalCapacity) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            ENGINEERING COLLEGE EXAM CONTROLLER
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Intelligent Examination Seating Automation
          </h2>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Eliminate exam malpractice with mathematically guaranteed non-adjacent interleaving,
            capacity-optimised room allocation, and instant PDF/Excel exports.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onStartWizard}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Generate Seating Plan
              <ArrowRight className="w-4 h-4" />
            </button>
            {currentPlan && (
              <span className="text-xs bg-emerald-500/30 text-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-400/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                Active plan generated ({currentPlan.total_assigned} seated)
              </span>
            )}
          </div>
        </div>

        {/* Decorative Grid SVG in background */}
        <div className="absolute right-0 bottom-0 top-0 w-96 opacity-10 pointer-events-none hidden md:block">
          <div className="grid grid-cols-6 gap-2 p-6 h-full">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="border border-white rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exam Halls Available
            </span>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{rooms.length}</span>
            <span className="text-xs text-muted-foreground font-medium">
              ({totalCapacity} seats total)
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Students Registered
            </span>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{totalStudents}</span>
            <span className="text-xs text-muted-foreground font-medium">
              across {entries.length} entries
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exam Sessions
            </span>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{sessions.length}</span>
            <span className="text-xs text-muted-foreground font-medium">configured</span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avg Hall Utilization
            </span>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{avgUtilization}%</span>
            <span className="text-xs text-muted-foreground font-medium">
              {currentPlan ? 'in active plan' : 'estimated'}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions & Plans Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Recent Exam Sessions
            </h3>
            <button
              onClick={onStartWizard}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              New Session <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm divide-y divide-border">
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No exam sessions found. Click &quot;Generate Seating Plan&quot; to create your first session.
              </div>
            ) : (
              sessions.map((sess) => {
                const sessionEntries = entries.filter((e) => e.session_id === sess.id);
                const sessionCount = sessionEntries.reduce((acc, e) => acc + e.student_count, 0);

                return (
                  <div
                    key={sess.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-base">
                          {sess.date}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                          {sess.label} Session
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sessionEntries.length} departments participating &bull; {sessionCount} candidates
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectSession(sess.id)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Load / Plan
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionToClearPlan(sess)}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-medium transition-colors inline-flex items-center gap-1"
                        title="Clear seating plan only (keeps exam session and departments)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                        <span className="hidden sm:inline">Clear Plan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionToDelete(sess)}
                        className="p-1.5 rounded-lg border border-border hover:border-rose-500/40 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 text-xs transition-colors"
                        title="Delete entire session and registered entries"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Participating Departments & Color Codes */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Department Color Legend
          </h3>

          <div className="border border-border rounded-xl bg-card p-4 space-y-3 shadow-sm">
            <p className="text-xs text-muted-foreground">
              Students are strictly interleaved so no adjacent seats share the same department or subject.
            </p>
            <div className="space-y-2">
              {departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No departments registered yet.</p>
              ) : (
                departments.map((dept) => {
                  const colors = getDeptColor(dept.id);
                  return (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/60 hover:border-border transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colors.hex }}
                        />
                        <span className="font-semibold text-foreground">{dept.code}</span>
                        <span className="text-muted-foreground truncate max-w-[140px]">
                          {dept.name}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.badge}`}>
                        ID {dept.id}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-foreground">
                Delete Exam Session?
              </h4>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete session <strong className="text-foreground">{sessionToDelete.date} ({sessionToDelete.label})</strong>?
              This will permanently delete the session, all registered exam entries, and any generated seating plans.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSession}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Seating Plan Confirmation Modal */}
      {sessionToClearPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-foreground">
                Clear Seating Plan Only?
              </h4>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              This will reset the generated seat allocations for <strong className="text-foreground">{sessionToClearPlan.date} ({sessionToClearPlan.label})</strong>.
              Your registered departments and roll number configurations will be preserved so you can regenerate anytime.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToClearPlan(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleClearPlan}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-xs"
              >
                {isDeleting ? 'Clearing...' : 'Clear Plan Only'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
