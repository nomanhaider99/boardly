# Boardly — Change Request Spec (v3)

> Give this to Claude Code alongside `PROJECT_SPEC.md` and `CHANGES_SPEC_v2.md` (keep both — this is additive). Same working style: inspect current code first, plan, confirm, then build, one section at a time.

## 0. Context for Claude Code

This is a third round of changes on top of the existing Boardly app. Some of these overlap with items already attempted in `CHANGES_SPEC_v2.md` (mention highlighting, real-time card movement, member role labels) — before starting, check what's already implemented vs. still pending/broken from that file, and tell me the actual current state of each before proposing work. Don't assume v2 items are done just because they were spec'd.

---

## 1. Board-wide Card Search

Reference: Trello's top search bar (image 1).

- Add a search input scoped to the current board (top of board view, or wherever fits the existing layout)
- As the user types, filter/highlight matching cards by title across all lists on the board — live filtering, no submit button needed (debounce the input, ~200–300ms)
- Non-matching cards are hidden (or visually dimmed — Claude Code can decide whichever is cleaner given current board UI) while a search term is active; clearing the search restores full board view
- Clicking a matching card result opens that card's detail dialog directly (same dialog from v2's Section 1 change)
- If results span multiple lists, all matches across all lists should filter simultaneously — don't scope to one list

## 2. Mention Highlighting in Comments

Reference: image 2 — `@qualityassurance269` and `@projectmanager876` shown as a highlighted/pill-style token distinct from surrounding text.

- This was spec'd in v2 Section 6 — confirm current state first. If mentions are stored but not visually styled, this is a rendering fix only: wrap rendered `@username` tokens in a distinct style (background pill or colored bold text, matching the app's accent color) when displaying comments
- Applies both while composing (as already spec'd in v2) and in the final rendered/saved comment — don't style only the input, the saved/displayed comment must show it too

## 3. Admin Sets Usernames Per Board

- Clarification on top of v2 Section 5 (which scoped role labels to the workspace level): also allow setting a **per-board** display username/label for members, independent of their workspace-level role label
- Board admin/owner can, from board settings or a members panel on the board, assign a name/label to a member that's specific to that board context (e.g. someone could be "Upseller" on one board and "Developer" on another)
- Decide with Claude Code whether this needs its own table (`board_members` join with a `boardLabel` column) or can extend an existing board-membership concept — propose before implementing
- Where board membership doesn't already exist as its own concept (e.g. if board access is currently inherited entirely from workspace membership with no board-level row), Claude Code should flag that as a model question before building this, since it may require introducing board-level membership first

## 4. Real-Time Card Movement — Fix/Complete

- This was spec'd in v2 Section 4 (WebSockets) — confirm current implementation state honestly: is it implemented and broken, partially implemented, or not started.
- Requirement is unchanged from v2: when User A drags a card to a new list/position, any other user currently viewing that same board sees the move applied live, with no manual refresh
- If already attempted and broken, debug the existing implementation rather than necessarily starting over — but if the chosen real-time approach has a structural problem (e.g. wrong channel scoping, broadcasting from the wrong place, race condition with optimistic local state), Claude Code should explain the root cause before fixing it
- Test condition to confirm this works: two browser sessions (or one normal + one incognito) logged in as different users, both viewing the same board, drag in one and observe the other updates without refresh

---

## Suggested Order of Implementation

1. Confirm actual current state of mention highlighting and real-time movement (investigation, not coding) — report back before doing anything else
2. Mention highlighting fix (likely smallest, isolated)
3. Board-wide card search
4. Per-board member labels
5. Real-time card movement fix/completion (last, since it's the most likely to need real debugging time)
