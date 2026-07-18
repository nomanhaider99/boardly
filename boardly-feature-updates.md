# Boardly — Feature Additions & Change Requests

**App:** Boardly (Trello-style board app)
**Stack:** Next.js, TypeScript, PostgreSQL (Neon), Drizzle ORM, Pusher (real-time), dnd-kit (drag & drop)
**Deployed:** https://boardly-psi-ruby.vercel.app/

This document lists new features and changes to be implemented. Each item includes the requirement, expected behavior, and implementation notes for Claude Code to work from.

---

## 1. Card Credentials Box

Add a **Credentials** section to each card, positioned **above the description box and below the banner image**.

- Card shows a compact trigger/button (e.g. "Credentials") that opens a dialog on click.
- Dialog lists saved credential entries for that card, each with:
  - An icon representing the service (e.g. Hostinger logo, GoDaddy logo).
  - A title, e.g. `[ClientName] Hosting Credentials` or `Domain Credentials`.
- Dialog includes an **"Add New Credential"** button. Clicking it opens a form with:
  - A title field (e.g. "Hostinger Domain and Hosting Credentials").
  - Two default key/value input rows (like `.env` variables — a "key" input and a "value" input per row).
  - An option to add more key/value rows dynamically.
  - Save button to persist the entry.
- **Data model:** new `card_credentials` table — `id`, `card_id`, `title`, `icon`/`service_type`, `created_by`, `created_at`. A related `credential_fields` table — `id`, `credential_id`, `key`, `value`, `order`.
- **Security note:** credential values should be encrypted at rest (or at minimum masked in the UI with a show/hide toggle), since this stores sensitive login data.

---

## 2. Search Within Card Comments

Currently, finding an old comment requires scrolling through the entire comment thread — poor UX.

- Add a search input at the top of the comments section on a card.
- Typing a keyword filters/highlights matching comments **instantly** (client-side filter as you type, no page reload).
- Matching comment(s) should scroll into view and highlight the matched text (similar to browser Ctrl+F behavior).

---

## 3. Per-Member Card Move Restriction

In the **Members** assignment dialog (or member settings within board settings):

- Add a toggle per member: **"Allow card movement"**.
- When **ON** (default): member can drag/move cards between lists as normal.
- When **OFF**: member can still view/open the card, but drag-and-drop (and any manual "move to list" action) is disabled for that member on that board.
- **Data model:** add a `can_move_cards` boolean column to the board-membership table (e.g. `board_members.can_move_cards`, default `true`).
- Enforce this both in the UI (disable drag handles / move controls) and on the backend (reject move requests server-side for restricted members).

---

## 4. Member Search Bar

- Add a search input at the top of the **Members** dialog.
- Typing filters the member list in real time by name/email.

---

## 5. Default Board Background Images

- When a new board is created, automatically assign a background image from a curated set of **5–7 default images**.
- Board background should be changeable later via **Settings → Appearance tab** (see Item 6), where the user can pick from the same default image set (or a solid color, if that's already supported).
- Store the chosen background reference on the board record (e.g. `boards.background_image_url` or a `background_key` referencing a preset).

---

## 6. Reorganize Board Settings into Tabs

Restructure the board Settings panel into multiple tabs instead of a single flat view. Suggested tabs (5–7 total):

1. **Manage Members** — invite, remove, roles, and the new "Allow card movement" toggle (Item 3), plus member search (Item 4).
2. **Appearance** — background image picker (Item 5), theme/color options if applicable.
3. **Board Settings** — general board name, description, visibility, archive/delete board.
4. **Labels** — manage board-level labels, including the new priority labels (Item 8).
5. **Activity Log** — board activity/audit history (if already available elsewhere, surface it here).
6. **Notifications** — per-board notification preferences (if applicable).
7. **Automation / Integrations** — placeholder tab for future automation rules (optional, only if it fits current scope).

Use a left-side or top tab navigation within the settings dialog/panel, consistent with the existing design system.

---

## 7. Video Upload Support (App-Wide)

- Enable video file uploads anywhere file/image attachments are currently supported (card attachments, comments, etc.).
- **Max file size: 15MB** per video.
- Validate file type (common formats: `.mp4`, `.mov`, `.webm`) and size client-side before upload, and re-validate server-side.
- Show a clear error message if a file exceeds 15MB or is an unsupported format.
- Uploaded videos should render with an inline player (not just a download link) wherever attachments are displayed.

---

## 8. Priority Labels

Add a set of built-in priority labels usable on any card, e.g.:

- **No Rush**
- **Normal**
- **Urgent**
- **Critical**

(Pick 3–4 final names/colors.) These should behave like existing labels (assignable, filterable, color-coded) but be seeded by default on every board so users don't have to create them manually. Consider visually distinguishing priority labels from regular custom labels (e.g. a small flag/priority icon).

---

## 9. Comment Editing

- Allow a **logged-in user to edit only their own comments**.
- Add an "Edit" action (e.g. via a `...` menu) visible only to the comment's author.
- On save, update the comment content and mark it as edited.
- Display an **"Edited on [Date - Time]"** label on the comment (small, muted text near the timestamp).
- **Data model:** add `edited_at` (nullable timestamp) to the comments table. Show the "Edited" label only when `edited_at` is not null.
- Backend must enforce author-only editing (reject edit requests from non-authors even if attempted via API).

---

## 10. Link Preview: Add Page Title (Description Box)

Currently, pasting a link into the description box only shows the **favicon**, not the page title.

- When a link is pasted, fetch and display both the **favicon** and the **page title** (similar to Trello/Notion link unfurling).
- Implementation: use an Open Graph / metadata scraper on the backend (fetch the URL server-side, parse `<title>` and OG tags) to avoid CORS issues, then return `{ title, favicon, url }` to render as a rich link preview chip.
- Fallback: if title can't be fetched, show the raw URL as before (keep current favicon-only behavior as the fallback, not a breaking change).

---

## Suggested Implementation Order

1. Item 8 (priority labels) — quick win, low complexity.
2. Item 10 (link title) — self-contained, backend metadata fetch.
3. Item 4 + Item 2 (search bars) — straightforward UI/filtering work.
4. Item 9 (comment editing) — moderate, touches comments schema.
5. Item 3 (move restriction) — touches permissions/DnD logic.
6. Item 6 (settings tabs) — restructuring work, do before Item 5 since Appearance tab lives inside it.
7. Item 5 (default backgrounds) — depends on Item 6.
8. Item 7 (video upload) — larger scope, storage/size validation.
9. Item 1 (credentials box) — largest scope: new schema, encryption, dialog UI.
