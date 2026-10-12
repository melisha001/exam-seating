# 🎓 AutoSeat Pro — Exam Seating Arrangement System

An enterprise-grade, full-stack **Exam Seating Arrangement System** built for engineering colleges. Designed to eliminate examination malpractice through mathematically guaranteed, non-adjacent interleaving of candidate queues while maximizing hall utilization and generating official PDF/Excel reports.

---

## 🌟 Key Features

### 1. Anti-Malpractice Seating Optimization Engine
- **Constraint 1 (Same Department Separation)**: Two candidates of the same department are never seated adjacent to each other (neither on the same bench nor on direct left/right side benches).
- **Constraint 2 (Same Subject Separation)**: Candidates from different departments writing the exact same subject are prevented from adjacent seating.
- **Configurable Front/Back Toggle**: When enabled, benches directly ahead and behind in the same column are also treated as adjacent for maximum anti-cheating strictness.
- **Capacity Maximization**: Fills examination halls sequentially one-by-one so the minimum number of physical halls is used.
- **Single Department Fallback**: If only one department is scheduled, automatically inserts empty spacer seats to maintain non-adjacency, issuing clear warnings.
- **Roll Number Ordering**: Preserves student roll-number sequencing within each department.

### 2. Live Interactive Seating View & Branch-Wise Allocation
- **Realistic Bench Layout**: Visualizes examination halls with Blackboard/Podium orientation, bench columns, and seat numbers (`S1`, `S2`, `S3`).
- **Branch-Wise Allocation View**: Dedicated tab showing department-by-department breakdown of examination halls seated in, roll number ranges, seat numbers, and a complete cross-department distribution matrix.
- **Hall Header Branch Chips**: Color-coded branch chips on each hall view showing branch breakdown and seated student counts.
- **Interactive Seat Swapping**: Supports both **Click-to-Swap** and HTML5 **Drag-and-Drop**. Instant re-validation via backend API rejects any swap that would create adjacent cheating opportunities (`409 Conflict`).
- **Student Search**: Search any candidate roll number to highlight their seat with a pulsing ring and jump directly to their hall.
- **Room Carousel / Tabs**: Displays live utilization progress bars, seated vs capacity counts, and invigilator details.

### 3. Official Document Exports
- **Landscape PDF (ReportLab)**: Generates an official, print-ready landscape A4 PDF with one page per hall, full seating grid, utilization stats, invigilator signature line, and an **extra Branch-Wise Seating Allocation Summary page**.
- **Excel Workbook (openpyxl)**: Generates a multi-sheet spreadsheet with department pastel color coding, candidate roll numbers, subjects, executive summary sheet, and an **extra Branch Summary sheet**.

### 4. 5-Step Generation Wizard
- **Step 1**: Exam Date & Session slot (`FN` / `AN`).
- **Step 2**: Repeatable multi-department registration with department picker + inline "Add New Department", subject name/code, alphanumeric roll number range (`927623BCS001` → `927623BCS060`), absentees/exclusions, live auto-calculated student count, and summary table with edit/remove actions.
- **Step 3**: Select examination halls with real-time capacity vs student requirement tally.
- **Step 4**: Anti-malpractice rule configuration & Front/Back toggle.
- **Step 5**: One-click generation with visual progress and instant plan navigation.

### 5. Session & Plan Management
- **Delete Session**: Complete cascade deletion of an exam session, its exam entries, and generated seating plans with confirmation dialog.
- **Clear Plan Only**: Dedicated button and endpoint to reset the seating plan while keeping registered sessions and departments intact.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Python 3.12+ / 3.14 | FastAPI, Uvicorn, Pydantic v2 |
| **Database** | SQLite + SQLAlchemy 2.0 | Clean ORM models, cascade relationships, safe auto-migration |
| **Algorithm** | Pure Python | Round-Robin greedy interleaver + constraint graph |
| **Frontend** | React 19 + TypeScript + Vite | Tailwind CSS, Lucide React |
| **Exports** | ReportLab & OpenPyXL | Binary PDF & Excel generation |
| **Testing** | Pytest + Pytest-Asyncio | 28 automated unit tests |

---

## 📁 Project Structure

```
exam-seating/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point, CORS, lifespan
│   │   ├── config.py              # Pydantic Settings
│   │   ├── database.py            # SQLAlchemy engine, session, Base, auto-migration
│   │   ├── models/                # Room, Department, ExamSession, ExamEntry, SeatingPlan
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── crud/                  # Pure database access layers
│   │   ├── routers/               # REST API endpoints (/rooms, /departments, /sessions, /entries, /plans)
│   │   ├── services/              # PDF & Excel export generators (with branch summary)
│   │   └── algorithm/             # Pure non-adjacent seating engine & roll number utilities
│   ├── tests/
│   │   ├── test_seating.py        # Adjacency, 5+ depts, alphanumeric rolls, exclusions
│   │   └── test_api_extensions.py # Cascade delete, clear plan only, branch summary
│   ├── seed_data.py               # Database seeder (6 depts, 6 halls, 1 session, initial plan)
│   ├── demo_flow.py               # End-to-end demo script (health, plan, swap, file downloads)
│   ├── requirements.txt           # Python dependencies (native wheels)
│   └── pytest.ini                 # Pytest test configuration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Navigation header, dark mode toggle
│   │   │   ├── Dashboard.tsx      # Stat cards, sessions with Delete & Clear Plan, legend
│   │   │   ├── Wizard.tsx         # Repeatable multi-department registration wizard
│   │   │   ├── SeatingView.tsx    # Hall View vs Branch-Wise Allocation tabs
│   │   │   ├── RoomManager.tsx    # Hall & Department CRUD
│   │   │   └── seating/
│   │   │       ├── BranchView.tsx # Department-wise allocation overview & matrix table
│   │   │       ├── RoomSelector.tsx
│   │   │       ├── SeatingGrid.tsx
│   │   │       ├── BenchCard.tsx
│   │   │       └── StudentDetailDrawer.tsx
│   │   ├── services/
│   │   │   └── api.ts             # Typed API client
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── lib/utils.ts           # Styling utils & department color palette
│   │   ├── App.tsx                # Main app state orchestrator & toast system
│   │   └── index.css              # Tailwind base & CSS variables
│   ├── vite.config.ts             # Vite config with /api proxy to port 8000
│   └── tailwind.config.js         # Tailwind configuration with dark mode support
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: 3.12+ (Python 3.14 supported with pre-built binary wheels)
- **Node.js**: 18+ or 20+

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health & version probe |
| `GET/POST` | `/api/v1/rooms/` | List all halls / Create new hall |
| `GET/PUT/DELETE` | `/api/v1/rooms/{id}` | Read / Update / Delete hall |
| `GET/POST` | `/api/v1/departments/` | List all departments / Register department |
| `GET/PUT/DELETE` | `/api/v1/departments/{id}` | Read / Update / Delete department |
| `GET/POST` | `/api/v1/sessions/` | List exam sessions / Create exam session |
| `GET/PUT/DELETE` | `/api/v1/sessions/{id}` | Read / Update / Delete session (cascades entries & plans) |
| `GET/POST` | `/api/v1/entries/?session_id={id}` | List / Add exam entries for a session |
| `PUT/DELETE` | `/api/v1/entries/{id}` | Update / Remove exam entry |
| `POST` | `/api/v1/plans/generate` | **Execute seating optimization engine** |
| `GET` | `/api/v1/plans/session/{id}` | Retrieve generated seating plan by session |
| `DELETE` | `/api/v1/plans/session/{id}` | **Clear seating plan only** (keeps session & entries) |
| `GET` | `/api/v1/plans/{id}/summary` | **Get branch-wise allocation breakdown & matrix** |
| `PUT` | `/api/v1/plans/{id}/swap` | **Swap two seats with live constraint re-validation** |
| `GET` | `/api/v1/plans/{id}/export/pdf` | **Download official Landscape A4 PDF** (with branch summary) |
| `GET` | `/api/v1/plans/{id}/export/excel` | **Download official Excel workbook** (with branch summary) |

---

## 🏛️ Examination Hall Model

Each examination hall is structured as a 3D coordinate space:
$$\text{Seat Position} = (\text{row}, \text{col}, \text{seat\_index})$$

- $\text{row} \in [0, \text{rows} - 1]$
- $\text{col} \in [0, \text{columns} - 1]$ (each column represents a bench)
- $\text{seat\_index} \in [0, \text{seats\_per\_bench} - 1]$ (where $\text{seats\_per\_bench} \in \{1, 2, 3\}$)

$$\text{Total Capacity} = \text{rows} \times \text{columns} \times \text{seats\_per\_bench}$$

---

## 🔒 Security & Anti-Malpractice Rules

1. **Same-Department Adjacency**:
   $$\text{dept}(s_1) = \text{dept}(s_2) \implies s_2 \notin \text{Neighbors}(s_1)$$
2. **Same-Subject Adjacency**:
   $$\text{subject}(s_1) = \text{subject}(s_2) \implies s_2 \notin \text{Neighbors}(s_1)$$
3. **Manual Seat Swap Safety**:
   When an administrator swaps two candidates via the UI, the backend validates the entire neighborhood of both seats. If either swap creates a violation, the API responds with `409 Conflict` and a list of specific violations, preventing unauthorized seat exchanges.

---

## 📄 License
MIT License. Built for Engineering College Examination Cells.
