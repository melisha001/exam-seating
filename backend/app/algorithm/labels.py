"""
algorithm/labels.py — Standardized seat labeling across the system.

Seat labeling specification:
- Letter corresponds to position within the bench (0 -> 'A', 1 -> 'B', 2 -> 'C')
- Number corresponds to bench number (1-indexed, ordered row by row):
    bench = row * cols + col + 1
- Examples:
  - 1-seater bench: A1, A2, A3, ...
  - 2-seater bench: A1, B1, A2, B2, ...
  - 3-seater bench: A1, B1, C1, A2, B2, C2, ...
"""

POS_LETTERS = ("A", "B", "C", "D", "E")


def get_seat_label(row: int, col: int, seat_index: int, cols: int) -> str:
    """
    Compute standard seat label (e.g. A1, B1, C1).
    """
    bench_num = row * cols + col + 1
    pos_letter = POS_LETTERS[seat_index] if seat_index < len(POS_LETTERS) else chr(ord("A") + seat_index)
    return f"{pos_letter}{bench_num}"


def parse_seat_label(label: str, cols: int) -> tuple[int, int, int]:
    """
    Inverse helper: parse a seat label back into (row, col, seat_index).
    """
    label = label.strip().upper()
    letter = label[0]
    bench_num = int(label[1:])
    seat_index = ord(letter) - ord("A")
    bench_0 = bench_num - 1
    row = bench_0 // cols
    col = bench_0 % cols
    return row, col, seat_index


def get_seater_breakdown(
    rows: int,
    cols: int,
    seats_per_bench: int = 2,
    bench_config: str | dict | None = None,
) -> str:
    """
    Generate readable seater breakdown string for a room layout.
    Example: 'All 2-Seaters', 'All 3-Seaters', 'All 1-Seaters', or '3S x 6 - 2S x 3 - 1S x 2'.
    """
    total_benches = rows * cols
    if total_benches <= 0:
        return "0 benches"

    cfg = {}
    if isinstance(bench_config, str):
        try:
            import json
            cfg = json.loads(bench_config)
        except Exception:
            cfg = {}
    elif isinstance(bench_config, dict):
        cfg = bench_config

    c1 = 0
    c2 = 0
    c3 = 0
    for r in range(rows):
        for c in range(cols):
            key = f"{r}-{c}"
            seats = cfg.get(key, seats_per_bench)
            if seats == 1:
                c1 += 1
            elif seats == 3:
                c3 += 1
            else:
                c2 += 1

    if c1 == total_benches:
        return "All 1-Seater" if total_benches == 1 else "All 1-Seaters"
    if c2 == total_benches:
        return "All 2-Seater" if total_benches == 1 else "All 2-Seaters"
    if c3 == total_benches:
        return "All 3-Seater" if total_benches == 1 else "All 3-Seaters"

    parts = []
    if c3 > 0:
        parts.append(f"3S x {c3}")
    if c2 > 0:
        parts.append(f"2S x {c2}")
    if c1 > 0:
        parts.append(f"1S x {c1}")
    return " - ".join(parts)

