import {
  Room,
  Department,
  ExamSession,
  ExamEntry,
  PlanDetail,
  GeneratePlanRequest,
  SwapRequest,
  TargetCheckResponse,
  AutoFitResponse,
} from '../types';

const API_BASE = '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errorJson = await res.json();
      if (typeof errorJson.detail === 'string') {
        errorDetail = errorJson.detail;
      } else if (errorJson.detail?.message) {
        errorDetail = errorJson.detail.message + (errorJson.detail.violations ? ': ' + errorJson.detail.violations.join(', ') : '');
      } else if (Array.isArray(errorJson.detail)) {
        errorDetail = errorJson.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
      }
    } catch {
      errorDetail = `Request failed with status ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // Rooms
  getRooms: async (): Promise<Room[]> => {
    const res = await fetch(`${API_BASE}/rooms/`);
    return handleResponse<Room[]>(res);
  },
  createRoom: async (data: Omit<Room, 'id' | 'capacity'>): Promise<Room> => {
    const res = await fetch(`${API_BASE}/rooms/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Room>(res);
  },
  updateRoom: async (id: number, data: Partial<Omit<Room, 'id' | 'capacity'>>): Promise<Room> => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Room>(res);
  },
  deleteRoom: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete room');
  },

  // Departments
  getDepartments: async (): Promise<Department[]> => {
    const res = await fetch(`${API_BASE}/departments/`);
    return handleResponse<Department[]>(res);
  },
  createDepartment: async (data: Omit<Department, 'id'>): Promise<Department> => {
    const res = await fetch(`${API_BASE}/departments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Department>(res);
  },

  // Sessions
  getSessions: async (): Promise<ExamSession[]> => {
    const res = await fetch(`${API_BASE}/sessions/`);
    return handleResponse<ExamSession[]>(res);
  },
  createSession: async (data: Omit<ExamSession, 'id'>): Promise<ExamSession> => {
    const res = await fetch(`${API_BASE}/sessions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ExamSession>(res);
  },
  deleteSession: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete session');
  },

  // Entries
  getEntries: async (sessionId?: number): Promise<ExamEntry[]> => {
    const url = sessionId
      ? `${API_BASE}/entries/?session_id=${sessionId}&limit=500`
      : `${API_BASE}/entries/?limit=500`;
    const res = await fetch(url);
    return handleResponse<ExamEntry[]>(res);
  },
  createEntry: async (data: Omit<ExamEntry, 'id'>): Promise<ExamEntry> => {
    const res = await fetch(`${API_BASE}/entries/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ExamEntry>(res);
  },
  updateEntry: async (id: number, data: Partial<Omit<ExamEntry, 'id'>>): Promise<ExamEntry> => {
    const res = await fetch(`${API_BASE}/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<ExamEntry>(res);
  },
  deleteEntry: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/entries/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete entry');
  },

  // Plans
  generatePlan: async (data: GeneratePlanRequest): Promise<PlanDetail> => {
    const res = await fetch(`${API_BASE}/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<PlanDetail>(res);
  },
  checkTargets: async (sessionId: number, roomIds: number[], equalStudentsPerHall?: boolean): Promise<TargetCheckResponse> => {
    const res = await fetch(`${API_BASE}/plans/target-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        room_ids: roomIds,
        equal_students_per_hall: !!equalStudentsPerHall,
      }),
    });
    return handleResponse<TargetCheckResponse>(res);
  },
  getPlanBySession: async (sessionId: number): Promise<PlanDetail> => {
    const res = await fetch(`${API_BASE}/plans/session/${sessionId}`);
    return handleResponse<PlanDetail>(res);
  },
  deletePlanBySession: async (sessionId: number): Promise<{ message: string; deleted_plan_id: number }> => {
    const res = await fetch(`${API_BASE}/plans/session/${sessionId}`, { method: 'DELETE' });
    return handleResponse<{ message: string; deleted_plan_id: number }>(res);
  },
  getPlanSummary: async (planId: number): Promise<import('../types').PlanBranchSummaryResponse> => {
    const res = await fetch(`${API_BASE}/plans/${planId}/summary`);
    return handleResponse<import('../types').PlanBranchSummaryResponse>(res);
  },
  swapSeats: async (planId: number, data: SwapRequest): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/plans/${planId}/swap`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(res);
  },

  // Save & Lock Changes
  saveChanges: async (planId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/plans/${planId}/save-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return handleResponse<{ message: string }>(res);
  },

  // Export URLs
  getPdfExportUrl: (planId: number) => `${API_BASE}/plans/${planId}/export/pdf`,
  getExcelExportUrl: (planId: number) => `${API_BASE}/plans/${planId}/export/excel`,
  getHallPdfExportUrl: (planId: number, roomId: number) => `${API_BASE}/plans/${planId}/export/pdf?room_id=${roomId}`,
  getHallExcelExportUrl: (planId: number, roomId: number) => `${API_BASE}/plans/${planId}/export/excel?room_id=${roomId}`,
  getOverallPdfExportUrl: (planId: number) => `${API_BASE}/plans/${planId}/export/overall-pdf`,
  getOverallExcelExportUrl: (planId: number) => `${API_BASE}/plans/${planId}/export/overall-excel`,
};
