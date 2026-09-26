# ReproForge

ReproForge is an **AI-powered autonomous investigation and patching pipeline** designed to automatically discover, reproduce, root-cause, and fix software bugs in codebases by tracing failing tests. 

Think of it as a fully autonomous debugging engineer that takes a repository URL and a bug report (or just a failing test suite) and iteratively locates the exact faulty line of code, generates a patch, applies it, and verifies the fix by re-running the tests.

## 🎥 Demo

<video src="./demo.mp4" controls="controls" style="max-width: 100%;">
  Your browser does not support the video tag.
</video>

## 🚀 How It Works

ReproForge executes a sophisticated multi-agent graph flow:

1. **Discovery & Setup (`Code Investigator`, `History Investigator`)**: Clones the repository into an isolated workspace, analyzes the tech stack (Node.js, Python, Java, etc.), detects the test runner, and maps the project structure.
2. **Test Execution (`Test Investigator`)**: Runs the test suite to establish a baseline and capture failing test output, stack traces, and assertions.
3. **Bug Localization (`Reproduction Agent`)**: Uses local import resolution and AST-like source tracing to walk backward from the failing test file to the specific source file and function responsible for the bug.
4. **Root Cause & Patch Generation (`Fix Agent`)**: Packages the minimized context (failing test, stack trace, and targeted source code) and sends it to the **AIProvider** (powered by Gemini/OpenAI). The LLM determines the exact line of the bug, explains the root cause, and generates a minimal code patch.
5. **Verification (`Verification Agent`)**: Safely applies the proposed patch and re-runs the test suite to ensure the previously failing tests now pass without introducing regressions.

## 📂 Project Structure

The project is split into two main layers:

```text
ReproForge/
├── backend/                  # The Node.js Orchestrator & Agent Engine
│   ├── src/
│   │   ├── agents/           # Central logic (investigationOrchestrator.ts)
│   │   ├── events/           # Event bus for real-time agent state & websocket bridging
│   │   ├── services/         # Core logic implementations:
│   │   │   ├── aiProvider.ts         # LLM integration for generic patch generation
│   │   │   ├── gitService.ts         # Workspace isolation and repository cloning
│   │   │   ├── sourceResolver.ts     # Follows imports from tests to source code
│   │   │   ├── testRunner.ts         # Executes tests and parses assertion outputs
│   │   │   ├── patchService.ts       # Legacy/heuristic fallback patch logic
│   │   │   └── verificationService.ts# Re-runs tests to verify fix viability
│   │   └── server.ts         # Express API serving websocket connections to the UI
│   └── package.json
│
└── frontend/                 # The React UI Dashboard
    ├── src/
    │   ├── components/       # Graph visualizations, terminal logs, diff viewers
    │   └── App.tsx           # Main application entry point
    └── package.json
```

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- `GEMINI_API_KEY` or `OPENAI_API_KEY` (Set in your environment variables for dynamic AI patch generation)

### Running the Project

**1. Start the Backend:**
```bash
cd backend
npm install
npm run dev
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`. You can enter a GitHub repository URL into the UI and watch the agents work in real-time.

---

## 🤖 AI Provider (Fallback Logic)

ReproForge is built to be robust. If an API key is not provided in your environment, the `AIProvider` includes a fallback `mockAIPatch` system that simulates LLM-like reasoning using dynamic string replacement and heuristics. This ensures test suites and demonstrations can run smoothly even completely offline. 
