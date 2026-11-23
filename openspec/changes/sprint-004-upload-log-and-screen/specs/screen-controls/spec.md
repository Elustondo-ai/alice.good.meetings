# Screen controls

## Purpose

Keep the input tools Pablo uses and add Space and Esc. The cue comes from the timer only: on 22 November 2026 Pablo removed the keys G, L and S and the 10-second manual cue hold, which this change first added, saying there is no point in telling himself good, land it or stop. Rules SC-1 to SC-11 and SS-11 are on the 08 pages [controls](../../../../../docs/asdg/08-low-level-design/03.7.3-s004-controls-and-inputs.md) and [states](../../../../../docs/asdg/08-low-level-design/03.7.2-s004-screen-states.md). Commitment S004-CUE; the "add, never remove" principle still holds for every tool he uses.

## ADDED Requirements

### Requirement: Buttons and their states
The bar SHALL hold Start listening, Stop listening, Upload package and Download log in that order, each enabled only in its states with its cause shown as text; the Candidate line SHALL hold Confirm and Clear; Remove SHALL appear in the package line when a package is loaded.

#### Scenario: While listening
- **WHEN** a session is listening
- **THEN** Start, Upload and Remove are disabled with a visible reason and Stop is enabled.

### Requirement: Keys confirm and clear
Space SHALL confirm the candidate and Esc clear it while one is present, and A SHALL toggle the avatar in any state, only when keyboard focus is not on a button, link or text field and no modifier key is held; Confirm by button and by Space SHALL send the same request with a field recording which was used.

#### Scenario: Space with a candidate
- **WHEN** a candidate is present and Pablo presses Space with nothing focused
- **THEN** it is confirmed once and the page does not scroll.

#### Scenario: Button focused
- **WHEN** a button has focus and Pablo presses Esc or A
- **THEN** nothing happens, and Space presses that button.

### Requirement: The cue comes from the timer only
The cue word and the bar colour SHALL be set only by the speaking timer, in every state: LAND IT after 25 seconds of speaking, STOP after 35 seconds, and GOOD otherwise and when not listening. No key or button SHALL set or hold the cue: the keys G, L and S and the 10-second manual hold were removed by Pablo's decision of 22 November 2026, and pressing G, L or S SHALL change nothing. The timer SHALL use only the page's standard clock.

#### Scenario: The timer sets the cue
- **WHEN** Pablo has spoken for more than 25 seconds and then for more than 35 seconds
- **THEN** the bar shows LAND IT and then STOP, and GOOD again after Stop listening.

#### Scenario: A removed key is pressed
- **WHEN** the cue is LAND IT and Pablo presses G, L or S
- **THEN** the cue word and the bar colour stay as they were and nothing is sent to the service.

### Requirement: The input inventory
The inputs SHALL be Start, Stop, Confirm, Clear, Space, Esc, A, the avatar toggle, Upload, Remove, Download and speech, and the keys G, L and S SHALL NOT be inputs (removed on 22 November 2026), with Tab order following the screen (the avatar toggle after Download) and a visible 3 px outline on focus, and no control to hide the monitor line.

#### Scenario: Tab order
- **WHEN** Pablo tabs through the page
- **THEN** focus visits the controls in screen order with a visible outline.
