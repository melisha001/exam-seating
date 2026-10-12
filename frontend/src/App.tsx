import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { Wizard } from './components/Wizard';
import { SeatingView } from './components/SeatingView';
import { RoomManager } from './components/RoomManager';
import { Room, Department, ExamSession, ExamEntry, PlanDetail } from './types';
import { api } from './services/api';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wizard' | 'seating' | 'manage'>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Global Data State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [entries, setEntries] = useState<ExamEntry[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync dark class on <html> element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load all initial entities
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [r, d, s, e] = await Promise.all([
        api.getRooms(),
        api.getDepartments(),
        api.getSessions(),
        api.getEntries(),
      ]);
      setRooms(r);
      setDepartments(d);
      setSessions(s);
      setEntries(e);

      // Attempt to load existing plan for the latest session if available
      if (s.length > 0) {
        try {
          const plan = await api.getPlanBySession(s[0].id);
          setCurrentPlan(plan);
        } catch {
          // No plan exists for this session yet, which is normal
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to connect to backend server', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh plan after swap or manual reload
  const refreshCurrentPlan = async () => {
    if (!currentPlan) return;
    try {
      const updated = await api.getPlanBySession(currentPlan.session_id);
      setCurrentPlan(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to reload plan', 'error');
    }
  };

  // Handler when user clicks a session from Dashboard
  const handleSelectSessionFromDashboard = async (sessionId: number) => {
    try {
      const plan = await api.getPlanBySession(sessionId);
      setCurrentPlan(plan);
      setActiveTab('seating');
      showToast(`Loaded seating plan for session #${sessionId}`, 'success');
    } catch {
      setActiveTab('wizard');
      showToast('No generated plan exists yet for this session. Use the wizard to generate one.', 'info');
    }
  };

  // Handler when wizard finishes plan generation
  const handlePlanGenerated = (plan: PlanDetail) => {
    setCurrentPlan(plan);
    setActiveTab('seating');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start gap-3 text-xs font-medium animate-in slide-in-from-bottom-5 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                : 'bg-card border-border text-foreground'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        hasActivePlan={!!currentPlan}
      />

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">
              Connecting to Exam Seating Engine...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                rooms={rooms}
                departments={departments}
                sessions={sessions}
                entries={entries}
                currentPlan={currentPlan}
                onStartWizard={() => setActiveTab('wizard')}
                onSelectSession={handleSelectSessionFromDashboard}
                onRefreshData={loadInitialData}
                showToast={showToast}
              />
            )}

            {activeTab === 'wizard' && (
              <Wizard
                rooms={rooms}
                departments={departments}
                sessions={sessions}
                entries={entries}
                onRefreshData={loadInitialData}
                onPlanGenerated={handlePlanGenerated}
                showToast={showToast}
              />
            )}

            {activeTab === 'seating' && (
              <SeatingView
                plan={currentPlan}
                departments={departments}
                onRefreshPlan={refreshCurrentPlan}
                showToast={showToast}
              />
            )}

            {activeTab === 'manage' && (
              <RoomManager
                rooms={rooms}
                departments={departments}
                onRefreshData={loadInitialData}
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-card/40">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            AutoSeat Pro &bull; Automated Exam Seating &amp; Anti-Malpractice System
          </span>
          <span className="opacity-75">
            College Examination Cell &bull; Fast-Track Interleaving Engine
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
