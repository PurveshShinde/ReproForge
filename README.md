<div align="center">
  <h1>ReproForge — From Bug Report to Verified Fix</h1>
  <p><strong>An IBM Bob 2.0 Hackathon Project</strong></p>
  <p>Created by team <a href="https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/403denied">403Denied</a> on September 27, 2026</p>
  
  <p>
    <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js 18+" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=flat&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/Express.js-404D59?style=flat&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
  </p>

  <p>
    <b>Technologies:</b>
    <a href="https://lablab.ai/tech/generative-agents">Generative Agents</a> •
    <a href="https://lablab.ai/tech/opus-appliedai">Opus</a> •
    <a href="https://lablab.ai/tech/anthropic/claude-code">Claude Code</a> •
    <a href="https://lablab.ai/tech/openai/chatgpt">ChatGPT</a> •
    <a href="https://lablab.ai/tech/openai/gpt4">GPT-4</a> •
    <a href="https://lablab.ai/tech/google/gemini-3-pro">Gemini 3 pro</a> •
    <a href="https://lablab.ai/tech/ibm">IBM</a>
  </p>

  <p>
    <b>Categories:</b>
    <a href="https://lablab.ai/apps/topic/developer-tools">Developer Tools</a>, 
    <a href="https://lablab.ai/apps/topic/assistant">Assistant</a>, 
    <a href="https://lablab.ai/apps/topic/automotive">Automotive</a>, 
    <a href="https://lablab.ai/apps/topic/coding-excellence">Coding excellence</a>, 
    <a href="https://lablab.ai/apps/topic/productivity">Productivity</a>
  </p>
</div>

---

ReproForge is an AI-powered software debugging and repair system built to close the gap between identifying a bug and proving that it has actually been fixed. A developer provides a bug report, stack trace, or error description, and ReproForge analyzes the repository using specialized AI agents. The agents investigate the codebase, examine relevant tests and Git history, identify potential root causes, and collaborate to determine the most likely explanation. 

ReproForge then creates a minimal reproducible test case and runs it against the existing code to prove that the issue actually occurs. Once the failure is confirmed, the system generates a regression test, proposes and applies a minimal code fix, and executes the relevant test suites again. 

The final result is an evidence-backed debugging report showing the complete journey:

**Bug Report → Investigation → Root Cause → Reproduction → Regression Test → Fix → Verification**

Instead of simply generating code or explaining an error, ReproForge focuses on proof. It does not claim a bug is fixed unless the generated reproduction and relevant tests demonstrate that the behavior has been corrected. The project uses IBM Bob 2.0's repository-level AI capabilities, agent workflows, parallel investigation, file and terminal operations, and iterative verification to demonstrate how AI can participate in a complete software engineering workflow.

## 🎥 Demo

[▶️ Watch the ReproForge Demo](./demo.mp4)

> The demo demonstrates the complete autonomous workflow: repository discovery → test execution → bug localization → root-cause analysis → patch generation → verification.

## 🚀 How It Works

ReproForge executes a sophisticated multi-agent investigation flow:

### 1. Discovery & Setup
**Code Investigator + History Investigator**
- Clones the repository into an isolated workspace.
- Detects the project's technology stack.
- Identifies the package manager and test runner.
- Maps the project structure and relevant files.
- Inspects repository history when useful for understanding the bug.

### 2. Test Execution
**Test Investigator**
- Runs the project's test suite.
- Establishes a baseline.
- Captures failing tests, stack traces, assertion errors, and relevant output.
- Identifies the specific failure that needs investigation.

### 3. Bug Localization
**Reproduction Agent**
- Starts from the failing test.
- Resolves local imports and dependencies.
- Traces execution from the test into the relevant source files.
- Narrows the investigation down to the specific function and faulty code.

### 4. Root Cause & Patch Generation
**Fix Agent**
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

### 5. Verification
**Verification Agent**
- Applies the proposed patch safely.
- Re-runs the relevant tests.
- Verifies that the original failure is resolved.
- Checks for regressions by running the test suite again.

The goal is not simply to generate a plausible fix, but to prove that the fix works through automated verification.

---

## 📋 Supported Repositories & Requirements

ReproForge is designed to autonomously clone, execute, reproduce, and verify bug fixes. To work seamlessly, target repositories must meet these requirements:

### ✅ Repository Requirements:
1. **Standard Root Manifest**: The repository root must contain the project's build and dependency manifest (e.g. `package.json` for Node.js, `pom.xml` or `build.gradle` for Java, or `pyproject.toml` / `pytest.ini` for Python).
2. **Runnable Test Suite**: A configured test command (e.g. `npm test` or `npm run test`) that fails predictably when the bug is present.
3. **Single-Project Root** *(Not Polyglot Archives)*:
   > ⚠️ **Note on Polyglot Repositories (e.g. `GildedRose-Refactoring-Kata`)**:
   > Repositories containing multiple language implementations in subdirectories (e.g., `/Java`, `/JavaScript`, `/Python`, `/Cpp`) without a top-level build file cannot be automatically executed. ReproForge targets single-project repositories or sub-projects with a defined root runner.

### 🛠️ Supported Runtimes & Test Runners:
- **Node.js / TypeScript**: `npm`, `yarn`, `pnpm` with `node --test` (TAP 13), `jest`, or `vitest`.
- **Python**: `pytest` (`pytest -v`, `python -m pytest -v`).
- **Java**: Maven (`mvn test -B`) and Gradle (`./gradlew test`).

---

## 🧪 Verified & Tested Example Repositories

Use any of these repositories directly in the ReproForge input box:

| Repository URL | Tech Stack | Description | Execution Time |
| :--- | :--- | :--- | :--- |
| [`https://github.com/PurveshShinde/calculator-bug`](https://github.com/PurveshShinde/calculator-bug) | Node.js (`node:test`) | Minimal zero-dependency arithmetic bug test | ~5 seconds ⚡ |
| [`https://github.com/PurveshShinde/ReproForge-test`](https://github.com/PurveshShinde/ReproForge-test) | Node.js (`node:test`) | 4-agent bug suite: Auth, Response Transformer, Router, Payments | ~30 seconds |
| `demo-repo/` *(Included in repo)* | Node.js (`node:test`) | Local mock payment gateway and checkout service | ~5 seconds |

### Quick 2-Minute Test Repo Setup:
If you want to test your own bug, create a minimal GitHub repository with:
1. **`package.json`**:
   ```json
   { "name": "bug-test", "type": "module", "scripts": { "test": "node --test" } }
   ```
2. **`test/calculator.test.js`**:
   ```javascript
   import test from 'node:test';
   import assert from 'node:assert';
   function divide(a, b) { return a * b; } // Bug: * instead of /
   test('divide 10 by 2 equals 5', () => { assert.strictEqual(divide(10, 2), 5); });
   ```

---

## 🧹 Workspace Isolation & Disk Space Protection

Because ReproForge clones repositories and installs dependencies at runtime, the backend incorporates multi-layered disk cleanup to ensure hosting environments (like Render's ephemeral storage) never run out of disk space:

1. **Immediate Workspace Teardown**: As soon as an investigation completes (success, partial fix, or error), `cleanupWorkspace()` deletes the cloned workspace and all `node_modules` from `/tmp/reproforge/`.
2. **Automated Pre-Clone Pruning**: Before every new git clone, `pruneStaleWorkspaces()` sweeps the temporary directory and purges any abandoned directories older than 10 minutes.
3. **Background Garbage Sweeper**: A periodic timer runs every 10 minutes on the backend to guarantee zero disk accumulation even if a client disconnects unexpectedly or closes the browser tab.

---

## 📂 Project Structure

The project is split into two main layers:

```text
ReproForge/
├── demo.mp4
├── README.md
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   └── investigationOrchestrator.ts
│   │   ├── events/
│   │   ├── services/
│   │   │   ├── aiProvider.ts
│   │   │   ├── gitService.ts
│   │   │   ├── sourceResolver.ts
│   │   │   ├── testRunner.ts
│   │   │   ├── patchService.ts
│   │   │   └── verificationService.ts
│   │   └── server.ts
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   └── App.tsx
    └── package.json
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- npm
- A `GEMINI_API_KEY` or `OPENAI_API_KEY` for dynamic AI patch generation

### 1. Clone ReproForge
```bash
git clone https://github.com/PurveshShinde/ReproForge.git
cd ReproForge
```

### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
```

### 3. Start the Frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```
The frontend will be available at: http://localhost:5173

Enter a GitHub repository URL into the UI and start an investigation.

---

## 🤖 AI Provider & Fallback Logic

ReproForge is designed to remain functional even without an external AI API.

When `GEMINI_API_KEY` or `OPENAI_API_KEY` is configured, the AIProvider can use an LLM to perform root-cause analysis and generate patches.

If no API key is available, ReproForge falls back to its built-in `mockAIPatch` system.

The fallback uses dynamic string replacement and heuristic logic to simulate AI-assisted patch generation, allowing the investigation pipeline and demonstrations to run offline.

This makes the system useful for both:
- Live AI-powered investigations
- Offline demonstrations and testing

---

## 🧩 Core Components

| Component | Responsibility |
| :--- | :--- |
| **Code Investigator** | Detects project structure, language, framework and test environment |
| **History Investigator** | Examines repository history and previous changes |
| **Test Investigator** | Executes tests and captures failures |
| **Reproduction Agent** | Traces failing tests to relevant source code |
| **Fix Agent** | Determines root cause and generates a patch |
| **Verification Agent** | Applies the patch and validates the fix |
| **AIProvider** | Interfaces with Gemini/OpenAI and fallback AI logic |
| **Source Resolver** | Resolves imports and follows source dependencies |
| **Test Runner** | Executes and analyzes test commands |
| **Patch Service** | Handles patch application and fallback patching |
| **Git Service** | Creates isolated repository workspaces |

---

## 🔄 Investigation Pipeline

```text
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
```

---

## ✨ Key Features

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

## 🧰 Tech Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- React Flow
- Monaco Editor
- Framer Motion

### Backend
- Node.js
- Express
- TypeScript
- WebSockets
- Git
- Gemini / OpenAI API

---

## 🎯 Project Goal

Traditional debugging often requires a developer to manually:

> *Read the failure → reproduce the bug → trace the code → identify the root cause → write a fix → run tests → verify the fix.*

ReproForge aims to automate this entire workflow.

**Input:** Repository + failing tests

**Output:** Root cause → Patch → Verified fix

The system is designed around one core principle:

> *"Don't just suggest a fix — reproduce the failure, patch the code, and verify that the fix actually works."*

---

## 👥 Contributors

- **Purvesh Shinde** ([@PurveshShinde](https://github.com/PurveshShinde)) - Creator
- **Aditi Arvind Sapkal** ([@Aditi040504](https://github.com/Aditi040504)) - Collaborator

---

## 📝 About

ReproForge was built to tackle the repetitive and time-consuming process of debugging software bugs. This project serves as an open-source solution that leverages AI to act as a fully autonomous debugging engineer. It demonstrates the capabilities of multi-agent architectures and AI-driven code intelligence in resolving real-world programming issues efficiently. If you found this project helpful, please consider leaving a ⭐️ on the repository!
