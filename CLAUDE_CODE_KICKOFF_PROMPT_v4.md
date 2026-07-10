# Claude Code Kickoff Prompt — Boardly v4 (Design Refresh + AI Agent)

Drop `CHANGES_SPEC_v4.md` into the project root (alongside the earlier spec files), then paste this:

---

Read `CHANGES_SPEC_v4.md` in this repo fully. This round has two parts: a design refresh (dark mode contrast, button sizing, landing page redesign, new pages, footer) and one major new feature — a per-board, per-user AI agent with tool-calling, switchable between Gemini and Claude models via Vercel AI SDK.

Ground rules, same as previous rounds:
1. Work through the "Suggested Order of Implementation" at the bottom of the spec, one item at a time — including the AI agent sub-steps (5a–5e), don't collapse those into one big push.
2. For each item: give me a short plan and wait for my go-ahead before writing code. For the AI agent specifically, I want to see the tool definitions and how permission-checking will work before you wire up any tool to actually execute.
3. After each item, tell me how to manually test it, and pause for my confirmation before the next item. For agent tools, test instructions must include verifying the action actually happened on the board (not just that the agent said it would).
4. Don't hardcode either API key — read from env vars, and if a selected model provider's key is missing, fail with a clear in-UI error, not a silent failure or crash.
5. The agent must only be able to do what the logged-in user could already do manually — confirm how you're enforcing that before building the tools, not after.
6. Match the existing visual language once established in step 3 (landing page) across the new pages, footer, and the agent panel UI.

Start with item 1: lightening the dark mode background. Give me your plan first.
