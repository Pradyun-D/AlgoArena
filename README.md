
## Authors

| Name | Roll Number |
|---|---|
| Aadharsh Venkat | 241CS101 |
| Anirudh Nayak | 241CS109 |
| Pradyun Diwakar | 241CS141 |
| Aryan Sanjay Palimkar | 241CS112 |



---


# AlgoArena

A self-hosted, distributed code execution and contest platform built for institutions that need full control over their competitive programming infrastructure. AlgoArena runs entirely within a local or private network, removing any dependency on third-party cloud judges.

---

## Overview

AlgoArena provides an end-to-end environment for running timed coding contests, lab assessments, and practice sessions. Submitted code is routed through an asynchronous pipeline, evaluated seamlessly against hidden test cases, and the verdict is pushed directly to the client interface.

The platform supports role-based access for administrators, problem setters, and participants, featuring a live leaderboard, integrated code editor, and post-contest editorial publishing.

---

## Motivation

Cloud-hosted judges like Codeforces, LeetCode, and HackerRank are not suitable for on-premise institutional use for several reasons:

- Their IP ranges span multiple CDNs and change without notice, making campus network whitelisting unreliable.
- Problem data, test cases, and student submissions reside on third-party servers with no institutional audit trail.
- They require an active internet connection. An ISP outage during an exam disrupts the entire contest.
- Grading workflows are either manual or locked behind per-seat licensing.

AlgoArena addresses each of these by running entirely inside the institution's network with full data ownership.

---

## Features

- **Integrated Code Editor:** Monaco Editor with syntax highlighting and language selection.
- **Verdict Updates:** Detailed submission status updates including Queued, Running, Accepted, Wrong Answer, TLE, MLE, Runtime Error, and Compilation Error.
- **Live Leaderboard:** Rankings updated dynamically during active contests.
- **Contest Management:** Create, schedule, edit, and delete contests with configurable visibility parameters.
- **Problem Authoring:** Add problems with difficulty ratings, time/memory limits, and hidden test cases.
- **Post-Contest Editorials:** Authors can independently publish solutions after contest end.
- **Role-Based Access Control:** Separate permission scopes for Admin, Setter, and User roles enforcing strict access boundaries.
- **Multi-Language Support:** Execution pipeline natively supporting languages including C++ and Python.

---

## Architecture

```text
Client (React + Monaco Editor)
      |
      | HTTP
      v
Django REST API
      |
      +---> MySQL / TiDB (primary data store)
      |
      +---> Isolated Execution System
              |
              v
    Verdict and Metric Generation
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Framer Motion, Monaco Editor |
| Styles | Vanilla CSS (Dark/Light mode native handling) |
| Backend | Django (Python) |
| Database | MySQL / TiDB |

---

The relational schema is organized around the following core tables:

- `user` — authentication, role assignment, and account status tracking.
- `roles` — Admin, Setter, and User capability definitions.
- `profile` — extended user metadata including college and problems solved count.
- `problems` — problem definitions with difficulty thresholds, resource limits, and visibility logic.
- `tags` / `problem_tags` — tagging associations for sorting and grouping problems.
- `testcases` — per-problem input/output paired datasets including flags for visible sample availability.
- `editorials` — post-contest markdown solutions logically linked to problems.
- `languages` — catalog mapping of executable programming languages.
- `Submissions` — submission records handling source logic, execution status, and resource usage.
- `SubmissionResults` — localized per-testcase execution verdicts.
- `contests` — contest metadata supporting precise scheduling boundaries.
- `contest_problems` — contextual mappings assigning specific problems to specific contests alongside maximum valid scores.
- `contest_participants` — enrollment metadata tracing dynamic scoring mechanisms.

All primary logic paths prioritize universally unique identifiers (UUIDs) avoiding linear indexing enumeration vulnerabilities.

---

## Role-Based Access

| Capability | Admin | Setter | User |
|---|---|---|---|
| Manage Contests | Yes | Own only | No |
| Add / Edit Problems | Yes | Own contests | No |
| Upload Test Cases | Yes | Own problems | No |
| Publish Editorials | Yes | Own problems | No |
| View Submissions | All | Own contests | Own only |
| Moderate Users | Yes | No | No |
| Compete | Yes | Yes | Yes |
| View Leaderboard | Yes | Yes | Yes |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Secure MySQL or TiDB Instance

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/algoarena.git
   cd algoarena
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.template .env
   # Edit .env with your local or cloud database credentials
   ```

3. **Initialize the backend development environment:**
   ```bash
   cd backend
   python3 -m venv myenv
   source myenv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

4. **Initialize the frontend workspace:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

The application mounts the Django API routing via `http://localhost:8000` and serves the React frontend interface natively at `http://localhost:5173`.

---

## Security

- Role validations are enforced natively across API endpoints using Django permission logic.
- Problem setter and modifier actions evaluate resource possession mathematically by executing owner matching algorithms targeting unique author fields.
- Resource resolution actively relies on UUIDv4 endpoints limiting direct iteration logic leaks or enumeration exploits.

---
**Department of Computer Science and Engineering**  
National Institute of Technology Karnataka



## License

This project is strictly open-source. Reference local licensing documentation to confirm extended permissions.
