"""
algorithm/roll_numbers.py — Roll-number expansion and generation utilities.

Supports alphanumeric roll numbers with a numeric suffix, e.g.:
    "21CSE001" → "21CSE060"           expands to  ["21CSE001", ..., "21CSE060"]
    "927623BCS001" → "927623BCS060"   expands to  ["927623BCS001", ..., "927623BCS060"]

Also supports optional excluded roll numbers (absentees).
If no range is given, synthetic rolls are generated as  <CODE>0001, <CODE>0002, …
"""

import re


def expand_roll_range(
    roll_start: str,
    roll_end: str,
    exclusions: list[str] | set[str] | None = None,
) -> list[str]:
    """
    Expand a roll-number range into an ordered list.

    Parses a trailing numeric suffix from both ends. The prefix and zero-padding
    width of roll_start are preserved throughout the expansion.
    Excludes any rolls present in `exclusions`.

    Falls back to [roll_start, roll_end] if either string has no numeric suffix
    or the prefixes don't match.

    Examples
    --------
    >>> expand_roll_range("21CSE001", "21CSE005")
    ['21CSE001', '21CSE002', '21CSE003', '21CSE004', '21CSE005']
    >>> expand_roll_range("927623BCS001", "927623BCS005", ["927623BCS003"])
    ['927623BCS001', '927623BCS002', '927623BCS004', '927623BCS005']
    """
    s_clean = roll_start.strip()
    e_clean = roll_end.strip()

    ex_set = set(e.strip() for e in exclusions if e and e.strip()) if exclusions else set()

    pattern = re.compile(r"^(.*?)(\d+)$")
    m_s = pattern.match(s_clean)
    m_e = pattern.match(e_clean)

    if m_s and m_e and m_s.group(1) == m_e.group(1):
        prefix = m_s.group(1)
        width = len(m_s.group(2))       # preserve leading-zero width
        start = int(m_s.group(2))
        end = int(m_e.group(2))
        if start <= end:
            all_rolls = [f"{prefix}{str(i).zfill(width)}" for i in range(start, end + 1)]
            if ex_set:
                all_rolls = [r for r in all_rolls if r not in ex_set]
            return all_rolls

    # Fallback: treat both as atomic tokens
    res = [s_clean, e_clean]
    if ex_set:
        res = [r for r in res if r not in ex_set]
    return res


def generate_rolls(
    dept_code: str,
    count: int,
    roll_start: str | None = None,
    roll_end: str | None = None,
    exclusions: list[str] | None = None,
) -> list[str]:
    """
    Return exactly `count` ordered roll numbers for a department.

    Priority:
    1. Expand the given roll_start/roll_end range (filtering out exclusions) and take the first `count`.
    2. If the range yields fewer entries than `count`, synthetic extras are appended.
    3. If no range is given, generate "<CODE>0001", "<CODE>0002", …
    """
    if count <= 0:
        return []

    if roll_start and roll_end:
        rolls = expand_roll_range(roll_start, roll_end, exclusions=exclusions)
        if len(rolls) < count:
            # Pad with synthetic extras so student_count is always honoured
            extras = [f"{dept_code}-X{i + 1}" for i in range(count - len(rolls))]
            rolls = rolls + extras
        return rolls[:count]

    # No range supplied — generate synthetic sequential roll numbers
    ex_set = set(e.strip() for e in exclusions if e and e.strip()) if exclusions else set()
    all_gen: list[str] = []
    idx = 1
    while len(all_gen) < count:
        cand = f"{dept_code}{idx:04d}"
        if cand not in ex_set:
            all_gen.append(cand)
        idx += 1
    return all_gen
