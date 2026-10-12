"""
algorithm/roll_numbers.py — Roll-number expansion and generation utilities.

Supports alphanumeric roll numbers with a numeric suffix, e.g.:
    "21CSE001" → "21CSE060"  expands to  ["21CSE001", ..., "21CSE060"]

If no range is given, synthetic rolls are generated as  <CODE>0001, <CODE>0002, …
"""

import re


def expand_roll_range(roll_start: str, roll_end: str) -> list[str]:
    """
    Expand a roll-number range into an ordered list.

    Parses a trailing numeric suffix from both ends.  The prefix and zero-padding
    width of roll_start are preserved throughout the expansion.

    Falls back to [roll_start, roll_end] if either string has no numeric suffix
    or the prefixes don't match.

    Examples
    --------
    >>> expand_roll_range("21CSE001", "21CSE005")
    ['21CSE001', '21CSE002', '21CSE003', '21CSE004', '21CSE005']
    >>> expand_roll_range("001", "004")
    ['001', '002', '003', '004']
    """
    pattern = re.compile(r"^(.*?)(\d+)$")
    m_s = pattern.match(roll_start)
    m_e = pattern.match(roll_end)

    if m_s and m_e and m_s.group(1) == m_e.group(1):
        prefix = m_s.group(1)
        width = len(m_s.group(2))       # preserve leading-zero width
        start = int(m_s.group(2))
        end = int(m_e.group(2))
        if start <= end:
            return [f"{prefix}{str(i).zfill(width)}" for i in range(start, end + 1)]

    # Fallback: treat both as atomic tokens
    return [roll_start, roll_end]


def generate_rolls(
    dept_code: str,
    count: int,
    roll_start: str | None = None,
    roll_end: str | None = None,
) -> list[str]:
    """
    Return exactly `count` ordered roll numbers for a department.

    Priority:
    1. Expand the given roll_start/roll_end range and take the first `count`.
    2. If the range yields fewer entries than `count`, synthetic extras are appended.
    3. If no range is given, generate  "<CODE>0001", "<CODE>0002", …

    Examples
    --------
    >>> generate_rolls("CSE", 3, "21CSE001", "21CSE010")
    ['21CSE001', '21CSE002', '21CSE003']
    >>> generate_rolls("EEE", 3)
    ['EEE0001', 'EEE0002', 'EEE0003']
    """
    if roll_start and roll_end:
        rolls = expand_roll_range(roll_start, roll_end)
        if len(rolls) < count:
            # Pad with synthetic extras so student_count is always honoured
            extras = [f"{dept_code}-X{i + 1}" for i in range(count - len(rolls))]
            rolls = rolls + extras
        return rolls[:count]

    # No range supplied — generate synthetic sequential roll numbers
    return [f"{dept_code}{i + 1:04d}" for i in range(count)]
