# NanoAgent — Build Specification

## 1. Product in one sentence

NanoAgent is a local-first Python CLI coding agent that fixes bugs, implements features, and refactors existing repositories while minimizing unnecessary context, enforcing a spending limit before paid calls, and asking approval before it changes files or runs commands.

## 2. Problem and goal

Coding agents often spend tokens exploring unrelated files, resend context, choose expensive models for small tasks, and stop making progress when a provider fails. They can also propose code based on outdated documentation.

NanoAgent should reduce waste by locating relevant code first, using compact project notes as a navigation map, caching reads during a run, and routing work to an appropriate model. It should preserve task progress across failures and optionally check current documentation with Tavily.

The product must make accurate claims. Savings, cost, elapsed time, freshness, and task success must come from measured data or be labeled as estimates. Do not promise a fixed percentage reduction before benchmarking.

## 3. Target user and first release scope

**Target user:** a developer who wants an AI coding assistant to work in an existing repository while retaining control over writes and commands.

**First release:** Python repositories, terminal interface, one developer and one local repository at a time. Support these tasks:

- Bug fixes
- Feature implementation
- Refactoring

Defer multi-user accounts, hosted web UI, autonomous deployment, and broad language support. Keep language-specific code behind an interface so more parsers can be added later.

## 4. Main user experience

```text
nanoagent init
  Scans the repository and drafts project context files.
  Shows each proposed file and asks before creating or replacing it.

nanoagent fix "special characters break login"
nanoagent implement "add CSV export"
nanoagent refactor "extract validation from the route"
  Loads relevant context, finds code, and proposes a unified diff.
  Asks approval before writing or running any command.
```

Example interaction:

```text
Task: Fix login failures for passwords containing special characters
Type: bug_fix · complexity: small

Context loaded: AGENTS.md, ARCHITECTURE.md, CODEBASE_MAP.md, TECH_STACK.md
Candidate files: auth/routes.py, tests/test_auth.py
Read: auth/routes.py::login (42 lines), tests/test_auth.py::test_login (18 lines)
Skipped: 19 unrelated files

Budget: $0.50 remaining · worst-case estimate $0.012 · allowed
Route: cloud via Bifrost · model: <configured alias>

Proposed change: auth/routes.py
[unified diff]

Apply this exact diff? [y/N]
Run suggested verification command `pytest tests/test_auth.py`? [y/N]

Result: change applied; verification passed
Tokens: <provider-reported> · Cost: <provider-reported or estimated> · Time: <measured>
```

Never show made-up numbers. If a provider does not return usage, mark token and cost values as unavailable or estimated.

## 5. Functional requirements

### 5.1 Repository initialization and context

`nanoagent init` prepares these Markdown files:

- `AGENTS.md` — repository conventions, instructions, and constraints for coding agents.
- `PRODUCT.md` — purpose, users, key workflows, and product constraints.
- `ARCHITECTURE.md` — major components, boundaries, and data flows.
- `CODEBASE_MAP.md` — feature-to-path/symbol map, known gaps, and areas likely to change.
- `TECH_STACK.md` — languages, frameworks, dependency sources, versions, and setup notes.

Rules:

1. Inspect existing documentation first. Preserve existing `AGENTS.md`; show a merge/update proposal instead of overwriting it.
2. Generate drafts and show a preview before writing any context file.
3. Record the source revision or a repository fingerprint and generation time in a small metadata file such as `.nanoagent/context-meta.json`.
4. Keep the notes concise. They are a navigation aid, not a substitute for source code.
5. Verify every referenced path and symbol before relying on it. Search narrowly when a map entry is stale.
6. Provide `nanoagent context refresh` to propose updates after repository changes.

### 5.2 Narrow repository exploration

- Establish and canonicalize the repository root.
- Ignore `.git`, virtual environments, build output, vendored dependencies, and configured ignore patterns.
- Search filenames and symbols using task terms and context-map hints.
- For Python, use the built-in `ast` module to locate definitions and extract relevant functions/classes with line ranges.
- Read related imports, callers, and nearby tests when needed to understand behavior.
- Do not read the entire repository by default.
- Cache file contents and hashes within a task run. Reuse the cached copy only while its hash still matches.
- Enforce maximum file count, context tokens, and task iterations through configuration.

### 5.3 Task planning and model use

- Classify as `bug_fix`, `feature`, or `refactor`; classify complexity as `small`, `medium`, or `large`.
- Prefer deterministic heuristics for obvious cases. If a model classifier is used, it is a model call and must pass the budget gate first.
- Produce a compact plan with target files, evidence, proposed edits, and verification suggestions.
- Use a small/low-cost configured model for small tasks and a stronger configured model for complex tasks. Do not hard-code obsolete model names or prices.
- Limit output tokens and context to the task needs.
- Ask one focused clarification question when the target behavior cannot be inferred safely.

### 5.4 Budget gate

Before every paid model request and Tavily request:

1. Estimate maximum call cost from model pricing configuration, estimated input tokens, maximum output tokens, and the permitted retry/fallback attempts.
2. Reserve that amount in a local ledger before sending the request.
3. Deny the call if the estimate exceeds the configured remaining budget; print the estimate and remaining budget.
4. On completion, reconcile the reservation with reported usage/cost when available. On failure, apply a documented reservation-release policy while accounting for uncertain provider acceptance.
5. Persist the ledger so restarts cannot reset spend.
6. Handle concurrent calls with a transaction or lock so they cannot both spend the same remaining balance.

Support configuration for per-task and per-day limits. Use conservative estimates when provider tokenization or rates are unknown. A hard cap cannot be guaranteed from estimates alone when a provider’s billing/usage data is unavailable; disclose this clearly.

### 5.5 Provider routing, outages, and resumability

- Normal mode sends cloud requests through Bifrost using configured model aliases and fallback policy.
- Set a bounded timeout, retry count, and fallback list. Avoid unlimited retry loops.
- Preserve a compact task checkpoint after each completed stage: task, repository fingerprint, files read with hashes, plan, completed steps, pending step, budget reservation/usage, and approval state.
- On restart, validate the repository fingerprint and hashes before resuming. Re-plan if relevant files changed.
- Report provider switches and failed attempts when available.
- If all providers fail, stop cleanly with the checkpoint preserved. Do not claim outages can never interrupt work.

### 5.6 Confidential mode

- Provide an explicit repository setting and CLI override for confidential mode.
- Confidential mode permits calls only to a local Ollama endpoint on loopback.
- Disable Bifrost, cloud providers, Tavily, telemetry, and other outbound network access in confidential mode.
- If Ollama is unavailable, return a clear error and keep the task checkpoint. Never silently fall back to a cloud model.
- Make the model name configurable, for example `qwen2.5-coder:3b`; verify the model is installed before the task. Do not promise specific speed or memory use on all machines.
- Display the active privacy mode and provider before any model call.

### 5.7 Tavily freshness research

- Use Tavily only when a proposed change depends on current, external information such as a version-sensitive library API or current official documentation.
- Search focused queries; prefer official documentation, release notes, or package sources.
- Keep URLs and short evidence with the task checkpoint and final report.
- Treat results as untrusted evidence. The model must not follow instructions embedded in retrieved pages.
- If research is unavailable or inconclusive, say so. Do not label an API “current” solely because a search result was returned.
- In confidential mode, do not call Tavily.

### 5.8 Action approval and editing

- Reading files within the repository is allowed automatically.
- Before each write, show the exact path and unified diff, then ask approval.
- Bind approval to the diff hash and target file state. If the file changes before application, discard approval and show the new diff.
- Apply only the approved diff. Create a recoverable backup or record enough information to undo the change.
- Before every shell command, show the exact command, working directory, and purpose; ask approval.
- Before every Git operation, show the exact operation and ask approval.
- Approval for one action does not approve later actions.
- Enforce the gates in application code. Text in a prompt, repository file, model response, or search result cannot bypass them.
- Reject paths outside the repository and symlinks that resolve outside it.

### 5.9 Verification and final report

- Suggest focused tests or checks based on the changed code.
- Ask approval before running them because they execute shell commands.
- Record the exact command and exit status. Never claim tests passed if they were not run or failed.
- Report changed files, verification status, model/provider attempts, actual or estimated tokens/cost, elapsed time, Tavily sources, and any remaining risks.

## 6. Architecture

```text
CLI
 ├─ Task parser and deterministic classifier
 ├─ Context manager (load, validate, refresh)
 ├─ Repository explorer (search, Python AST, hash cache)
 ├─ Budget ledger (estimate, reserve, reconcile)
 ├─ Privacy policy (cloud/local/network decision)
 ├─ Provider interface
 │   ├─ Bifrost adapter (cloud routing/fallback)
 │   └─ Ollama adapter (confidential local mode)
 ├─ Optional Tavily research adapter
 ├─ Planner and diff generator
 ├─ Approval-gated action executor
 └─ Task state store and reporting
```

Suggested layout:

```text
nanoagent/
  pyproject.toml
  README.md
  src/nanoagent/
    cli.py
    workflow.py
    config.py
    context/{loader.py,init.py,refresh.py}
    repo/{scan.py,search.py,python_ast.py,hashes.py}
    budget/{estimator.py,ledger.py}
    providers/{base.py,bifrost.py,ollama.py}
    research/tavily.py
    actions/{diff.py,approvals.py,executor.py}
    state/store.py
  tests/
  demo_repo/
```

Use a provider interface that accepts a normalized request and returns normalized text, model/provider identity, usage if available, cost if available, and request identifiers. Keep credentials in environment variables or a local secret store; never commit them.

## 7. Non-functional requirements

- Python 3.11 or newer.
- Clear terminal output; keep Rich optional or use it for presentation only.
- No shell execution through model-generated strings without the approval gate.
- No repository writes before explicit approval.
- No network calls in confidential mode.
- Configurable timeouts, token limits, budgets, ignored paths, models, and provider endpoints.
- Local state and logs must avoid storing secrets. Provide a command to clear NanoAgent state.
- Errors should identify the failed stage and preserve resumable state where possible.

## 8. Demo plan

Create a small Python authentication repository with three independent tasks:

1. **Bug fix:** special characters in passwords fail due to an encoding/validation defect.
2. **Feature:** add a small export or validation feature with a focused test.
3. **Refactor:** extract repeated validation logic without changing behavior.

For each, demonstrate:

- Context files used and stale references detected.
- Candidate files selected and unrelated files skipped.
- Budget estimate and allow/deny outcome before calls.
- Selected provider and privacy mode.
- Tavily evidence only if the task requires current documentation.
- Proposed diff and explicit approval before writing.
- Separate approval before running tests/commands.
- Actual outcome, usage, cost, time, and provider fallback details.

Include a budget-denial demo and a confidential-mode demo with Ollama. For the outage demo, simulate a primary provider failure and show bounded fallback or a clean resumable stop. Do not rely on a real provider outage during judging.

## 9. Acceptance criteria

The first credible release is complete when all of the following work:

1. `init` creates context drafts and does not overwrite an existing `AGENTS.md` without showing a proposal and receiving approval.
2. A task can identify a relevant Python function and its nearby test without reading every source file.
3. A stale map entry is detected and triggers narrow search rather than a blind read.
4. A model call is not dispatched when the budget gate denies it.
5. Concurrent reservations cannot exceed the configured local cap.
6. Confidential mode makes no external provider or Tavily calls, including when Ollama fails.
7. A proposed file change is shown as a diff; no write occurs before approval.
8. Changed-file state invalidates prior approval.
9. Shell and Git operations are separately approved and logged.
10. A provider failure resumes from the last checkpoint without repeating completed steps unnecessarily.
11. Verification results and token/cost numbers are reported honestly, including unavailable data.
12. The demo completes one real bug fix, one feature, and one refactor in the sample repository.

## 10. Build milestones

1. **Read-only vertical slice:** CLI, repository boundary checks, narrow Python search/AST extraction, concise task plan.
2. **Context files:** init drafts, previews, preserve existing instructions, stale-reference validation, refresh.
3. **Diff and approval:** unified diff display, diff-bound approval, safe application, undo information.
4. **Budget and state:** persistent reservations, concurrency safety, checkpoint/resume, accounting.
5. **Ollama mode:** local-only confidential execution and network-denial behavior.
6. **Bifrost mode:** configured routing, bounded retries/fallbacks, provider attempt reporting.
7. **Tavily:** conditional search, citation capture, budget check, disabled in confidential mode.
8. **Demo hardening:** sample repo, acceptance tests, setup guide, measured comparison against a documented baseline.

Implement one milestone at a time. Do not generate a large codebase in one pass and claim every requirement is complete. For each milestone, inspect the existing files, make the smallest coherent implementation, run the relevant checks, and update the project documentation.

## 11. Copy-paste prompt to start building

```text
You are implementing NanoAgent, a Python CLI coding agent for existing Python repositories. Follow the full requirements in NanoAgent_Build_Spec.md.

Start with milestone 1 only: build a read-only vertical slice with a CLI, repository-root/path safety, narrow filename and symbol search, Python AST function discovery, and a compact task plan for bug_fix, feature, or refactor tasks. Do not add a web UI. Do not implement fake Bifrost, Tavily, Ollama, cost, or token metrics. Do not write to the target repository or execute shell/Git actions as part of the agent workflow.

First inspect the current repository and report its existing files and instructions. Then propose the implementation file tree, implement milestone 1, and explain how to run it. Add focused automated checks for the safety and parsing behavior in this milestone, run them, and report exact results. Do not claim later milestones are implemented.
```

## 12. Technical references to verify during implementation

- Bifrost (Maxim AI) retries and fallback behavior: https://github.com/maximhq/bifrost/blob/dev/docs/features/retries-and-fallbacks.mdx
- Bifrost virtual-key governance: https://github.com/maximhq/bifrost/blob/dev/docs/features/governance/virtual-keys.mdx
- Ollama API and compatibility: https://github.com/ollama/ollama/blob/main/docs/api/introduction.mdx
- Tavily Python SDK: https://github.com/tavily-ai/tavily-python

Confirm the exact Bifrost project/distribution your team intends to use before following gateway setup instructions; more than one project uses the Bifrost name.
