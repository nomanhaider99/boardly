# Claude Code Kickoff Prompt — Boardly v3 Changes

Drop `CHANGES_SPEC_v3.md` into the project root (alongside `PROJECT_SPEC.md` and `CHANGES_SPEC_v2.md`), then paste this:

---

Read `CHANGES_SPEC_v3.md` in this repo fully. This is a third round of changes — some items overlap with `CHANGES_SPEC_v2.md` (mention highlighting, real-time card movement, member labels). Before doing anything else, investigate and report back the actual current state of each overlapping item — implemented and working, implemented but broken, or never started. Don't assume anything based on what was spec'd before; check the real code.

Ground rules, same as previous rounds:
1. Work through the "Suggested Order of Implementation" at the bottom of the spec, one item at a time.
2. For each item: give me a short plan (files touched, schema changes if any, root cause if it's a bug fix) and wait for my go-ahead before writing code.
3. After each item, tell me exactly how to manually test it (including multi-user test steps for the real-time fix), and pause for my confirmation before moving to the next.
4. If something requires a model/schema decision not already settled in the spec (e.g. board-level membership for per-board labels), stop and ask me rather than guessing.
5. Match existing theme/design system for any new UI.

Start with the investigation step: report the current state of mention highlighting and real-time card movement before proposing any fixes.
