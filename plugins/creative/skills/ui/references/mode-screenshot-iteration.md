# Screenshot Iteration Mode

Loaded from `ui` when the user supplies a screenshot of a rendered surface and wants it improved against that evidence.

Activate when the user sends a screenshot or image alongside a complaint ("这里很丑", "这个不对", "fix this", "looks wrong"). The existing product is the direction. Skip the five-question direction lock.

**Flow:**

1. Read the screenshot. State the problem in one sentence: what specifically looks wrong (spacing, contrast, alignment, typeface, color, density, hierarchy). Preserve the user's negative label when it is diagnostic; do not translate "丑", "乱", "不清晰", or "怪" into vague "make it modern" language.
2. Wait for the user to confirm the diagnosis before touching code.
3. If the user provides a reference screenshot, older version, or "this one is good" example, compare current vs. reference and name the visual deltas before choosing a fix.
4. If the diagnosis is a known UX problem (split-view sync, infinite scroll, virtualised list, sticky header), spend one round surveying how 2-3 mature products in the same category solve it before writing code. Cite what each does. Skip only if the fix is purely cosmetic (color, spacing, copy).
5. Find the responsible code: grep for the component name or class, read the actual file. Do not rely on memory or assumptions about file location.
6. Apply the minimal fix. For existing products, try material/opacity, geometry, spacing, typography, or text-fit adjustments before redesigning the surface.
7. Verify the result in a browser, native app, screenshot tool, or rendered artifact at desktop width and 375px mobile width when applicable. Check long words, localized strings, button labels, and compact states for overflow. If the host cannot render, say that explicitly and hand off the exact view the user should check.
8. Ask the user to verify in the browser. Do not hand off without this step.

**Calibration rules:**
- The user's screenshot is the strongest design brief in the turn. Keep it visible in the reasoning until the fix is done.
- The real running product is the oracle. Product pages, app screenshots, release pages, and current UI state override generic style instincts.
- Do not flatten specific taste feedback into generic UI adjectives. "More premium" is not a diagnosis; "caption baseline drifts above the Chinese line" is.
- If the screenshot exposes a regression, broken render, timing issue, or generated asset defect rather than taste, route to `/hunt` and preserve the visual evidence.

**Native screenshot handoff.** For native apps, once you have proven the app builds, runs, and can reach the target view, do not spend repeated cycles fighting focus, window ordering, or coordinate-click automation just to capture final visual proof. Make one bounded automation attempt. If it is flaky, name the exact screen and ask the user for the screenshot to iterate against. This is a visual QA boundary, not a substitute for build/run verification.

**Boundary**: if the fix requires changing 3 or more components, or if it reveals a direction problem rather than a specific bug, pause and run the full direction lock before continuing.

**Redesign priority order** (when reworking an existing UI rather than building from scratch): font replacement → color cleanup → hover/active states → layout and whitespace → replace generic components → add loading/empty/error states → typographic polish. This order maximizes visual lift while minimizing the blast radius of each pass. Full rules, common traps, and absolute CSS bans all live in `references/design-reference.md`.
