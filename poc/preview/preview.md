# Preview script and styles

[Source: preview.js](preview.js) · [Source: preview.css](preview.css) · page [index.html](index.html), companion [index.md](index.md)

`preview.js` reads the address fragment (`state` = `empty`, `preparing`, `shown-short`, `shown-long`, `general`, `failed`, `unavailable`, `last-known`, plus the preview-only `last-known-empty`; `cue` = `good`, `land-it`, `stop`, default `good`), fills the page with invented text and the wording of labels LB-1 to LB-7, and re-renders on `hashchange`. With no valid fragment it shows the link list. It uses `textContent` only, so sample text is shown as plain text.

`preview.css` fixes the row heights (desktop 160 / 124 / 96 / 232 px, narrow 188 / 190 / 196 / 460 px) so cue, Focus, Live and answer card never move or resize across states; only the details area scrolls inside itself. The cue word uses the old page's `min(8rem, 20vw, 20vh)` (128 px at 1280 × 900), Focus and Live use its `clamp(14px, 2.2vmin, 20px)` (19.8 px). No animation or transition.

| Collaborator | Relation |
| --- | --- |
| [server.mjs](../server.mjs) | Serves the three files from its fixed list |
| [Specification 03.5.8](../../docs/asdg/08-low-level-design/03.5.8-s003-page-and-preview.md) | Rules PV-1 to PV-6 |
