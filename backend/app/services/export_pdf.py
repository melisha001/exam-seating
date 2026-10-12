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
        invig = room.invigilator_name or "—"
        used = sum(1 for s in room_seats if not s.is_empty)
        cap = room.capacity
        util = f"{round(used / cap * 100, 1)}%" if cap else "—"

        story.append(Paragraph(f"Room: {room.name}", heading))
        story.append(Paragraph(
            f"Invigilator: {invig}  |  Capacity: {cap}  |  "
            f"Seated: {used}  |  Utilisation: {util}",
            sub,
        ))
        story.append(Spacer(1, 4 * mm))

        # ── Seat grid ─────────────────────────────────────────────────────────
        # Build a dict for O(1) lookup
        grid: dict[tuple, SeatAssignment] = {
            (s.row, s.col, s.seat_index): s for s in room_seats
        }

        spb = room.seats_per_bench
        # One table cell = one physical seat
        # Layout: rows × (cols * seats_per_bench)
        table_data = []
        cell_styles: list = []

        for r in range(room.rows):
            row_cells = []
            for c in range(room.columns):
                for si in range(spb):
                    seat = grid.get((r, c, si))
                    if seat and not seat.is_empty:
                        text = f"{seat.roll_number or ''}\n{seat.subject[:8] if seat.subject else ''}"
                        bg = _dept_colour(seat.department_id)
                    else:
                        text = ""
                        bg = _EMPTY_COLOUR

                    col_idx = c * spb + si
                    cell_styles.append(("BACKGROUND", (col_idx, r), (col_idx, r), bg))
                    row_cells.append(Paragraph(text, body))
            table_data.append(row_cells)

        if not table_data:
            story.append(Paragraph("(no seats)", sub))
        else:
            total_cols = room.columns * spb
            col_width = min(2.8 * cm, (landscape(A4)[0] - 3 * cm) / total_cols)
            t = Table(table_data, colWidths=[col_width] * total_cols, rowHeights=1.4 * cm)
            base_style = [
                ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
            t.setStyle(TableStyle(base_style + cell_styles))
            story.append(t)

        # ── Signature line ────────────────────────────────────────────────────
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph(
            f"Invigilator Signature: ________________________  "
            f"Date: _______________  Room: {room.name}",
            sub,
        ))
        story.append(Spacer(1, 8 * mm))

    # ── Warnings page ─────────────────────────────────────────────────────────
    if plan.warnings:
        story.append(Paragraph("Warnings / Notes", heading))
        for w in plan.warnings:
            story.append(Paragraph(f"• {w}", body))
            story.append(Spacer(1, 2 * mm))

    doc.build(story)
    return buf.getvalue()
