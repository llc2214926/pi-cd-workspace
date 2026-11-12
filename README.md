# pi-cd-workspace

**[English](README.md)** | [简体中文](README.ZH.md)

An independent Pi extension for switching workspaces: keep the current session, start fresh, or open Pi's native resume picker. Extracted from pi-file-sidebar, including its column picker, mouse navigation, position bars, long-name bubbles and bilingual interface.

Requires Node **>=22.19.0** and stable Pi **>=1.4.0** (build metadata accepted, prereleases rejected). Development baseline: Pi **1.5.0**, with **1.4.0** as the compatibility target. Version acceptance does not guarantee compatibility with every future host or terminal. Fullscreen and regular TUI are supported; RPC/print/JSON remain silent. No build step or runtime dependencies: Pi loads `extensions/index.ts` and supplies its SDK/TUI peers.

## Installation and migration

From this repository, register the local package:

```bash
pi install /absolute/path/to/pi-cd-workspace
# Then /reload or restart Pi.
```

Try the source without registering or loading other installed extensions:

```bash
pi --no-extensions -e ./extensions/index.ts --tui-mode fullscreen
# Optional: load the split sidebar too (either order works).
pi --no-extensions -e ./extensions/index.ts -e ../pi-file-sidebar/extensions/index.ts --tui-mode fullscreen
```

**Update pi-file-sidebar to the split source before enabling this extension.** Older sidebar installations and legacy `~/.pi/agent/extensions/cd-picker.ts` also register `/cd`; do not load those together with this package. Back up old installations first. Source edits do not update an installed copy, and this extension never installs, disables or rewrites other extensions for you.

The old `/file-sidebar cd` alias and sidebar directory-menu switching actions are removed, not forwarded. Use `/cd` to browse or `/cd <encoded-path>` to switch directly. Existing sessions, `cd-picker` markers, `.cd-backup` and `.cd-abandoned` files remain compatible; no session migration is needed. Language now belongs to this extension: set `/cd-workspace lang en` if desired. It does not read or modify the sidebar's language preference.

For a standalone distributable copy, run `npm pack`, unpack its `package/` into a new directory, and `pi install` that directory. Do not register both source and packed copies at once. Package files include both READMEs and all runtime source, not tests, development dependencies or artifacts.

## Commands

| Command | Different real directory | Current real directory (including aliases/symlinks) |
|---|---|---|
| `/cd [encoded-path]` | Preserve current session/history and restore draft text | Notice only, no switch |
| `/cd-new [encoded-path]` | New ID and empty conversation/draft | Native `/new` |
| `/cd-resume [encoded-path]` | New empty session, then open native `/resume` | Open `/resume` only, without a new session |
| `/cd-workspace` | Show usage | Same |
| `/cd-workspace lang [zh\|en]` | Set/save the language, or show it if omitted | Same |

Without a path, all three cd commands open the same picker. Arguments are **URI-encoded paths**, not shell-quoted strings: `/cd %2FUsers%2Fme%2FMy%20Project`. Encode the entire path once with `encodeURIComponent`. Relative paths resolve against `ctx.cwd`; `~` and `~/…` are supported. Malformed encoding and NUL are rejected. The selected target is revalidated with `realpath`, directory type, and read/execute access; explicitly provided symlinks are resolved. No shell runs.

Run from the main editor while Pi is idle, with no queued messages or blocking UI. A shared in-flight lock prevents mixed cd requests from overlapping. If another component owns focus (including sidebar navigation, resizing or external editing), return to the editor first; this extension does not force it to close. Commands recheck idle/UI availability after picking. `/cd` and cross-directory switching require persistence; same-directory new/resume work with `--no-session`.

## Picker

A centered double-border overlay uses 85% terminal width and at most 90% terminal height / 30 rows including the frame. It never replaces the persistent layout. Columns are separated by vertical rules; long names use an ellipsis. Theme and language changes redraw without rereading directories.

Each column sorts directories first, then regular files, alphabetically within each group. Files are dim even when selected, have no `/` suffix, and cannot be entered, confirmed, opened or read. Symlinks and special entries are omitted. Only entered levels are read asynchronously; there is no recursion, watcher or polling. Loading, empty and read-error states are distinct; stale reads are discarded after navigating away or disposing.

| Input | Behavior |
|---|---|
| ↑ / ↓, j / k | Move selection; held arrows accelerate to 2 rows after ~1.1s, 3 after ~2.6s |
| ← | Parent / previous column |
| → / l | Enter highlighted directory; no action on files |
| . (also 。) | Toggle dot entries and `node_modules` |
| r | Return to the workspace where the picker opened, selecting its `.` row; not refresh or confirmation |
| Enter | Confirm highlighted directory, including the `.` row; no action on files |
| Esc / Ctrl+C | Cancel, without creating a session snapshot or backup |
| Left click (fullscreen) | Select files or `.`, select and enter directories; **never confirms a switch** |
| Wheel (fullscreen) | Scroll only the pointed column, preserving selection, active column and focus |
| [ / ] | Page an overflowing full-name bubble |

Reversing direction, pausing longer than 450ms, or a non-arrow action resets acceleration; j/k always move one row. Only terminal key repeat is used, with no timer or extra reads. `r` discards descendant columns and offsets, hides the bubble, preserves the hidden toggle and reuses the workspace column when possible. `h` has no picker action; `l` navigates, it does not change language.

Each scrolled column has its own right-edge position bar, including inactive parents. It remains visible while idle and hides at the top or when all rows fit. It reserves one content column (unless only one column fits); it is not draggable or clickable. Wheel events on a bar scroll its column. Boundaries, frame, title, footer, separators and loading/error rows consume wheel events rather than scrolling the conversation. Scrolling does not read directories. Selection movement reveals the selected row again.

Clicking a visible parent column discards its old descendants. Headers, footers, separators, bars, blank/loading/error rows, right clicks, hover and drag do not navigate. Stale mouse coordinates after a read or layout change cannot select a replacement row. Regular TUI remains keyboard-only.

A truncated selected name opens a rounded, non-capturing full-name bubble, capped at 80 columns × 12 rows and constrained to the terminal. It may extend beyond its column, wraps by display width and supports `[` / `]` or wheel paging. It never changes selection or focus. It retracts when the row leaves view, selection fits, or the picker closes. Names, paths and errors are sanitized for display; filesystem paths remain unchanged. No file contents enter model context.

## Session safety

- `/cd` exclusively creates a private `0600` JSONL snapshot preserving the ID, header metadata, all entries/branches and active leaf. A non-model `cd-picker` marker records `{ from, to }`. It does **not** resume the target project's previous conversation.
- The host `switchSession()` lifecycle rebuilds cwd-bound resources, tools and extensions under Pi's trust rules. No `process.chdir`, host patch, command-message bridge, or model call is used. Post-switch work uses only the fresh `withSession` context.
- Draft text is restored for `/cd`; **cursor position is not guaranteed**. Restoration errors warn. Cancelling a picker preserves the original editor object and draft.
- After verified takeover, `/cd` archives the source as `.cd-backup` (UUID suffix on collision). A source not yet flushed needs no archive. `EXDEV` falls back to exclusive copy and retains the source, with a warning. Archive failures leave the new session active and original file intact.
- Fresh modes never copy old messages, branches, summaries, names, extension state, parent links or drafts, and never archive/modify the original session. Because Pi 1.4/1.5 `newSession()` cannot accept cwd, cross-directory fresh modes stage a header-only JSONL and use `switchSession()`; lifecycle reason is `resume` although the session ID/history are new. Same-directory `/cd-new` calls `newSession()` directly, with no staged file.
- Default session storage follows the target directory; explicitly configured session storage stays unchanged.
- Cancelling or a catchable pre-takeover failure quarantines the staged file as `.cd-abandoned` (UUID on collision), never deletes it. Partial writes are also quarantined when possible; a failed quarantine reports the surviving path. Backups/quarantined files stay out of `/resume`.
- Native resume uses the current editor's `app.session.resume` action. Pi owns selection, search, scope, rename/delete and cancellation; no history is automatically selected. Cancelling after a cross-directory resume leaves the empty target session; cancelling same-directory resume keeps the original. Missing custom-editor capabilities warn instead of sending `/resume` to a model. If opening the list fails after takeover, the target session remains active; use `/resume` manually.

**Host failure limitation:** Pi may destroy the old runtime and then exit on a fatal replacement error before the extension can catch it. Automatic UI rollback or quarantine cannot be promised on fatal exit/process termination. Both paths are displayed before switching and the original is not archived before verified takeover. Restart with `pi --session '/absolute/path/to/original.jsonl'`; inspect an unclaimed target `.jsonl` manually before moving it. Do not manipulate active sessions to test failure handling.

## Independence and language

This extension owns only `/cd`, `/cd-new`, `/cd-resume`, `/cd-workspace` and its temporary overlays. It registers no global shortcuts, changes no editor/header/footer/layout, and imports no sidebar code. Its ephemeral host-probe widget key is namespaced and removed synchronously. Shutdown cancels only its picker/bubbles and waits for its preference saves, not for the switch that triggered shutdown.

The split sidebar owns `/file-sidebar`, Ctrl+Shift+E, its layout and `file-sidebar.json`. Either package can be absent. Both use native prompt/focus/session lifecycle events, not a private event bridge. Sidebar off/on or language changes do not cancel/reconfigure the cd picker. After a successful session replacement, an installed sidebar naturally rebuilds its root and resets width; this is normal host behavior, not cross-extension control.

The interface defaults to Chinese. `/cd-workspace lang en` or `zh` saves only **`getAgentDir()/cd-workspace.json`**, honoring `PI_CODING_AGENT_DIR`. It never touches Pi settings, keybindings, project config, installed copies or `file-sidebar.json`.

```json
{ "language": "en" }
```

Startup is read-only; missing preferences default to Chinese. Explicit saves are serialized, use private same-directory temporary files and atomic replacement, preserve unknown fields, and are awaited on normal shutdown/reload. Symlinks, non-files, invalid JSON/UTF-8/language and files over 16 KiB are rejected. Invalid data is not overwritten. Save failure warns while keeping the current choice. No watcher: other Pi processes see the last successful save on their next startup/reload. Only this extension's text changes; paths, contents and Pi's own interface are not translated.

## Development and acceptance

```bash
npm install --ignore-scripts
npm run typecheck
# Local regressions (not included in Git or the package)
./node_modules/.bin/tsc -p tests/tsconfig.json
node --import tsx --test tests/*.test.ts
npm pack --dry-run
```

Run against Pi 1.5.0 and an isolated Pi 1.4.0 dependency tree. Both versions pass source/test type checks and local regressions for filesystem/session failure paths, picker rendering/input, and independent/co-loaded behavior in fullscreen and regular modes. The UI checks use Pi's real loader/components with an in-memory terminal and simulated command context. Unpacked packages also load independently and in either order without repository dependencies.

These checks do not replace formal human real-terminal acceptance, which remains pending. The latest background PTY attempt was blocked before Pi started (`os.openpty`: `Operation not permitted`); actual terminal session replacement/reload has not been revalidated after this split.

Manual checklist on both hosts:

- Each extension alone, both load orders, fullscreen/regular, 80/120 columns and narrow/short resizing; no duplicate commands or focus/wheel leakage.
- All three modes, same directory/aliases/links and cross-directory targets, spaces/Chinese/quotes/percent, missing/unreadable targets, in-memory restrictions, native resume select/cancel.
- Retained history/ID/draft for `/cd`; empty new IDs and untouched originals for fresh modes; new cwd/trust/resources after takeover, correct backup/quarantine behavior.
- Column/parent clicks and wheel, hidden toggle, r return, arrow acceleration, files-only/empty/error directories, full-name bubbles and independent position bars after idle/resize.
- Busy/queued messages, foreign modals/sidebar resizing/external editor, rapid mixed commands, reload while reading/picking/saving, and independent languages with isolated invalid/unwritable configs.
- Repeat from unpacked packages with no source-repository dependency. Never simulate failures using live session files.
