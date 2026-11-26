---
name: mit-design
description: Audits a real codebase or architecture proposal using MIT Axiomatic Design (FRs × DPs design matrix), reorders rows and columns to find irreducible coupling, and explicitly classifies what is easy to refactor, what should NOT be changed (healthy lower-triangular foundations, clean diagonal modules, intentional feedback loops, low-churn pragmatism), and what is high-risk coupled core. Use when the user asks for MIT设计, mit-design, 公理设计, 设计矩阵, 下三角, 对角阵, 架构体检, 耦合分析, 看看好不好改, 哪些不适合改, 哪些好改, 海盗船架构, or in English "axiomatic design", "design matrix", "coupling audit", "FR DP matrix", or wants to check module boundaries before starting a new project or refactoring.
---

# Axiomatic Design Audit & Changeability Map

Evaluate a codebase or architecture proposal by mapping **Functional Requirements (FRs)** to **Design Parameters (DPs)**, reordering the matrix into its tightest lower-triangular form, and turning the result into an actionable **changeability map**: what is **safe and easy to improve**, what **should not be changed**, and what is a **high-risk coupled core**.

Read-only by default. Do not edit target project code unless the user explicitly asks to refactor after seeing the audit.

---

## Non-Negotiable Rules

1. **Read real code; never hallucinate a matrix from a README.**
   - Every non-zero cell (`X`, `x`, `!`) in a codebase audit must be backed by observed imports, calls, callbacks, shared tables/files, implicit contracts, or shared runtime state (`file:line`).
   - If auditing a proposal/PRD with no code yet, state upfront that the matrix is pre-implementation and verified against the spec only.
2. **Lower-triangular is usually better than diagonal in software.**
   - Do **not** treat non-zero entries below the diagonal as defects. Software naturally shares foundational layers (config, auth, data models, storage, HTTP clients).
   - Never recommend duplicating code, introducing speculative event buses, or fragmenting small cohesive packages just to chase a pure diagonal matrix.
3. **Always reorder rows and columns before judging coupling.**
   - A matrix with upper-right entries may simply be poorly ordered. Topologically sort modules from foundational/leaf dependencies to top-level orchestrators first.
   - Only upper-right entries (`!`) that **cannot be eliminated by any row/column permutation** represent true circular dependencies or hidden back-edges.
4. **Look beyond static imports.**
   Check four coupling channels:
   - **Code coupling**: direct calls, mutual references, bidirectional callbacks.
   - **Data coupling**: multiple modules reading and writing the same database tables, caches, or config files with implicit ordering.
   - **Contract coupling**: implicit cross-module assumptions (for example, an LLM prompt hardcoding character counts to fit a template's layout width, or a parser regex pinned to upstream prose).
   - **Runtime/resource coupling**: unrelated features sharing mutable state (a single circuit breaker, rate limiter, connection pool lock, global flag, or combined feature toggle).
5. **Say when an architecture is good.**
   - Do not invent problems to look thorough. If the codebase is already cleanly lower-triangular with only minor or intentional exceptions, lead with that verdict.

---

## Workflow

### Step 1: Gather Ground Truth
- **Small/medium repo**: Inspect module/file layout, symbol outlines, cross-file references, storage table read/write sites, callback wiring, shared clients/locks, and prompt/template contracts.
- **Large repo**: Scope to the requested subsystem or architectural boundary; state explicitly what was excluded.
- **New design / PRD (Design-Time Mode)**: Skip code inspection. Extract FRs and proposed DPs from the design doc, run Steps 2–4 to catch two early traps before coding starts:
  - One switch, state field, or API controlling two FRs that must evolve independently (the "fixed cannon on a pirate ship" trap).
  - Unnecessary bidirectional dependencies (`A ↔ B`) that can be turned one-way before implementation.

### Step 2: Extract FRs and DPs
- **FRs (rows)**: 5–10 independent functional goals or axes of change (too coarse hides coupling; too fine buries the signal). Phrase each FR as an observable outcome, not a class name.
- **DPs (columns)**: The concrete modules, files, services, storage schemas, or templates primarily responsible for fulfilling those FRs.
- Check cardinality:
  - **FRs > DPs (under-actuated / overloaded module)**: One knob or file controls multiple independent goals — flag where changing one goal forces touching another.
  - **Clean 1:1 with layered reuse**: Healthy baseline.

### Step 3: Build & Optimally Reorder the Matrix
Sort rows and columns together from least dependent (bottom/leaf) to most dependent (top orchestrator):
1. Pure leaves / isolated adapters (often become pure diagonal rows).
2. Transport / storage / core state machines.
3. Pure domain computation / rules.
4. Schedulers / planners / AI / renderers.
5. Top-level orchestrators / entrypoints.

Mark each cell `(FR_i, DP_j)` by answering: *"Does changing `DP_j` (or its runtime behavior) directly affect `FR_i`?"*
- `X` — Primary implementation (main diagonal).
- `x` — Valid one-way dependency (strictly below the diagonal).
- `!` — Irreducible upper-triangular violation: reverse dependency, circular loop, implicit back-contract, or shared mutable runtime state (strictly above the diagonal).
- `·` — No direct impact (`0`).

### Step 4: Classify Actionability (Mandatory)
Every audit **must** explicitly separate findings into three buckets so the user knows where to act and where to keep hands off.

#### 1. Safe & Easy to Change (Easy Wins)
Identify parts that are low-risk to modify or cheap to decouple:
- **Pure diagonal modules**: Self-contained leaves (e.g., an isolated notification sender or adapter) that can be swapped or modified without side effects.
- **Accidental upper-right coupling**: Co-located responsibilities or shared runtime guards (e.g., a schedule trigger living inside a different subsystem's loop, or an auxiliary task sharing the main circuit breaker/lock) where a small boundary cut removes a `!` cleanly.
- For each item, state: **what to change**, **exact files/lines**, **blast radius**, and **what becomes independent afterward**.

#### 2. Do Not Change / Leave Alone (Not Worth Refactoring)
Explicitly call out parts that look non-diagonal on paper but **should not be touched**:
- **Healthy lower-triangular foundations**: Shared config, core schemas, read-only metrics/analyzers. Reusing them is good engineering, not coupling debt.
- **Intentional business feedback loops**: Closed loops required by the domain (e.g., an evaluator updating a priority watchlist consumed by a scheduler) that are already softened via callbacks, queues, or storage indirection. Explain *why* breaking the loop would harm the product.
- **Low-churn pragmatic coupling**: Small-codebase co-location (e.g., multiple layers in one small package) or tight template/prompt pairs that rarely change. Always include a **revisit trigger** (e.g., *"Leave alone now; decouple only if layout changes become weekly or a second output format is added"*).
- **Clean boundaries to protect**: Call out what is already well-separated so future edits do not accidentally pollute it.

#### 3. High-Risk Coupled Core (Modify With Caution)
Identify genuine "pirate ship" zones — irreducible cycles or multi-file implicit contracts where fixing `FR_a` breaks `FR_b`:
- Name the exact cycle (`A ↔ B` or `A → B → C → A`) and concrete failure mode when edited.
- Warn **against opportunistic refactoring** during unrelated feature work.
- Give the **minimum safe seam** if change is eventually unavoidable (freeze contract/schema → add characterization tests → split one direction at a time).

### Step 5: Present Clearly
- **Verdict first (1–2 lines)**: Overall architecture shape (diagonal / clean lower-triangular / lower-triangular with N localized upper-right breaks / heavily coupled) and whether refactoring is needed now.
- **Visual matrix**:
  - In environments supporting inline HTML rendering (such as T3 Code), render a compact, theme-aware matrix card via `html_preview` + `html_render` distinguishing `X` (diagonal), `x` (lower-triangular), `!` (upper-right breaks with numbered callouts), and `·` (zero).
  - In plain-text environments, output a cleanly aligned monospace matrix table.
- **Structured action map**:
  1. **Clean boundaries worth keeping** (brief, concrete praise backed by code — skip if none).
  2. **Easy to change / worthwhile decouplings** (ranked by payoff-to-effort, with `file:line`).
  3. **Do not change right now** (healthy lower-triangular base, intentional loops, and low-churn pragmatism — each with a clear reason and revisit trigger).
  4. **High-risk coupled zones** (if any — failure mode + safe seam).
- Keep the final report grounded in the user's real maintenance pain, not academic jargon.
