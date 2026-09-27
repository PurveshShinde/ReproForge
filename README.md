ReproForge

ReproForge is an AI-powered autonomous investigation and patching pipeline designed to automatically discover, reproduce, root-cause, and fix software bugs in codebases by tracing failing tests.

Think of it as a fully autonomous debugging engineer that takes a repository URL and a bug report (or simply a failing test suite), iteratively locates the faulty code, generates a patch, applies it, and verifies the fix by re-running the tests.

🎥 Demo

<video src="https://github.com/PurveshShinde/ReproForge/raw/refs/heads/main/demo.mp4" controls width="100%">
  Your browser does not support the video tag.
  <a href="https://github.com/PurveshShinde/ReproForge/raw/refs/heads/main/demo.mp4">Watch the ReproForge demo video</a>
</video>«Note: The demo video is included directly in the repository root as "demo.mp4".»

---

🚀 How It Works

ReproForge executes a sophisticated multi-agent investigation flow:

1. Discovery & Setup

Code Investigator + History Investigator

- Clones the repository into an isolated workspace.
- Detects the project's technology stack.
- Identifies the package manager and test runner.
- Maps the project structure and relevant files.
- Inspects repository history when useful for understanding the bug.

2. Test Execution

Test Investigator

- Runs the project's test suite.
- Establishes a baseline.
- Captures failing tests, stack traces, assertion errors, and relevant output.
- Identifies the specific failure that needs investigation.

3. Bug Localization

Reproduction Agent

- Starts from the failing test.
- Resolves local imports and dependencies.
- Traces execution from the test into the relevant source files.
- Narrows the investigation down to the specific function and faulty code.

4. Root Cause & Patch Generation

Fix Agent

The relevant debugging context is minimized and provided to the AI provider:

- Failing test
- Test output
- Stack trace
- Relevant source code
- Repository context

The AIProvider, powered by Gemini/OpenAI, determines:

- The root cause of the failure.
- The faulty code.
- The required correction.
- A minimal patch to fix the issue.

5. Verification

Verification Agent

- Applies the proposed patch safely.
- Re-runs the relevant tests.
- Verifies that the original failure is resolved.
- Checks for regressions by running the test suite again.

The goal is not simply to generate a plausible fix, but to prove that the fix works through automated verification.

---

🧪 Tester Repository

ReproForge includes a dedicated test repository used to validate the autonomous investigation, patching, and verification pipeline.

ReproForge Test Repository

GitHub: https://github.com/PurveshShinde/ReproForge-test

The repository contains intentionally buggy code and tests designed to demonstrate ReproForge's ability to:

1. Clone an external repository.
2. Detect the project's language and test environment.
3. Execute the existing test suite.
4. Identify failing tests.
5. Trace the failure back to the relevant source code.
6. Determine the root cause.
7. Generate and apply a patch.
8. Re-run the tests.
9. Verify that the bug has been fixed.

You can use the repository URL directly as an input to ReproForge to reproduce the investigation demonstrated in the project.

---

📂 Project Structure

The project is split into two main layers:

ReproForge/
├── demo.mp4                  # Project demonstration video
├── README.md
│
├── backend/                  # Node.js Orchestrator & Agent Engine
│   ├── src/
│   │   ├── agents/
│   │   │   └── investigationOrchestrator.ts
│   │   │
│   │   ├── events/           # Event bus and WebSocket bridging
│   │   │
│   │   ├── services/         # Core services
│   │   │   ├── aiProvider.ts
│   │   │   ├── gitService.ts
│   │   │   ├── sourceResolver.ts
│   │   │   ├── testRunner.ts
│   │   │   ├── patchService.ts
│   │   │   └── verificationService.ts
│   │   │
│   │   └── server.ts          # Express API + WebSocket server
│   │
│   └── package.json
│
└── frontend/                 # React UI Dashboard
    ├── src/
    │   ├── components/        # Graph, terminal, diff & UI components
    │   └── App.tsx
    │
    └── package.json

---

🛠️ Getting Started

Prerequisites

- Node.js 18+
- npm
- A "GEMINI_API_KEY" or "OPENAI_API_KEY" for dynamic AI patch generation

1. Clone ReproForge

git clone https://github.com/PurveshShinde/ReproForge.git
cd ReproForge

2. Start the Backend

cd backend
npm install
npm run dev

3. Start the Frontend

Open another terminal:

cd frontend
npm install
npm run dev

The frontend will be available at:

http://localhost:5173

Enter a GitHub repository URL into the UI and start an investigation.

---

🤖 AI Provider & Fallback Logic

ReproForge is designed to remain functional even without an external AI API.

When "GEMINI_API_KEY" or "OPENAI_API_KEY" is configured, the AIProvider can use an LLM to perform root-cause analysis and generate patches.

If no API key is available, ReproForge falls back to its built-in "mockAIPatch" system.

The fallback uses dynamic string replacement and heuristic logic to simulate AI-assisted patch generation, allowing the investigation pipeline and demonstrations to run offline.

This makes the system useful for both:

- Live AI-powered investigations
- Offline demonstrations and testing

---

🧩 Core Components

Component| Responsibility
Code Investigator| Detects project structure, language, framework and test environment
History Investigator| Examines repository history and previous changes
Test Investigator| Executes tests and captures failures
Reproduction Agent| Traces failing tests to relevant source code
Fix Agent| Determines root cause and generates a patch
Verification Agent| Applies the patch and validates the fix
AIProvider| Interfaces with Gemini/OpenAI and fallback AI logic
Source Resolver| Resolves imports and follows source dependencies
Test Runner| Executes and analyzes test commands
Patch Service| Handles patch application and fallback patching
Git Service| Creates isolated repository workspaces

---

🔄 Investigation Pipeline

                 GitHub Repository
                        │
                        ▼
              ┌───────────────────┐
              │ Code Investigator │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Test Investigator │
              └─────────┬─────────┘
                        │
                 Failing Tests
                        │
                        ▼
              ┌───────────────────┐
              │ Reproduction Agent│
              └─────────┬─────────┘
                        │
                  Faulty Code
                        │
                        ▼
              ┌───────────────────┐
              │     Fix Agent     │
              │   AIProvider      │
              └─────────┬─────────┘
                        │
                    Patch
                        │
                        ▼
              ┌───────────────────┐
              │ Verification Agent│
              └─────────┬─────────┘
                        │
                        ▼
                Tests Re-run
                   │       │
                PASS      FAIL
                  │         │
                  ▼         └──► Further Investigation
             Verified Fix

---

✨ Key Features

- 🔍 Autonomous bug investigation
- 🧪 Automated test execution
- 🧭 Failure-to-source tracing
- 🤖 LLM-powered root-cause analysis
- 🩹 Automatic patch generation
- ✅ Automated patch verification
- 🔄 Regression detection
- 📡 Real-time investigation events
- 🌐 GitHub repository support
- 🔒 Isolated repository workspaces
- 📴 Offline fallback AI simulation
- 📊 Visual investigation graph
- 💻 Integrated code and terminal views

---

🧰 Tech Stack

Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- React Flow
- Monaco Editor
- Framer Motion

Backend

- Node.js
- Express
- TypeScript
- WebSockets
- Git
- Gemini / OpenAI API

---

🎯 Project Goal

Traditional debugging often requires a developer to manually:

«Read the failure → reproduce the bug → trace the code → identify the root cause → write a fix → run tests → verify the fix.»

ReproForge aims to automate this entire workflow.

Input:

Repository + failing tests

Output:

Root cause → Patch → Verified fix

The system is designed around one core principle:

«Don't just suggest a fix — reproduce the failure, patch the code, and verify that the fix actually works.»
