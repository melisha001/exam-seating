"""
algorithm/adjacency.py — Seat adjacency logic.

Adjacency definition (matches the physical exam-hall setup):

  A seat at (row, col, seat_index) is adjacent to:
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. All other seats on the SAME bench    → (row, col,  s ≠ si)  │
  │ 2. All seats on the LEFT bench           → (row, col-1, *)      │
  │ 3. All seats on the RIGHT bench          → (row, col+1, *)      │
  │ 4. [configurable] All seats on the bench DIRECTLY IN FRONT      │
  │    and DIRECTLY BEHIND                   → (row±1, col, *)      │
  └─────────────────────────────────────────────────────────────────┘

The front/back toggle is passed by the caller; this module is stateless.
"""


def get_neighbors(
    row: int,
    col: int,
    seat_index: int,
    rows: int,
    cols: int,
    seats_per_bench: int,
    check_front_back: bool = True,
) -> list[tuple[int, int, int]]:
    """
    Return all (row, col, seat_index) tuples adjacent to the given seat.

    Parameters
    ----------
    row, col, seat_index : position of the seat being checked
    rows, cols           : room dimensions (number of benches)
    seats_per_bench      : seats on each bench (1, 2, or 3)
    check_front_back     : include the bench directly ahead and behind

    Returns
    -------
    List of (row, col, seat_index) tuples — no duplicates, never the input itself.
    """
    neighbors: list[tuple[int, int, int]] = []

    # ── 1. Same bench, other seats ────────────────────────────────────────────
    for s in range(seats_per_bench):
        if s != seat_index:
            neighbors.append((row, col, s))

    # ── 2 & 3. Left and right benches ─────────────────────────────────────────
    for dc in (-1, 1):
        nc = col + dc
        if 0 <= nc < cols:
            for s in range(seats_per_bench):
                neighbors.append((row, nc, s))

    # ── 4. Front and back benches (configurable) ──────────────────────────────
    if check_front_back:
        for dr in (-1, 1):
            nr = row + dr
            if 0 <= nr < rows:
                for s in range(seats_per_bench):
                    neighbors.append((nr, col, s))

    return neighbors
