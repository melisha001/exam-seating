"""Phase 3 smoke test"""
import httpx, json

BASE = 'http://localhost:8000/api/v1'

# ── Seed data ──────────────────────────────────────────────────────────────
depts = {}
for name, code in [
    ('Computer Science','CSE'),
    ('Electronics','ECE'),
    ('Mechanical','MECH'),
    ('Civil','CIVIL'),
]:
    r = httpx.post(f'{BASE}/departments/', json={'name': name, 'code': code})
    data = r.json()
    depts[code] = data.get('id') or data
    print(f'Dept {code}: {r.status_code} id={depts[code]}')

rooms = {}
for rname, rows, cols, spb, invig in [
    ('Hall A', 8, 5, 2, 'Dr. Ramesh'),
    ('Hall B', 6, 5, 2, 'Dr. Priya'),
]:
    r = httpx.post(f'{BASE}/rooms/', json={
        'name': rname, 'rows': rows, 'columns': cols,
        'seats_per_bench': spb, 'invigilator_name': invig
    })
    data = r.json()
    rooms[rname] = data['id']
    print(f'Room {rname}: status={r.status_code} id={data["id"]} cap={data["capacity"]}')

r = httpx.post(f'{BASE}/sessions/', json={'date': '2025-05-15', 'label': 'FN'})
sess_data = r.json()
sess_id = sess_data.get('id') or sess_data
print(f'Session: {r.status_code} id={sess_id}')

entries_payload = [
    ('CSE',  'Data Structures',    40, '21CSE001',   '21CSE040'),
    ('ECE',  'Analog Circuits',    35, '21ECE001',   '21ECE035'),
    ('MECH', 'Fluid Mechanics',    30, '21MECH001',  '21MECH030'),
    ('CIVIL','Structural Analysis',25, '21CIVIL001', '21CIVIL025'),
]
for code, subj, count, rs, re in entries_payload:
    dept_id = depts[code]
    if isinstance(dept_id, dict):
        dept_id = dept_id['id']
    r = httpx.post(f'{BASE}/entries/', json={
        'session_id': sess_id if isinstance(sess_id, int) else sess_id['id'],
        'department_id': dept_id,
        'subject': subj, 'student_count': count,
        'roll_start': rs, 'roll_end': re
    })
    print(f'Entry {code}: {r.status_code}')

# Normalise sess_id
if isinstance(sess_id, dict):
    sess_id = sess_id['id']

# ── Generate plan ─────────────────────────────────────────────────────────
room_ids = [rooms['Hall A'], rooms['Hall B']]
r = httpx.post(f'{BASE}/plans/generate', json={
    'session_id': sess_id,
    'room_ids': room_ids,
    'check_front_back': True
}, timeout=30)
print(f'Generate: {r.status_code}')
if r.status_code >= 400:
    print(r.text)
else:
    plan = r.json()
    plan_id = plan['plan_id']
    print(f'  plan_id={plan_id}')
    print(f'  rooms_used={plan["rooms_used"]}')
    print(f'  total_assigned={plan["total_assigned"]}')
    print(f'  unseated_count={plan["unseated_count"]}')
    print(f'  warnings={plan["warnings"]}')
    for rg in plan['rooms']:
        print(f'  {rg["room_name"]}: {rg["assigned"]}/{rg["capacity"]} = {rg["utilization_pct"]}%')

    # ── GET plan ──────────────────────────────────────────────────────────────
    r2 = httpx.get(f'{BASE}/plans/session/{sess_id}')
    print(f'GET plan: {r2.status_code} plan_id={r2.json()["plan_id"]}')

    # ── Export checks ─────────────────────────────────────────────────────────
    r_pdf = httpx.get(f'{BASE}/plans/{plan_id}/export/pdf', timeout=30)
    ct = r_pdf.headers.get('content-type', '')
    print(f'PDF export: {r_pdf.status_code} bytes={len(r_pdf.content)} ct={ct}')

    r_xlsx = httpx.get(f'{BASE}/plans/{plan_id}/export/excel', timeout=30)
    print(f'Excel export: {r_xlsx.status_code} bytes={len(r_xlsx.content)}')

    # ── Swap test ─────────────────────────────────────────────────────────────
    seats = plan['rooms'][0]['seats']
    filled = [s for s in seats if not s['is_empty']]
    if len(filled) >= 2:
        s1, s2 = filled[0]['id'], filled[1]['id']
        r_swap = httpx.put(f'{BASE}/plans/{plan_id}/swap',
                           json={'seat_id_a': s1, 'seat_id_b': s2})
        print(f'Swap: {r_swap.status_code} {r_swap.json()}')

    print('ALL PHASE 3 CHECKS DONE')
