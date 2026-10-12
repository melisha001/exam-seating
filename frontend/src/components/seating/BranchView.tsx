import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Table,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { PlanBranchSummaryResponse, BranchSummaryItem } from '../../types';
import { api } from '../../services/api';
import { getDeptColor } from '../../lib/utils';

interface BranchViewProps {
  planId: number;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const BranchView: React.FC<BranchViewProps> = ({ planId, showToast }) => {
  const [summary, setSummary] = useState<PlanBranchSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDeptId, setSelectedDeptId] = useState<number | 'all'>('all');
  const [expandedHallMap, setExpandedHallMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await api.getPlanSummary(planId);
        if (isMounted) {
          setSummary(data);
        }
      } catch (err: any) {
        if (isMounted) {
          showToast(err.message || 'Failed to load branch summary', 'error');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [planId]);

  const toggleExpand = (key: string) => {
    setExpandedHallMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-2xl">
        Loading branch-wise seating allocation details...
      </div>
    );
  }

  if (!summary || summary.departments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm bg-card border border-border rounded-2xl">
        No department allocation data available for this plan.
      </div>
    );
  }

  const activeDept =
    selectedDeptId === 'all'
      ? null
      : summary.departments.find((d) => d.department_id === selectedDeptId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Branch Selector Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Department:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDeptId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedDeptId === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            All Branches ({summary.departments.length})
          </button>

          {summary.departments.map((dept) => {
            const isSelected = selectedDeptId === dept.department_id;
            const colors = getDeptColor(dept.department_id);
            return (
              <button
                key={dept.department_id}
                type="button"
                onClick={() => setSelectedDeptId(dept.department_id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'ring-2 ring-primary text-foreground bg-primary/10 shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colors.hex }}
                />
                <span>{dept.department_code}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/80 text-foreground">
                  {dept.total_students}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          Total Seated:{' '}
          <strong className="text-foreground">{summary.total_assigned} students</strong>
        </div>
      </div>

      {/* Selected Branch Detail Card (if single dept selected) */}
      {activeDept && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: getDeptColor(activeDept.department_id).hex }}
                  />
                  <h3 className="text-lg font-bold text-foreground">
                    {activeDept.department_code} &mdash; {activeDept.department_name}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allocated across {activeDept.halls.length} examination halls &bull; Total candidates: {activeDept.total_students}
                </p>
              </div>
            </div>

            {/* Halls breakdown list for this dept */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDept.halls.map((hall) => {
                const expandKey = `${activeDept.department_id}-${hall.room_id}`;
                const isExpanded = !!expandedHallMap[expandKey];

                return (
                  <div
                    key={hall.room_id}
                    className="border border-border rounded-xl p-4 bg-muted/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-bold text-foreground text-sm">
                          {hall.room_name}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {hall.count} students
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Roll Ranges: </span>
                        {hall.roll_ranges.length > 0 ? (
                          <span className="font-mono text-foreground font-medium">
                            {hall.roll_ranges.join(', ')}
                          </span>
                        ) : (
                          <span>{hall.count} seated</span>
                        )}
                      </div>

                      {/* Seat numbers toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(expandKey)}
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="w-3 h-3" /> Hide Seat Numbers
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3 h-3" /> View Assigned Seats ({hall.seat_labels.length})
                            </>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-2.5 rounded-lg bg-background border border-border text-[11px] font-mono flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                            {hall.seat_labels.map((seatLbl, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/60"
                              >
                                {seatLbl}
                                {hall.roll_numbers[idx] && (
                                  <span className="text-muted-foreground ml-1">
                                    ({hall.roll_numbers[idx]})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ALL BRANCHES OVERVIEW TABLE & MATRIX */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Table className="w-4 h-4 text-primary" />
            Branch &times; Examination Hall Distribution Matrix
          </h3>
          <span className="text-xs text-muted-foreground">
            Non-adjacent interleaved seating distribution
          </span>
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/60 border-b border-border text-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4 font-bold sticky left-0 bg-muted/60 z-10 border-r border-border">
                    Branch / Dept
                  </th>
                  {summary.matrix.rooms.map((rm) => (
                    <th key={rm.id} className="py-3 px-3 text-center border-r border-border min-w-[100px]">
                      <div className="font-bold text-foreground">{rm.name}</div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right font-extrabold text-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.matrix.rows.map((row) => {
                  const colors = getDeptColor(row.department_id);
                  return (
                    <tr key={row.department_id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-semibold sticky left-0 bg-card z-10 border-r border-border">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: colors.hex }}
                          />
                          <div>
                            <span className="font-bold text-foreground">{row.department_code}</span>
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[160px]">
                              {row.department_name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {summary.matrix.rooms.map((rm) => {
                        const count = row.room_counts[String(rm.id)] || 0;
                        return (
                          <td
                            key={rm.id}
                            className={`py-3 px-3 text-center border-r border-border font-mono ${
                              count > 0 ? 'font-bold text-foreground bg-primary/5' : 'text-muted-foreground/40'
                            }`}
                          >
                            {count > 0 ? count : '—'}
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-right font-mono font-extrabold text-foreground text-sm">
                        {row.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/40 border-t-2 border-border font-bold text-foreground">
                <tr>
                  <td className="py-3 px-4 sticky left-0 bg-muted/40 z-10 border-r border-border">
                    Hall Capacity / Total Seated
                  </td>
                  {summary.matrix.rooms.map((rm) => {
                    const hallInfo = summary.halls.find((h) => h.room_id === rm.id);
                    return (
                      <td key={rm.id} className="py-3 px-3 text-center border-r border-border font-mono">
                        <span className="text-primary font-extrabold">
                          {hallInfo?.assigned || 0}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal block">
                          / {hallInfo?.capacity || 0}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-primary text-sm">
                    {summary.total_assigned}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
