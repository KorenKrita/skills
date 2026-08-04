---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then work through whichever one you pick.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

Run the whole process yourself in this session. Do not hand any phase off to another Skill or subagent.

## Architecture rubric

Use these terms exactly in every suggestion — in the report, in the conversation, and in the recommendations. Don't drift into "component", "service", "API", "layer", or "boundary".

| Term | Meaning |
|---|---|
| **module** | Anything with an interface and an implementation: a function, class, package, or larger slice |
| **interface** | Everything a caller must know to use the module correctly, including invariants, errors, configuration, and performance characteristics |
| **implementation** | The behaviour hidden inside the module |
| **depth** | Leverage at the interface: how much behaviour callers can exercise per unit of interface they must learn |
| **deep** | A small interface hiding substantial behaviour |
| **shallow** | An interface nearly as complex as its implementation |
| **seam** | A place where behaviour can be altered without editing the caller at that place |
| **adapter** | A concrete implementation that satisfies an interface at a seam |
| **leverage** | More capability for callers and tests per unit of interface they learn |
| **locality** | Changes, bugs, knowledge, and verification concentrating in one place |

Principles to apply:

- **The deletion test** — would deleting this module concentrate complexity, or just move it? "Concentrates" is the signal you want.
- **The interface is the test surface** — a module is only as testable as its interface allows.
- **One adapter = hypothetical seam, two = real** — don't introduce a seam that only ever has one implementation.

Before recommending a deepening, classify the candidate's dependencies and choose the matching seam and test strategy from [DEEPENING.md](DEEPENING.md). Its `replace, don't layer` rule governs test migration.

## Process

### 1. Explore

**Scope before you scan — YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction — a module, a subsystem, a pain point — take it, and skip the inference below.
- Otherwise, walk back a good stretch of the commit history (`git log --oneline`) to find the codebase's hot spots — the files and areas that keep coming up — and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net.

If the project already keeps domain, architecture, or decision documents — a glossary, design notes, ADRs, whatever the repo actually uses — read the ones covering the area you're touching, and respect them. Don't assume any particular file or directory exists, and don't create these documents as part of this Skill.

Then walk the codebase yourself. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it for the user — `xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows — and tell them the absolute path.

The report uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals — use Mermaid when relationships are graph-shaped (call graphs, dependencies, sequences), and hand-built divs/SVG when you want something more editorial (mass diagrams, cross-sections, collapse animations). Each candidate gets a **before/after visualisation**. Be visual.

For each candidate, render a card with:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram** — side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength** — one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use the project's own domain vocabulary for domain concepts, and the rubric above for the architecture.** If the project calls the concept "Order", talk about "the Order intake module" — not "the FooBarHandler", and not "the Order service".

**Recorded-decision conflicts**: if a candidate contradicts a decision the project has already written down, only surface it when the friction is real enough to warrant revisiting that decision. Mark it clearly in the card (e.g. a warning callout: _"contradicts the recorded decision on X — but worth reopening because…"_). Don't list every theoretical refactor a past decision forbids.

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet. After the file is written, ask the user: "Which of these would you like to explore?"

### 3. Clarify the pick

Once the user picks a candidate, walk the decision tree with them yourself — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Interview them one question at a time, waiting for an answer before the next question, and give your recommended answer with each one. Look up *facts* in the codebase rather than asking; put the *decisions* to the user.

As decisions crystallise, keep the picture concrete:

- **Naming or sharpening a domain concept?** Once the user confirms the term, update the project's existing glossary or domain document immediately. If the project has no such document, offer to record the term in a project-appropriate location instead of inventing a fixed path.
- **User rejects the candidate with a load-bearing reason?** Restate it in the final recommendation. Offer to record it in the project's decision log only when it would prevent future reviewers from repeating the proposal: the decision is hard to reverse, surprising without context, and the result of a real trade-off. Skip ephemeral reasons.
- **Want to explore alternative interfaces for the deepened module?** Sketch two or three competing interfaces yourself, compare them against the rubric, and recommend one.

Finish with a concrete recommendation for the chosen candidate: the target interface, the seam, the migration order, and which tests move where.
