export interface Room {
  id: number;
  name: string;
  rows: number;
  columns: number;
  seats_per_bench: number;
  bench_config?: string | null;
  seater_mode?: 'auto' | 'manual';
  seater_breakdown?: string | null;
  invigilator_name: string | null;
  invigilator2_name?: string | null;
  invigilator1_subject?: string | null;
  invigilator2_subject?: string | null;
  capacity: number;
}

export interface HallTargetInfo {
  room_id: number;
  room_name: string;
  capacity: number;
  target: number;
  diff: number;
  is_matched: boolean;
  seater_mode?: string;
  seater_breakdown?: string | null;
}

export interface TargetCheckResponse {
  is_valid: boolean;
  total_students: number;
  total_capacity: number;
  shortage: number;
  messages: string[];
  halls: HallTargetInfo[];
}

export interface AutoFitRoomResult {
  id: number;
  name: string;
  rows: number;
  columns: number;
  capacity: number;
  target: number;
  bench_config: string | null;
}

export interface AutoFitResponse {
  message: string;
  total_students: number;
  rooms: AutoFitRoomResult[];
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
  medium?: string;
  student_count: number;
  roll_start: string | null;
  roll_end: string | null;
  exclusions?: string | null;
  is_arrear?: boolean;
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
  subject_code?: string | null;
  medium?: string | null;
  is_empty: boolean;
  is_arrear?: boolean;
  is_locked?: boolean;
  seat_label?: string;
}

export interface RoomGrid {
  room_id: number;
  room_name: string;
  invigilator_name: string | null;
  invigilator2_name?: string | null;
  invigilator1_subject?: string | null;
  invigilator2_subject?: string | null;
  capacity: number;
  assigned: number;
  utilization_pct: number;
  seater_mode?: string;
  seater_breakdown?: string | null;
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
  treat_different_medium_as_different_paper?: boolean;
  equal_students_per_hall?: boolean;
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
