# Layout preview

## Purpose

Pablo approves the layout from a static preview, by hash, before the page changes. Rules PV-1 to PV-5 are on the 08 page [page and preview](../../../../../docs/asdg/08-low-level-design/03.5.8-s003-page-and-preview.md). Commitments S003-PREVIEW, S003-LAYOUT.

## ADDED Requirements

### Requirement: A static preview of every state
A preview SHALL be served at `/preview` from static files under `poc/`, showing the seven states and Shown with the shortest and the longest content at 1280 × 900 and 390 × 844, the longest with each cue, chosen by address fragment, with Clear live, Start and Stop listening and the cue buttons each in one place, which Pablo approved on 18 November 2026.

#### Scenario: Choose a state
- **WHEN** the preview is opened with `#state=shown-long&cue=stop`
- **THEN** it shows the longest Shown content with the STOP cue.

### Requirement: No page change before a dated approval
`index.html` SHALL stay unchanged until a dated approval by Pablo exists that names the preview files by SHA-256 and those hashes equal the files' current bytes. A changed preview SHALL need a new approval.

#### Scenario: Preview edited after approval
- **WHEN** a preview file's hash differs from the approved one
- **THEN** the approval no longer counts and `index.html` stays unchanged.

### Requirement: Nothing real in the preview
The preview SHALL make no network request, use no microphone, key, package or OpenAI, and hold invented text only, never text from `eval-data/` or his package.

#### Scenario: Network
- **WHEN** the preview loads
- **THEN** no request leaves the page except for its own files.
