import React from 'react';
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
} from 'lucide-react';
import { Room, Department, ExamSession, ExamEntry, PlanDetail } from '../types';
import { getDeptColor } from '../lib/utils';

interface DashboardProps {
  rooms: Room[];
  departments: Department[];
  sessions: ExamSession[];
  entries: ExamEntry[];
  currentPlan: PlanDetail | null;
  onStartWizard: () => void;
  onSelectSession: (sessionId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  rooms,
  departments,
  sessions,
  entries,
  currentPlan,
  onStartWizard,
  onSelectSession,
}) => {
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

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => onSelectSession(sess.id)}
                        className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                      >
                        Load / Plan
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
    </div>
  );
};
