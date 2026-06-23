# Claude Code Kickoff Prompt

Paste this in the project's terminal/Claude Code session, with PROJECT_SPEC.md already sitting in the repo root.

---

I'm building a Trello clone called "Boardly" — full context is in `PROJECT_SPEC.md` in this repo. Read it fully before doing anything.

Ground rules for how we work together:
1. We build in phases, exactly as listed in section 6 of the spec. Do not jump ahead to later phases.
2. Before writing code for a phase, give me a short plan (files you'll create/touch, schema changes if any) and wait for my go-ahead.
3. After each phase, tell me how to test it manually, and pause for my confirmation before moving to the next phase.
4. Match the design direction in section 3 exactly — dark theme with green accent and frosted glass, light theme as a clean counterpart, both toggleable globally with next-themes, no flash of wrong theme on load.
5. Every async user action needs the full UX treatment from section 4.5 — disabled buttons + spinners + toasts. Don't skip this "for now," build it in from the start.
6. Use the tech stack in section 2 unless you have a strong reason to deviate — tell me the reason first if you want to deviate.

Let's start with Phase 1: project setup. Give me your plan first.
