"""
services/export_excel.py — Generate an Excel seating plan using openpyxl.

One sheet per room.  Each cell = one physical seat.
Cells are colour-coded by department with roll number + department code.
A summary sheet lists rooms, utilisation, and warnings.
"""

from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, numbers
)
from openpyxl.utils import get_column_letter

from app.models.seating_plan import SeatingPlan, SeatAssignment
from app.models.room import Room


# Hex fills per department (no leading #, openpyxl uses AARRGGBB or RRGGBB)
_DEPT_FILLS = [
    "DBEAFE", "DCFCE7", "FEF9C3", "FCE7F3", "EDE9FE",
    "FFEDD5", "CFFAFE", "F0FDF4", "FEF2F2", "F5F3FF",
]
_EMPTY_FILL = "F3F4F6"
_HEADER_FILL = "1E3A5F"   # dark blue
_HEADER_FONT_COLOR = "FFFFFF"

_thin = Side(style="thin", color="AAAAAA")
_border = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)


def _make_fill(hex_colour: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_colour)


def _dept_fill(dept_id: int | None) -> PatternFill:
    if dept_id is None:
        return _make_fill(_EMPTY_FILL)
    return _make_fill(_DEPT_FILLS[(dept_id - 1) % len(_DEPT_FILLS)])


def generate_excel(
    plan: SeatingPlan,
    rooms: list[Room],
    seats_by_room: dict[int, list[SeatAssignment]],
) -> bytes:
    """
    Build an Excel workbook and return it as bytes.
    """
    wb = Workbook()
    wb.remove(wb.active)   # remove default blank sheet

    # ── Per-room sheets ───────────────────────────────────────────────────────
    for room in rooms:
        room_seats = seats_by_room.get(room.id, [])
        if not room_seats:
            continue

        ws = wb.create_sheet(title=room.name[:31])   # sheet name ≤31 chars
        spb = room.seats_per_bench

        # Header rows
        invig = room.invigilator_name or "—"
        used = sum(1 for s in room_seats if not s.is_empty)
        cap = room.capacity
        util = f"{round(used / cap * 100, 1)}%" if cap else "—"

        ws.merge_cells(start_row=1, start_column=1,
                       end_row=1, end_column=room.columns * spb)
        h1 = ws.cell(1, 1,
                     f"Room: {room.name}  |  Invigilator: {invig}  |  "
                     f"Seated: {used}/{cap}  |  Utilisation: {util}")
        h1.font = Font(bold=True, color=_HEADER_FONT_COLOR, size=11)
        h1.fill = _make_fill(_HEADER_FILL)
        h1.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 22

        # Column width
        col_w = 14
        for c in range(1, room.columns * spb + 1):
            ws.column_dimensions[get_column_letter(c)].width = col_w

        # Seat grid (data rows start at row 3; row 2 = bench column headers)
        for c in range(room.columns):
            for si in range(spb):
                col_idx = c * spb + si + 1
                label = f"Bench {c + 1}" + (f" (seat {si + 1})" if spb > 1 else "")
                hdr = ws.cell(2, col_idx, label)
                hdr.font = Font(bold=True, size=9)
                hdr.alignment = Alignment(horizontal="center")
                hdr.fill = _make_fill("E2E8F0")

        grid: dict[tuple, SeatAssignment] = {
            (s.row, s.col, s.seat_index): s for s in room_seats
        }

        for r in range(room.rows):
            excel_row = r + 3
            ws.row_dimensions[excel_row].height = 34
            for c in range(room.columns):
                for si in range(spb):
                    seat = grid.get((r, c, si))
                    col_idx = c * spb + si + 1
                    cell = ws.cell(excel_row, col_idx)

                    if seat and not seat.is_empty:
                        cell.value = (
                            f"{seat.roll_number or ''}\n"
                            f"{seat.subject[:12] if seat.subject else ''}"
                        )
                        cell.fill = _dept_fill(seat.department_id)
                    else:
                        cell.value = ""
                        cell.fill = _make_fill(_EMPTY_FILL)

                    cell.alignment = Alignment(
                        horizontal="center", vertical="center", wrap_text=True
                    )
                    cell.border = _border
                    cell.font = Font(size=8)

        # Row numbers in leftmost helper column
        for r in range(room.rows):
            helper = ws.cell(r + 3, room.columns * spb + 1, f"Row {r + 1}")
            helper.font = Font(size=8, color="888888")
            helper.alignment = Alignment(horizontal="left", vertical="center")

        # Signature row
        sig_row = room.rows + 4
        ws.merge_cells(start_row=sig_row, start_column=1,
                       end_row=sig_row, end_column=room.columns * spb)
        sig = ws.cell(sig_row, 1,
                      f"Invigilator Signature: ________________________  "
                      f"Date: _______________  Room: {room.name}")
        sig.font = Font(size=9, italic=True, color="444444")
        sig.alignment = Alignment(horizontal="left")

    # ── Summary sheet ─────────────────────────────────────────────────────────
    ws_sum = wb.create_sheet(title="Summary", index=0)
    ws_sum.column_dimensions["A"].width = 20
    ws_sum.column_dimensions["B"].width = 16
    ws_sum.column_dimensions["C"].width = 16
    ws_sum.column_dimensions["D"].width = 16

    headers = ["Room", "Capacity", "Seated", "Utilisation"]
    for ci, h in enumerate(headers, 1):
        c = ws_sum.cell(1, ci, h)
        c.font = Font(bold=True, color=_HEADER_FONT_COLOR)
        c.fill = _make_fill(_HEADER_FILL)
        c.alignment = Alignment(horizontal="center")

    for ri, room in enumerate(rooms, 2):
        room_seats = seats_by_room.get(room.id, [])
        used = sum(1 for s in room_seats if not s.is_empty)
        cap = room.capacity
        ws_sum.cell(ri, 1, room.name)
        ws_sum.cell(ri, 2, cap)
        ws_sum.cell(ri, 3, used)
        ws_sum.cell(ri, 4, f"{round(used / cap * 100, 1)}%" if cap else "—")

    # Warnings
    warn_start = len(rooms) + 3
    ws_sum.cell(warn_start, 1, "Warnings").font = Font(bold=True)
    for i, w in enumerate(plan.warnings, warn_start + 1):
        cell = ws_sum.cell(i, 1, w)
        ws_sum.merge_cells(
            start_row=i, start_column=1, end_row=i, end_column=4
        )
        cell.alignment = Alignment(wrap_text=True)
        ws_sum.row_dimensions[i].height = 30
        if w.startswith("ERROR"):
            cell.font = Font(color="DC2626", size=9)
        elif w.startswith("WARNING"):
            cell.font = Font(color="D97706", size=9)
        else:
            cell.font = Font(color="6B7280", size=9)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
