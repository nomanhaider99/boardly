# Claude Code Kickoff Prompt — Boardly v2 Changes

Drop `CHANGES_SPEC_v2.md` into the project root (alongside the existing `PROJECT_SPEC.md`), then paste this:

---

I have a working app already (built from PROJECT_SPEC.md). Read `CHANGES_SPEC_v2.md` in this repo fully — it's a set of changes and new features to add on top of what exists. Before touching anything, inspect the current codebase structure (don't assume file names/locations from the original spec — the implementation may have evolved).

Ground rules, same as before:
1. Work through the sections in the "Suggested Order of Implementation" at the bottom of the spec, one at a time. Don't jump ahead.
2. For each section: give me a short plan (files touched, schema changes, any new packages, and your reasoning for any judgment calls the spec leaves open — e.g. urgency thresholds, WebSocket provider choice, role label scope) and wait for my go-ahead before writing code.
3. After each section, tell me how to manually test it, and pause for my confirmation before starting the next.
4. Don't break existing functionality — if a change touches shared code (e.g. the card component, comment query), check what else depends on it first.
5. Match existing theme/design system exactly for any new UI (profile page, dialogs, email templates) — don't introduce new colors/components outside what's already established unless necessary.

Start with Section 1: the card detail sidebar → dialog conversion. Give me your plan first.
