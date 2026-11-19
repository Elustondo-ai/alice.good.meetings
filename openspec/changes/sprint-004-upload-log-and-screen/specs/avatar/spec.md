# Avatar

## Purpose

Show a small animated face of Alice in the bar that follows what the page already knows, as Pablo's explicit exception to the no-motion rule. Rules AV-1 to AV-8 are on the 08 page [avatar](../../../../../docs/asdg/08-low-level-design/03.7.9-s004-avatar.md); the adapter design is 05 01.11. Commitment S004-AVATAR (plan criterion 11). Decided by Pablo on 19 November 2026.

## ADDED Requirements

### Requirement: A small round box in the bar
The page SHALL show the avatar in a round box of 56 px (52 to 60) at the left end of the bar like a logo with the name as a small caption beneath, 48 px under 900 px, 36 px under 500 px and 40 px in a window under 640 px high, decorative and hidden from assistive technology, without changing the size of any other area or the size order.

#### Scenario: Avatar shown
- **WHEN** the avatar is loaded
- **THEN** the box sits at the left end of the bar and the Question, candidate and columns keep their sizes.

### Requirement: Six states follow the screen
The box SHALL carry its state as idle, listening, question, researching, ready or error, derived from the screen states: idle when not listening or stopped, listening while listening or a candidate is present, researching while an answer is pending, and error while an error row shows.

#### Scenario: Answer pending
- **WHEN** an answer is being prepared
- **THEN** the state is researching.

### Requirement: Timed states and priority
The question state SHALL last 1.5 seconds from a candidate appearing or the Focus version rising, the ready state 2.5 seconds from an answer being shown, and a failed answer SHALL show error for 3 seconds; a timed state SHALL NOT restart within 3 seconds, error SHALL outrank every other state, and times SHALL use the page's standard clock.

#### Scenario: Answer arrives
- **WHEN** an answer is shown
- **THEN** the state is ready for 2.5 seconds and then listening.

### Requirement: Only light motion
The avatar SHALL only blink occasionally when idle and make one short expression, or one small nod if the library has it, on each change of state, with no other head movement and no hand gestures; it SHALL draw at about 15 frames per second and stop drawing while the tab is hidden; it SHALL make no sound or speech.

#### Scenario: Hidden tab
- **WHEN** the tab is hidden
- **THEN** the avatar stops drawing.

### Requirement: The one exception to no motion
The avatar box SHALL be the only element that may move and nothing outside it SHALL animate or flash.

#### Scenario: Outside the box
- **WHEN** the page is observed for two seconds with the avatar on
- **THEN** no pixel outside the box changes without a content change.

### Requirement: Toggle, key and quiet failure
A visible 32 × 32 px toggle after Download log in the bar, and the key A outside buttons, links and fields, SHALL switch the avatar and the choice SHALL be remembered in the browser, on by default. The avatar and toggle SHALL be absent with the system's reduced-motion setting and SHALL be removed silently, with no message, on any load failure, missing WebGL or lost context within 5 seconds, leaving the page as it was, with the name at 20 px bold.

#### Scenario: Model missing
- **WHEN** the model file cannot be loaded
- **THEN** the box and toggle disappear without a message and Start, Upload and the page work.

### Requirement: Vendored, read-only and isolated
TalkingHead, three.js and the model SHALL be vendored, pinned and committed in `poc/vendor/`, each with its licence file beside it, listed in the service's fixed file list and loaded from the page's own origin by the adapter `poc/avatar.js` (with `poc/avatar.md`) through a dynamic import, with the CC0 `mpfb.glb` first. The adapter SHALL read a frozen copy of the page state, have no write path to the cue, timer, audio, service or log, and run inside its own try/catch.

#### Scenario: Adapter throws
- **WHEN** the adapter throws
- **THEN** the cue, timer, keys and audio sends keep working.
