# Proposed answer page

## Purpose

Keep the cue, Focus, Live and the answer points readable at a glance, with the seven states worded distinctly and the details out of the way. Rules LB-1 to LB-9 and PG-1 to PG-14 are on the 08 pages [labels](../../../../../docs/asdg/08-low-level-design/03.5.3-s003-answer-labels.md) and [page and preview](../../../../../docs/asdg/08-low-level-design/03.5.8-s003-page-and-preview.md). Commitments S003-LAYOUT, S003-GLANCE, S003-DETAILS, S003-NOKEY.

## ADDED Requirements

### Requirement: Seven states with their own wording
The page SHALL show Empty, Preparing, Shown, General, Failed, Unavailable and Last known with the wording of the labels page, SHALL word Failed and Unavailable differently, SHALL show a reason with General and Unavailable, and SHALL give Failed no retry control. Wording is provisional until the preview is approved.

#### Scenario: General without a package
- **WHEN** an answer arrives and no usable package exists
- **THEN** the card is tagged as general points not from his documents, with the reason line.

### Requirement: Glance elements stay put
With the longest content the cue, Focus, Live and bullet card SHALL be fully visible, unclipped, not overlapped and no smaller than at revision `7d60c0f` on a desktop window, and SHALL keep their size and position as content changes. Long details SHALL scroll only inside their own area, with no collapse control, motion or sound.

#### Scenario: Longest details
- **WHEN** the longest details are shown at 1280 × 900
- **THEN** the details scroll inside their area and the four elements do not move.

### Requirement: Replace in place
A new Focus SHALL show Preparing with no earlier answer text in the same render. The page SHALL ignore an answer for another Focus version or a lower sequence, SHALL show text literally, and SHALL name the answer's Focus version and state in its render report.

#### Scenario: Stale message
- **WHEN** an answer for an earlier Focus version arrives
- **THEN** the page ignores it.

### Requirement: Last known keeps what it was
After Stop or disconnect the page SHALL mark the answer "Last known, not live" while keeping a General answer's tag and reason line or a Failed answer's note, and SHALL keep the Focus question with its own last-known mark.

#### Scenario: Stop after a general answer
- **WHEN** listening stops while a General answer is shown
- **THEN** the card shows the General tag, its reason line and "Last known, not live", and Focus is marked last known.

### Requirement: Page never holds secrets or leaves the origin
The page SHALL make only same-origin requests and SHALL never receive the key or the package text.

#### Scenario: Package sentinel
- **WHEN** a session runs with a synthetic package
- **THEN** no package text is in the page or its WebSocket frames.
