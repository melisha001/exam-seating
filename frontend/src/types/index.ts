export interface Room {
  id: number;
  name: string;
  rows: number;
  columns: number;
  seats_per_bench: number;
  invigilator_name: string | null;
  capacity: number;
}

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface ExamSession {
  id: number;
  date: string;
  label: string;
}

export interface ExamEntry {
  id: number;
  session_id: number;
  department_id: number;
  subject: string;
  subject_code?: string | null;
  student_count: number;
  roll_start: string | null;
  roll_end: string | null;
  exclusions?: string | null;
}

export interface SeatAssignment {
  id: number;
  plan_id: number;
  room_id: number;
  row: number;
  col: number;
  seat_index: number;
  roll_number: string | null;
  department_id: number | null;
  subject: string | null;
  is_empty: boolean;
}

export interface RoomGrid {
  room_id: number;
  room_name: string;
  invigilator_name: string | null;
  capacity: number;
  assigned: number;
  utilization_pct: number;
  seats: SeatAssignment[];
}

export interface PlanDetail {
  plan_id: number;
  session_id: number;
  rooms_used: number;
  total_assigned: number;
  unseated_count: number;
  warnings: string[];
  rooms: RoomGrid[];
}

export interface GeneratePlanRequest {
  session_id: number;
  room_ids: number[];
  check_front_back: boolean;
}

export interface SwapRequest {
  seat_id_a: number;
  seat_id_b: number;
}

export interface BranchHallAllocation {
  room_id: number;
  room_name: string;
  count: number;
  roll_numbers: string[];
  roll_ranges: string[];
  seat_labels: string[];
}

export interface BranchSummaryItem {
  department_id: number;
  department_code: string;
  department_name: string;
  total_students: number;
  halls: BranchHallAllocation[];
}

export interface HallBranchItem {
  department_id: number;
  department_code: string;
  department_name: string;
  count: number;
}

export interface HallSummaryItem {
  room_id: number;
  room_name: string;
  invigilator_name: string | null;
  capacity: number;
  assigned: number;
  branches: HallBranchItem[];
}

export interface MatrixCell {
  room_id: number;
  count: number;
}

export interface PlanBranchSummaryResponse {
  plan_id: number;
  session_id: number;
  total_assigned: number;
  departments: BranchSummaryItem[];
  halls: HallSummaryItem[];
  matrix: {
    rooms: { id: number; name: string }[];
    rows: {
      department_id: number;
      department_code: string;
      department_name: string;
      total: number;
      room_counts: Record<string, number>;
    }[];
  };
}
