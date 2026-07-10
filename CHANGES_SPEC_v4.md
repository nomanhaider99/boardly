# Boardly — Change Request Spec (v4): Design Refresh + AI Board Agent

## 0. Context for Claude Code

App is live and working at boardly-psi-ruby.vercel.app. This round covers: a visual refresh (dark mode contrast, button sizing, landing page redesign per reference image, new marketing pages, footer), and one major new feature — a per-board, per-user AI agent that can take real actions on the board (post comments, move cards) and do web search, using Vercel AI SDK, with a switchable Gemini/Claude model backend.

---

## 1. Dark Mode Background — Lighten It

- Current dark background is too close to pure black — shift to a softer dark (e.g. `#121212`–`#171717` range, or a very dark desaturated charcoal) rather than `#000`/`#0a0a0a`
- Keep the existing green accent system as-is — this is a base/surface color change only, not a full repaint
- Check contrast on cards, dialogs, and any "frosted glass" surfaces still read correctly against the new base — frosted/translucent elements are the most likely to look off after this change, verify those first

## 2. Button Sizing

- Increase default button height/padding app-wide (likely a shadcn `button.tsx` variant change, not a one-off per button) — slightly larger tap targets and more breathing room in label padding
- Apply consistently: primary CTAs, dialog actions (Save/Cancel), card actions, nav buttons — check all variants/sizes defined in the button component, not just the default one
- Don't blow out small icon-only buttons (e.g. close/X buttons) to the same scale — use judgment, confirm with me if a particular button looks oversized once changed

## 3. Landing Page Redesign + New Pages + Footer

Reference: attached Vortasky AI landing page image.

**Landing page direction to take from the reference (adapt, don't clone 1:1 — keep Boardly's own green accent, not purple):**
- Top nav: logo + wordmark, horizontal nav links, "Log in" button on the right
- Hero: small pill/badge above headline (e.g. "✦ Manage Boards Effortlessly"), large bold two-line headline, subtext paragraph, two CTA buttons side by side (primary filled + secondary outline/ghost) — e.g. "Get Started" + "See How It Works"
- Below hero: a product screenshot/mockup of an actual board view, styled like a floating "browser window" card, optionally with small floating connector icons either side (skip this detail if it adds noticeable complexity for little payoff — Claude Code's call)
- "Why Choose Boardly" section: 2-column feature cards, each with a small icon, heading, short description, and a simple visual representation underneath (mirroring the reference's layout pattern, not its content)
- Testimonials section: grid/list of client/user quote cards with avatar, name, role, short quote
- Final CTA band before footer

**New pages needed (4–5), each as a real route with content, linked from the nav:**
- `/features` — expands on what's in the hero/feature section, more detail
- `/pricing` — pricing tiers (even if just "Free" for now, structure it so paid tiers can be added later)
- `/about` — what Boardly is, who it's for
- `/contact` — contact form (name, email, message → send via existing Resend setup) or at minimum a "email us" mailto link styled well
- Optional 5th: `/blog` or `/changelog` — Claude Code can propose which is more useful given current scope, or skip if time-constrained

**Footer (site-wide, not just landing page):**
- Logo/wordmark, short tagline
- Link columns (Product, Company, Legal — or whatever grouping fits the pages above)
- "Email us" link (mailto or link to `/contact`)
- Copyright line with current year, dynamically generated (not hardcoded)

**Consistency requirement:** once the landing page direction (spacing, button styles, card styles, pill badges, section padding rhythm) is established, apply that same visual language to the new pages and to the footer — don't let the marketing pages diverge stylistically from the rest of the app.

## 4. Major Feature: Per-Board, Per-User AI Agent

This is the big one. Build in sub-steps, confirm each before moving to the next.

### 4.1 Concept
- Each board has an AI agent available to it
- The agent is scoped per-user *within* that board — i.e. two different users on the same board each have their own agent conversation/session, not a shared one (their chat history and context don't mix)
- Agent has tool access to take real actions on the board on the user's behalf, and can web search

### 4.2 Tools the agent needs
- `addComment(cardId, text)` — post a comment on a card as that user
- `moveCard(cardId, targetListId, position?)` — move a card to a different list (and trigger the same real-time broadcast as a manual drag, so other viewers see it too)
- `webSearch(query)` — general web search tool
- Propose 1–2 more obviously useful tools if there are cheap wins (e.g. `createCard(listId, title)`, `findCard(query)` to resolve "move the pricing card" into an actual card ID without the user knowing it) — confirm with me before adding scope beyond what's listed
- Tool execution must respect the user's actual permissions in that workspace/board — the agent acts *as* the user, not as a superuser; if the user couldn't do something manually, the agent can't either

### 4.3 Model backend — switchable Gemini / Claude
- Use Vercel AI SDK's provider abstraction so the underlying model is swappable without rewriting the agent logic
- User (or workspace, Claude Code to decide which scope makes more sense and confirm) can pick which model family powers their agent — Gemini or Claude — store that preference
- Both API keys (Gemini, Anthropic) are available as env vars — Claude Code should NOT hardcode either; read from env, fail gracefully with a clear error if a selected provider's key is missing
- Tool-calling/function-calling must work consistently across both providers — confirm during planning that the chosen tool definitions are compatible with both before building

### 4.4 UI
- Floating action button, bottom-right corner of the board page, label like "Ask Agent to do work" (icon + short label, not just an icon)
- Click opens a chat panel (slide-up panel or docked corner window, not a full-page takeover — should feel like a persistent helper, not a navigation away from the board)
- Standard chat UX: message history (scrollable), input box, send button, streaming response rendering (Vercel AI SDK's streaming hooks)
- When the agent performs a tool action (comment posted, card moved), show that clearly in the chat thread (e.g. "✓ Moved 'Highpriority peptides' to List 12") distinct from plain text replies — user should never wonder whether something actually happened
- Model switcher (Gemini/Claude) visible and accessible from within the agent panel, not buried in a separate settings page
- Respect existing dark/light theme and the new button sizing/visual language from sections 1–3

### 4.5 Safety/scope guardrails for this pass
- No destructive tools yet (no `deleteCard`, no `deleteBoard`) — keep v1 of the agent additive/constructive only
- Rate limit or otherwise guard against runaway tool-calling loops (e.g. cap tool calls per single user message)

---

## Suggested Order of Implementation

1. Dark mode background lightening (smallest, isolated, do first to get a quick visible win)
2. Button sizing pass
3. Landing page redesign
4. New pages + footer
5. AI Agent — sub-order:
   a. Vercel AI SDK setup + provider abstraction (Gemini + Claude both wired, basic chat working with no tools yet)
   b. Model switcher UI + preference storage
   c. Tool implementation: addComment, moveCard, webSearch (one at a time, test each before the next)
   d. Agent panel UI polish (floating button, chat panel, tool-action visual feedback)
   e. Per-user session scoping + permission enforcement — verify two different users on the same board truly get isolated agent sessions
