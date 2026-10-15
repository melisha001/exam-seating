import { RoomGrid, SeatAssignment } from '../types';

export interface ValidationReport {
  isValid: boolean;
  checklist: {
    fixedLayoutUnchanged: boolean;
    noUnexpectedEmptySeats: boolean;
    noLeftRightConflicts: boolean;
    noDiagonalConflicts: boolean;
    allStudentsUnique: boolean;
    equalOccupancy: boolean;
  };
  violations: string[];
}

export function getSubjKey(seat: SeatAssignment, treatDifferentMediumAsDifferentPaper: boolean = false): string {
  const sCode = (seat.subject_code || seat.subject || '').trim().toUpperCase();
  const med = (seat.medium || 'EN').trim().toUpperCase();
  if (treatDifferentMediumAsDifferentPaper && sCode) {
    return `${sCode}_${med}`;
  }
  return sCode;
}

export function validateGrid(
  room: RoomGrid,
  treatDifferentMediumAsDifferentPaper: boolean = false,
  allRooms?: RoomGrid[]
): ValidationReport {
  const checklist = {
    fixedLayoutUnchanged: true,
    noUnexpectedEmptySeats: true,
    noLeftRightConflicts: true,
    noDiagonalConflicts: true,
    allStudentsUnique: true,
    equalOccupancy: true,
  };
  const violations: string[] = [];

  // 1. Fixed layouts unchanged
  if (room.seats.length !== room.capacity) {
    checklist.fixedLayoutUnchanged = false;
    violations.push(
      `Layout altered: total physical seats (${room.seats.length}) does not match configured capacity (${room.capacity})`
    );
  }

  // Group seats by row
  const rowMap = new Map<number, SeatAssignment[]>();
  room.seats.forEach((s) => {
    if (!rowMap.has(s.row)) rowMap.set(s.row, []);
    rowMap.get(s.row)!.push(s);
  });

  const rows = Array.from(rowMap.keys()).sort((a, b) => a - b);
  const rowSeatsList: SeatAssignment[][] = [];
  const maxRow = rows.length > 0 ? Math.max(...rows) + 1 : 0;

  for (let r = 0; r < maxRow; r++) {
    const rSeats = (rowMap.get(r) || []).sort((a, b) => {
      if (a.col !== b.col) return a.col - b.col;
      return a.seat_index - b.seat_index;
    });
    rowSeatsList.push(rSeats);
  }

  // 2. No unexpected empty seats
  const sortedPhysicalSeats = [...room.seats].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    if (a.col !== b.col) return a.col - b.col;
    return a.seat_index - b.seat_index;
  });

  const expectedAssigned = room.assigned;
  for (let i = 0; i < sortedPhysicalSeats.length; i++) {
    const s = sortedPhysicalSeats[i];
    if (i < expectedAssigned) {
      if (s.is_empty || !s.roll_number) {
        checklist.noUnexpectedEmptySeats = false;
        violations.push(
          `Unexpected empty seat at R${s.row + 1} C${s.col + 1} ${s.seat_label || ''} (active seat slot empty)`
        );
      }
    } else {
      if (!s.is_empty && s.roll_number) {
        checklist.noUnexpectedEmptySeats = false;
        violations.push(
          `Unexpected student ${s.roll_number} placed at end-of-hall unused seat R${s.row + 1} C${s.col + 1}`
        );
      }
    }
  }

  // 3. Horizontal anti-copying (No same-subject left/right)
  for (let r = 0; r < maxRow; r++) {
    const rSeats = rowSeatsList[r];
    for (let i = 0; i < rSeats.length - 1; i++) {
      const s1 = rSeats[i];
      const s2 = rSeats[i + 1];
      if (!s1.is_empty && !s2.is_empty && s1.roll_number && s2.roll_number) {
        const k1 = getSubjKey(s1, treatDifferentMediumAsDifferentPaper);
        const k2 = getSubjKey(s2, treatDifferentMediumAsDifferentPaper);
        if (k1 && k2 && k1 === k2) {
          checklist.noLeftRightConflicts = false;
          violations.push(
            `R${s1.row + 1} C${s1.col + 1} ${s1.seat_label || ''} and R${s2.row + 1} C${s2.col + 1} ${s2.seat_label || ''}: ${s1.roll_number} next to ${s2.roll_number} (Left/Right conflict)`
          );
        }
      }
    }
  }

  // 4. Diagonal anti-copying (No same-subject diagonal)
  const seatByRj = new Map<string, SeatAssignment>();
  for (let r = 0; r < maxRow; r++) {
    rowSeatsList[r].forEach((s, j) => {
      seatByRj.set(`${r}-${j}`, s);
    });
  }

  for (let r = 0; r < maxRow; r++) {
    const rSeats = rowSeatsList[r];
    for (let j = 0; j < rSeats.length; j++) {
      const s1 = rSeats[j];
      if (s1.is_empty || !s1.roll_number) continue;
      const k1 = getSubjKey(s1, treatDifferentMediumAsDifferentPaper);

      if (r + 1 < maxRow) {
        for (const pj of [j - 1, j + 1]) {
          const s2 = seatByRj.get(`${r + 1}-${pj}`);
          if (s2 && !s2.is_empty && s2.roll_number) {
            const k2 = getSubjKey(s2, treatDifferentMediumAsDifferentPaper);
            if (k1 && k2 && k1 === k2) {
              checklist.noDiagonalConflicts = false;
              violations.push(
                `R${s1.row + 1} C${s1.col + 1} ${s1.seat_label || ''} and R${s2.row + 1} C${s2.col + 1} ${s2.seat_label || ''}: ${s1.roll_number} diagonal to ${s2.roll_number} (Diagonal conflict)`
              );
            }
          }
        }
      }
    }
  }

  // 5. All students seated once
  const seatedRolls = room.seats
    .filter((s) => !s.is_empty && s.roll_number)
    .map((s) => s.roll_number!);
  const uniqueRolls = new Set(seatedRolls);
  if (seatedRolls.length !== uniqueRolls.size) {
    checklist.allStudentsUnique = false;
    violations.push(`Duplicate students seated on grid`);
  }

  // 6. Equal occupancy (across halls, occupancy % differs by at most 5%)
  if (allRooms && allRooms.length > 1) {
    const pcts = allRooms.map((r) => r.utilization_pct);
    const minPct = Math.min(...pcts);
    const maxPct = Math.max(...pcts);
    if (maxPct - minPct > 5.1) {
      checklist.equalOccupancy = false;
      violations.push(
        `Unequal occupancy across halls: spans from ${minPct}% to ${maxPct}% (> 5% difference)`
      );
    }
  }

  const isValid = violations.length === 0 && Object.values(checklist).every(Boolean);
  return { isValid, checklist, violations };
}
