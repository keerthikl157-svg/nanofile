# NanoAgent

NanoAgent is a local web app for proposing focused changes to an existing repository. It finds likely source files, sends selected excerpts to a model, shows a diff, and requires your approval before writing files. It includes a small Python demo repository with a planted authentication bug.

## Start the app

No Node.js installation is needed on Windows. Double-click **Start NanoAgent.bat**. It uses built-in Windows PowerShell, selects a free local port, and opens the app in your browser. You can also start it from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\server.ps1
```

The app server binds to loopback only and serves the page from this folder. If you start it manually, open http://127.0.0.1:4173. `server.js` is an optional Node.js server for developers who already have Node installed.

## Use the included demo

1. Click **Use demo repo** and enter a task such as: “Fix authentication so passwords containing special characters are accepted, while incorrect passwords remain rejected.”
2. Start Ollama and pull a coding model:

   ```powershell
   ollama pull qwen2.5-coder:3b
   ```

3. Select **Ollama · local**, then click **Plan task**.
4. Review the proposed diff. NanoAgent writes only after you select **Approve and write**.
5. Review the suggested verification command and approve it separately. The prototype allows only `pytest`, `unittest`, and `ruff check` command forms.

If Ollama is unavailable, install and start it, then retry. Confidential mode always uses Ollama and never falls back to a cloud model.

## Bifrost

Select **Bifrost · cloud gateway**, then open Settings. Configure the Bifrost-compatible endpoint, model alias, and input/output rates. The API key is held in the running server process only and is not written to disk. Configure Bifrost itself with a bounded fallback policy that fits within three attempts; NanoAgent reserves for up to three attempts before a cloud call.

The configured token rates are estimates. Bifrost/provider pricing and fallback billing can differ; the app keeps a conservative worst-case reservation for the session instead of claiming exact billing data.

## Current prototype limits

- Python-first source discovery; other languages use keyword excerpts.
- Supports planning changes to existing files only; adding new files is not enabled.
- Tavily integration, automatic context-file generation, robust multi-step resume, and a cross-process approval store are not implemented yet.
- The model must return the structured response format requested by the app. Smaller local models may need retries or a stronger configured model.
- The app is intended for a developer’s local machine. Do not expose the server port to a network.

Runtime settings and the conservative session budget ledger are stored under `work/`. The Bifrost key is not saved there.
NanoAgent

AI Coding Agent with Token Efficiency and Stale-Answer Detection

1. Project Overview

NanoAgent is an AI-powered coding agent designed to understand project codebases, identify bugs, detect outdated or stale coding suggestions, and help developers write, modify, and debug code while minimizing unnecessary token consumption.

2. Combined Hackathon Problem Statement

"Build an AI Coding Agent That Detects Stale Answers and Gets the Job Done on the Fewest Tokens."

The challenge is to develop an intelligent coding agent that understands a project's codebase, identifies bugs, detects outdated information and coding suggestions, and completes development tasks efficiently while minimizing token usage, unnecessary API calls, repeated operations, and wasted context.

3. Problems We Aim to Solve

- Lack of trust in AI-generated code.
- Outdated or stale AI-generated suggestions.
- Lack of transparency in AI decisions.
- High token consumption.
- Repeated reading of entire codebases.
- Difficulty handling complex coding and debugging tasks.
- Wasted execution and repeated attempts.
- Lack of token cost control.

4. Our Solution

NanoAgent aims to solve these problems through intelligent repository inspection, smart context management, outdated-information detection, budget awareness, and human approval before applying code changes.

5. Key Features

- Repository inspection.
- AI-powered code suggestions.
- Stale-answer detection (planned).
- Ollama integration.
- Bifrost endpoint support.
- Cloud budget estimation.
- Human approval before code changes.
- Controlled test execution.

6. Technologies Used

- JavaScript
- Node.js
- HTML
- CSS
- Ollama
- Bifrost
- Tavily (planned integration)

7. Installation and Setup

1. Install Node.js (version 18 or later).
2. Clone the GitHub repository.
3. Open the project folder in VS Code.
4. Install dependencies if required.
5. Configure the AI provider.
6. Start NanoAgent using "Start NanoAgent.bat".

8. Local Access

http://127.0.0.1:4173

9. Project Status

NanoAgent is under development. Features and integrations must be tested before final submission.

10. Future Improvements

- Tavily integration for information verification.
- Smart context management.
- Improved stale-answer detection.
- Advanced debugging.
- Token usage analytics.
- Task resume functionality.