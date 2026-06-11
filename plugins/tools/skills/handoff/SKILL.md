---
name: handoff
disable-model-invocation: true
description: "Create or resume local project handoff documents for Claude Code. Use when the user invokes `/handoff`, `/handoff off`, or `/handooff on`, or asks to save, resume, continue, or hand off project context. The skill writes new Markdown handoff documents under the current project's `.handoff/` directory, or reads existing handoff documents when starting from little or no context. It is designed for a zero-context future self to continue the work safely without deleting, editing, or archiving previous handoff documents."
---

# Handoff Skill

This skill manages lightweight local handoff documents for the current project.

It has two modes:

- **off**: create a new handoff document from the current context.
- **on**: read an existing handoff document and prepare to resume from it.

The default audience for every handoff document is:

> The user's zero-context future self.

Do not optimize the document for coworkers, reviewers, a specific model, or a specific agent. The document must remain useful to the user's zero-context future self.

## Command Forms

Support these command forms:

```text
/handoff
/handoff off
/handoff off <focus instruction>
/handoff on
/handoff on <keyword>
/handoff <text>
```

## Default Mode Selection

When the user runs:

```text
/handoff
```

infer the mode.

Use **off** when there is meaningful current work context, such as:

- the user has described a task, plan, bug, design, or implementation;
- the current conversation includes analysis, decisions, debugging, or next steps;
- files have been read, edited, discussed, or investigated;
- there is known project state worth preserving;
- git status shows uncommitted work;
- there are failing tests, open questions, or known follow-up actions.

Use **on** when there is little or no current task context, such as:

- the user starts a fresh session and only runs `/handoff`;
- there is no clear active task to preserve;
- the worktree appears clean and there is no task description;
- the user seems to be asking to resume prior work.

When unsure, prefer asking one short clarifying question instead of creating a vague handoff.

## Explicit Modes

When the user runs:

```text
/handoff off
```

force **off** mode.

When the user runs:

```text
/handoff on
```

force **on** mode.

## Text After `/handoff`

Interpret text after the command based on mode.

In **off** mode, treat extra text as a **handoff focus instruction**.

Examples:

```text
/handoff focus on failed debugging paths and next hypotheses
/handoff emphasize architecture decisions
/handoff only preserve what is needed to continue implementation
```

The focus instruction may affect:

- the title;
- the summary;
- which sections receive more detail;
- the ordering of next steps;
- whether to emphasize failures, hypotheses, implementation state, architecture decisions, verification, or open questions.

It must not override core rules.

In **on** mode, treat extra text as a **filename/title filter keyword**.

Examples:

```text
/handoff on 订单导出
/handoff pagination
/handoff auth
```

Filter only by handoff document filenames/titles. Do not read document bodies just to search.

## Project Root and Storage

Use a flat `.handoff/` directory in the current project root.

Determine the project root as follows:

1. If inside a git repository, use:

```bash
git rev-parse --show-toplevel
```

2. Otherwise, use the current working directory.

Store handoff documents directly under:

```text
.handoff/
```

Do not create subdirectories.

Do not create an index file.

Do not recursively scan nested directories.

Only scan:

```text
.handoff/*.md
```

## Gitignore Rule

Only in **off** mode, when the project is a git repository:

1. Check whether the root `.gitignore` already ignores `.handoff/`.
2. If not ignored, append:

```gitignore
.handoff/
```

3. If `.gitignore` does not exist, create it with:

```gitignore
.handoff/
```

Do not rewrite, reorder, clean up, or remove existing `.gitignore` content.

Do not do this in **on** mode.

If `.handoff/` is already tracked by git, warn the user that `.gitignore` will not untrack existing files. Do not untrack it automatically.

## Safety Rules

Never delete handoff documents.

Never edit old handoff documents.

Never archive old handoff documents.

Never rename old handoff documents.

Never overwrite an existing handoff document.

Never run destructive or state-changing git commands, including:

```text
git add
git commit
git push
git pull
git merge
git rebase
git reset
git checkout
git switch
git restore
git clean
git stash
git rm
```

Allowed read-only git commands include:

```text
git status --short
git diff --stat
git log -5 --oneline
git rev-parse --show-toplevel
ls
find
cat
sed
```

Do not write full diffs into handoff documents.

Allowed git information in handoff documents:

- `git status --short` summary;
- `git diff --stat` summary;
- recent commits;
- relevant filenames;
- concise explanation of change intent.

Do not include:

- full `git diff`;
- large code blocks;
- large logs;
- large terminal outputs.

## Sensitive Information

Never write secrets into handoff documents.

Do not include:

- API keys;
- tokens;
- passwords;
- private keys;
- cookies;
- sessions;
- unredacted production data;
- real user private data;
- credentials or secret URLs.

If a secret is relevant, mention only the environment variable name, secret manager location, or redacted placeholder.

Example:

```text
Requires `FOO_API_KEY`, but the value must be obtained from the team's secret manager.
```

## Language Rules

The skill instructions are written in English, but generated handoff documents must use the user's language.

Use the user's language for:

- filename;
- document title;
- document body;
- section content.

Examples:

- Chinese conversation → Chinese handoff filename/title/body.
- English conversation → English handoff filename/title/body.
- Japanese conversation → Japanese handoff filename/title/body.

## Filename Rules

Create new handoff files using:

```text
YYYY-MM-DD-<minimal-summary-in-user-language>.md
```

Examples:

```text
.handoff/2026-05-13-订单导出权限交接.md
.handoff/2026-05-13-用户服务分页重构交接.md
.handoff/2026-05-13-order-export-auth-handoff.md
```

The summary must be concise and based on the handoff content.

Do not overwrite existing files.

If the target filename already exists, append a numeric suffix:

```text
2026-05-13-订单导出权限交接-2.md
2026-05-13-订单导出权限交接-3.md
```

## Off Mode: Create a New Handoff

Use **off** mode to create a new handoff document.

### Minimum Quality Gate

Do not create vague, low-information handoff documents.

Before writing, ensure the handoff can answer at least:

1. What is the goal?
2. What is the current state?
3. What should happen next?

If these cannot be inferred, ask the user one most important clarifying question.

Do not create documents where major sections are only “unknown”, “TBD”, or “not sure”.

### Context Sources

Use the current conversation and any already-known project context.

Only read project files when necessary to create a useful handoff.

Do not perform broad repository exploration unless it is needed.

Do not require reading `CLAUDE.md`, `AGENTS.md`, `README.md`, or `CONTRIBUTING.md`; assume the surrounding agent environment handles project conventions.

### Deduplication with Existing Artifacts

Do not duplicate content already captured in other artifacts. This includes PRDs, plans, ADRs, issues, commits, diffs, specs, and design documents.

Reference them by file path or URL instead.

Example:

```text
See architecture decision in `docs/adr/0003-event-sourcing.md`.
Implementation plan at `.claude/plans/pagination-refactor.md`.
Related issue: https://github.com/org/repo/issues/42
```

If a piece of information is already recorded elsewhere and still current, a path reference is sufficient. Only inline context that exists nowhere else or that the next session cannot easily locate.

### Existing Handoff Documents

If `.handoff/` contains existing handoff documents:

- do not read their bodies by default;
- inspect filenames/titles only;
- use them to decide whether there may be a related previous handoff.

If an existing handoff is clearly related, include it under “Related previous handoffs”.

If unsure whether a previous handoff should be linked, ask the user.

Do not edit the previous handoff.

Do not merge with the previous handoff.

A new handoff may reference old handoffs to form a progressive chain of work.

### Handoff Document Template

Use this structure by default, in the user's language.

Adjust section emphasis according to any focus instruction after `/handoff`, but keep the document self-contained.

```markdown
# <Minimal handoff title>

## Metadata
- Created:
- Project:
- Branch:
- Related previous handoffs:

## One-sentence summary
<One or two concise sentences describing what this handoff is about.>

## Goal
<What the work is ultimately trying to accomplish.>

## Current state
<What has been completed, what is still open, and where the work currently stands.>

## Key context
<Background, constraints, user requirements, important reasoning, and assumptions the next session must know.>

## Relevant files
<List relevant files and explain why each matters.>

## Completed work
- [ ] <Use checkboxes when helpful.>

## Remaining work
- [ ] <Use ordered or checklisted next work items.>

## Attempts so far

### Worked
- <What was tried and helped.>

### Did not work / do not repeat
- <Failed paths, misleading approaches, or things the next session should avoid repeating.>

## Decisions
- <Important decision, reason, and consequence.>

## Risks and pitfalls
- <Edge cases, hidden dependencies, failing tests, environment issues, or likely mistakes.>

## Next steps
1. <Concrete next action.>
2. <Concrete next action.>
3. <Concrete next action.>

## Suggested starting action
<The first thing the zero-context future self should do after reading this handoff.>

## Verification
<How to confirm the work is correct: tests, lint, build commands, manual checks, or expected behavior.>

## Suggested skills
<List skills the next session should invoke to continue the work effectively. Include the skill name and a one-line reason.>

## Current Git state
<Summarize read-only git status/diff/log information. Do not include full diffs.>
```

### Writing Style

Write for fast resumption.

Prefer concrete, actionable statements.

Avoid generic wording like:

```text
Continue working on the task.
```

Prefer:

```text
Start by reading `src/order/export/OrderExportService.java`, then run `./gradlew test --tests OrderExportServiceTest`.
```

Do not include full raw conversation transcripts.

Summarize user intent, decisions, and constraints structurally instead.

## On Mode: Resume from Existing Handoff

Use **on** mode to read existing handoff documents and prepare to resume.

### Missing Handoff Directory or Documents

If `.handoff/` does not exist, or it contains no `.md` handoff documents:

- do not create a document;
- do not guess;
- tell the user there is no handoff document to resume from;
- suggest running `/handoff off` in a session that has useful context.

### Listing Multiple Documents

If multiple handoff documents exist:

- do not read their bodies;
- list only filenames/titles;
- sort newest first;
- prefer filename date order descending;
- use file modification time as a fallback;
- ask the user which one to resume.

Example:

```text
Found multiple handoff documents. Which one should I resume?

1. 2026-05-13 订单导出权限交接
2. 2026-05-12 用户分页重构交接
3. 2026-05-10 Serena Java LSP 调研交接
```

The user may respond with:

- a number;
- full title;
- partial title;
- keyword.

Read the selected document only after the user chooses.

### Filtering

If the user provides text in **on** mode, filter by filename/title only.

If exactly one document matches, read it.

If multiple documents match, list matching titles and ask the user to choose.

If none match, say no matching handoff document was found.

Do not search document bodies unless the user explicitly asks.

### Single Document

If exactly one handoff document exists and no filter is needed, read it directly.

### Related Previous Handoffs

If the selected handoff document references related previous handoffs:

- do not automatically read them;
- tell the user that related previous handoffs exist;
- offer to read one or more if needed.

This enables progressive nested handoffs without exploding context.

### After Reading

After reading a handoff document, do not immediately edit code.

Do not immediately run side-effect commands.

First provide a resume confirmation that includes:

1. understood goal;
2. current state;
3. likely next steps;
4. risks or uncertainty;
5. whether related previous handoffs exist;
6. current read-only git status if available.

Allowed read-only checks after reading:

```bash
git status --short
git diff --stat
```

Use these to warn if the current worktree may differ from the handoff document.

Then wait for the user to explicitly continue before making changes.

## Core Principle

A handoff document is not a task tracker, status database, or archive manager.

It is a new, immutable local Markdown note that helps the user's future zero-context self continue the work safely.

Create new handoffs.

Read existing handoffs.

Never delete or edit old handoffs.
