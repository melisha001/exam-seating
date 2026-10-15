"""
services/export_pdf.py — Generate a PDF seating plan using ReportLab.

One page per room.  Each page shows:
  • Room name, invigilator, utilisation bar
  • Bench grid with student roll numbers and department codes
  • Signature line at the bottom
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)

from app.models.seating_plan import SeatingPlan, SeatAssignment
from app.models.room import Room


# Department colour palette (cycles if >10 depts)
_DEPT_COLOURS = [
    colors.HexColor("#DBEAFE"),  # blue-100
    colors.HexColor("#DCFCE7"),  # green-100
    colors.HexColor("#FEF9C3"),  # yellow-100
    colors.HexColor("#FCE7F3"),  # pink-100
    colors.HexColor("#EDE9FE"),  # violet-100
    colors.HexColor("#FFEDD5"),  # orange-100
    colors.HexColor("#CFFAFE"),  # cyan-100
    colors.HexColor("#F0FDF4"),  # emerald-100
    colors.HexColor("#FEF2F2"),  # red-100
    colors.HexColor("#F5F3FF"),  # purple-100
]
_EMPTY_COLOUR = colors.HexColor("#F3F4F6")   # gray-100


def _dept_colour(dept_id: int | None) -> colors.Color:
    if dept_id is None:
        return _EMPTY_COLOUR
    return _DEPT_COLOURS[(dept_id - 1) % len(_DEPT_COLOURS)]


def generate_pdf(
    plan: SeatingPlan,
    rooms: list[Room],
    seats_by_room: dict[int, list[SeatAssignment]],
) -> bytes:
    """
    Build a PDF and return it as bytes.

    Parameters
    ----------
    plan          : the SeatingPlan ORM object (for metadata)
    rooms         : Room objects in the order they appear in the plan
    seats_by_room : {room_id → sorted list of SeatAssignment}
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
        title="Exam Seating Plan",
    )
    styles = getSampleStyleSheet()
    heading = ParagraphStyle("heading", parent=styles["Heading1"], fontSize=14, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    body = styles["Normal"]
    body.fontSize = 8

    story = []

    for room in rooms:
        room_seats = seats_by_room.get(room.id, [])
        if not room_seats:
            continue

        # ── Room header ───────────────────────────────────────────────────────
        invig1_str = room.invigilator_name or "—"
        if room.invigilator1_subject:
            invig1_str += f" ({room.invigilator1_subject})"
        invig2_str = room.invigilator2_name or "—"
        if room.invigilator2_subject:
            invig2_str += f" ({room.invigilator2_subject})"

        used = sum(1 for s in room_seats if not s.is_empty)
        cap = room.capacity
        util = f"{round(used / cap * 100, 1)}%" if cap else "—"
        breakdown_str = f" ({room.seater_breakdown})" if getattr(room, "seater_breakdown", None) else ""

        story.append(Paragraph(f"Hall: {room.name} — {cap} seats{breakdown_str}", heading))
        story.append(Paragraph(
            f"Hall In-Charge 1: <b>{invig1_str}</b>  |  Hall In-Charge 2: <b>{invig2_str}</b><br/>"
            f"Capacity: {cap}  |  Seated: {used}  |  Utilisation: {util}",
            sub,
        ))
        story.append(Spacer(1, 4 * mm))

        # ── Seat grid ─────────────────────────────────────────────────────────
        grid: dict[tuple, SeatAssignment] = {
            (s.row, s.col, s.seat_index): s for s in room_seats
        }

        max_spb = max(
            (room.get_bench_seats(r, c) for r in range(room.rows) for c in range(room.columns)),
            default=room.seats_per_bench,
        )
        table_data = []
        cell_styles: list = []

        from app.algorithm.labels import get_seat_label

        for r in range(room.rows):
            row_cells = []
            for c in range(room.columns):
                bench_seats = room.get_bench_seats(r, c)
                for si in range(max_spb):
                    col_idx = c * max_spb + si
                    if si < bench_seats:
                        seat = grid.get((r, c, si))
                        lbl = (seat.seat_label if seat and seat.seat_label else get_seat_label(r, c, si, room.columns))
                        if seat and not seat.is_empty:
                            d_code = seat.department.code if seat.department else (f"D{seat.department_id}" if seat.department_id else "")
                            med = f" ({seat.medium})" if getattr(seat, "medium", None) else ""
                            arr_badge = " [ARR]" if seat.is_arrear else ""
                            text = f"<b>{lbl}</b><br/>{seat.roll_number or ''}{arr_badge}<br/>{d_code}{med}"
                            bg = _dept_colour(seat.department_id)
                        else:
                            text = f"<font color='#999999'>{lbl}</font><br/>Unused"
                            bg = _EMPTY_COLOUR
                        cell_styles.append(("BACKGROUND", (col_idx, r), (col_idx, r), bg))
                        row_cells.append(Paragraph(text, body))
                    else:
                        # Non-existent seat in this bench for mixed layout
                        cell_styles.append(("BACKGROUND", (col_idx, r), (col_idx, r), colors.white))
                        row_cells.append(Paragraph("<font color='#cccccc'>—</font>", body))
            table_data.append(row_cells)

        if not table_data:
            story.append(Paragraph("(no seats)", sub))
        else:
            total_cols = room.columns * max_spb
            col_width = min(2.8 * cm, (landscape(A4)[0] - 3 * cm) / total_cols)
            t = Table(table_data, colWidths=[col_width] * total_cols, rowHeights=1.5 * cm)
            base_style = [
                ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
            t.setStyle(TableStyle(base_style + cell_styles))
            story.append(t)

        # ── Student List Table for this Hall ──────────────────────────────────
        seated_in_hall = [s for s in room_seats if not s.is_empty]
        if seated_in_hall:
            story.append(Spacer(1, 4 * mm))
            hall_tbl_hdr = [["Seat", "Roll Number", "Department", "Medium", "Subject", "Type"]]
            for s in seated_in_hall:
                lbl = s.seat_label or get_seat_label(s.row, s.col, s.seat_index, room.columns)
                d_code = s.department.code if s.department else (f"Dept {s.department_id}" if s.department_id else "—")
                s_med = getattr(s, "medium", "EN") or "EN"
                s_type = "Arrear" if s.is_arrear else "Regular"
                subj = s.subject_code or s.subject or "—"
                hall_tbl_hdr.append([lbl, s.roll_number or "—", d_code, s_med, subj, s_type])

            list_t = Table(hall_tbl_hdr, colWidths=[2 * cm, 4 * cm, 2.5 * cm, 2 * cm, 5.5 * cm, 2 * cm])
            list_t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(list_t)

        # ── Signature line ────────────────────────────────────────────────────
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph(
            f"Invigilator 1 Signature: ________________________  "
            f"Invigilator 2 Signature: ________________________  "
            f"Date: _______________  Hall: {room.name}",
            sub,
        ))
        story.append(Spacer(1, 8 * mm))

    # ── Branch-wise Allocation Summary Page ──────────────────────────────────
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Branch-Wise Seating Allocation Summary", heading))
    story.append(Spacer(1, 3 * mm))

    summary_rows = [["Department", "Subject", "Hall", "Roll Range", "Candidates"]]
    for r in rooms:
        if not r:
            continue
        r_seats = seats_by_room.get(r.id, [])
        dept_ids = sorted(list({s.department_id for s in r_seats if not s.is_empty and s.department_id}))
        for d_id in dept_ids:
            dept_seats = [s for s in r_seats if s.department_id == d_id and not s.is_empty]
            dept_seats.sort(key=lambda s: (s.row, s.col, s.seat_index))
            d_code = dept_seats[0].department.code if (dept_seats[0].department) else f"Dept {d_id}"
            subj = dept_seats[0].subject or "Exam"
            rolls = [s.roll_number for s in dept_seats if s.roll_number]
            r_range = f"{rolls[0]} - {rolls[-1]}" if len(rolls) > 1 else (rolls[0] if rolls else "-")
            summary_rows.append([d_code, subj, r.name, r_range, str(len(rolls))])

    if len(summary_rows) > 1:
        sum_table = Table(summary_rows, colWidths=[3 * cm, 6 * cm, 4 * cm, 7 * cm, 2.5 * cm])
        sum_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
        ]))
        story.append(sum_table)
        story.append(Spacer(1, 8 * mm))

    # ── Warnings page ─────────────────────────────────────────────────────────
    if plan.warnings:
        story.append(Paragraph("Warnings / Notes", heading))
        for w in plan.warnings:
            story.append(Paragraph(f"• {w}", body))
            story.append(Spacer(1, 2 * mm))

    doc.build(story)
    return buf.getvalue()
