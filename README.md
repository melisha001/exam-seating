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

### 2. Live Interactive Seating View
- **Realistic Bench Layout**: Visualizes examination halls with Blackboard/Podium orientation, bench columns, and seat numbers (`S1`, `S2`, `S3`).
- **Interactive Seat Swapping**: Supports both **Click-to-Swap** and HTML5 **Drag-and-Drop**. Instant re-validation via backend API rejects any swap that would create adjacent cheating opportunities (`409 Conflict`).
- **Student Search**: Search any candidate roll number to highlight their seat with a pulsing ring and jump directly to their hall.
- **Room Carousel / Tabs**: Displays live utilization progress bars, seated vs capacity counts, and invigilator details.

### 3. Official Document Exports
- **Landscape PDF (ReportLab)**: Generates an official, print-ready landscape A4 PDF with one page per hall, full seating grid, utilization stats, and an **Invigilator Signature line**.
- **Excel Workbook (openpyxl)**: Generates a multi-sheet spreadsheet with department pastel color coding, candidate roll numbers, subjects, and an executive summary sheet.

### 4. 5-Step Generation Wizard
- **Step 1**: Exam Date & Session slot (`FN` / `AN`).
- **Step 2**: Add departments, subject names, candidate counts, and optional roll number ranges.
- **Step 3**: Select examination halls with real-time capacity vs student requirement tally.
- **Step 4**: Anti-malpractice rule configuration & Front/Back toggle.
- **Step 5**: One-click generation with visual progress and instant plan navigation.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Python 3.12+ / 3.14 | FastAPI, Uvicorn, Pydantic v2 |
| **Database** | SQLite + SQLAlchemy 2.0 | Clean ORM models, cascade relationships |
| **Algorithm** | Pure Python | Round-Robin greedy interleaver + constraint graph |
| **Frontend** | React 19 + TypeScript + Vite | Tailwind CSS, Lucide React, Framer Motion |
| **Exports** | ReportLab & OpenPyXL | Binary PDF & Excel generation |
| **Testing** | Pytest + Pytest-Asyncio | 23 automated unit tests |

---

## 📁 Project Structure

```
exam-seating/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point, CORS, lifespan
│   │   ├── config.py              # Pydantic Settings
│   │   ├── database.py            # SQLAlchemy engine, session, Base
│   │   ├── models/                # Room, Department, ExamSession, ExamEntry, SeatingPlan
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── crud/                  # Pure database access layers
│   │   ├── routers/               # REST API endpoints (/rooms, /departments, /sessions, /entries, /plans)
│   │   ├── services/              # PDF & Excel export generators
│   │   └── algorithm/             # Pure non-adjacent seating engine & roll number utilities
│   ├── tests/
│   │   └── test_seating.py        # 23 Pytest unit tests for constraints & edge cases
│   ├── seed_data.py               # Database seeder (4 depts, 6 halls, 1 session, initial plan)
│   ├── demo_flow.py               # End-to-end demo script (health, plan, swap, file downloads)
│   ├── requirements.txt           # Python dependencies (native wheels)
│   └── pytest.ini                 # Pytest test configuration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Navigation header, dark mode toggle
│   │   │   ├── Dashboard.tsx      # Stat cards, recent sessions, department legend
│   │   │   ├── Wizard.tsx         # 5-Step exam generation wizard
│   │   │   ├── SeatingView.tsx    # Interactive seating grid, drag/click swap, search
│   │   │   └── RoomManager.tsx    # Hall & Department CRUD
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

### 2. Backend Setup & Run

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies (use --only-binary :all: for instant wheel install on Python 3.14)
pip install --only-binary :all: -r requirements.txt

# Prime database with 4 departments, 6 halls, and sample exams
python seed_data.py

# Start the API server
uvicorn app.main:app --reload --port 8000
```

> **Backend API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser for the interactive Swagger UI.

---

### 3. Frontend Setup & Run

```bash
cd frontend

# Install npm packages
npm install

# Start Vite dev server
npm run dev
```

> **Web Application**: Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 4. Running the Automated Test Suite

Run the 23 unit tests verifying adjacency rules, edge cases, single department handling, and roll ordering:

```bash
cd backend
.\venv\Scripts\python -m pytest tests/ -v
```

Output:
```
tests/test_seating.py::test_no_same_dept_adjacent_two_depts PASSED
tests/test_seating.py::test_no_same_dept_adjacent_four_depts PASSED
tests/test_seating.py::test_no_same_subject_adjacent_two_depts PASSED
tests/test_seating.py::test_single_dept_warning PASSED
tests/test_seating.py::test_single_dept_leaves_empty_seats PASSED
tests/test_seating.py::test_rooms_filled_sequentially PASSED
tests/test_seating.py::test_insufficient_capacity_unseated PASSED
tests/test_seating.py::test_roll_order_preserved PASSED
tests/test_seating.py::test_front_back_toggle_off_no_violations PASSED
...
============================= 23 passed in 0.13s ==============================
```

---

### 5. Running the End-to-End Demo Script

With the backend running on port 8000:

```bash
cd backend
.\venv\Scripts\python demo_flow.py
```

The demo script automatically:
1. Checks API health.
2. Displays all registered halls and departments.
3. Computes the optimal seating plan across all halls.
4. Validates manual seat swap constraint checking.
5. Downloads and saves `sample_seating_plan.pdf` and `sample_seating_plan.xlsx`.

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
| `GET/PUT/DELETE` | `/api/v1/sessions/{id}` | Read / Update / Delete session |
| `GET/POST` | `/api/v1/entries/?session_id={id}` | List / Add exam entries for a session |
| `POST` | `/api/v1/plans/generate` | **Execute seating optimization engine** |
| `GET` | `/api/v1/plans/session/{id}` | Retrieve generated seating plan by session |
| `PUT` | `/api/v1/plans/{id}/swap` | **Swap two seats with live constraint re-validation** |
| `GET` | `/api/v1/plans/{id}/export/pdf` | **Download official Landscape A4 PDF** |
| `GET` | `/api/v1/plans/{id}/export/excel` | **Download official Excel workbook** |

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
