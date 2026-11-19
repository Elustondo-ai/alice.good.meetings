# Screen controls

## Purpose

Keep every input tool Pablo has, moving the manual cue to keys and adding Space and Esc. Rules SC-1 to SC-11 and SS-11 are on the 08 pages [controls](../../../../../docs/asdg/08-low-level-design/03.7.3-s004-controls-and-inputs.md) and [states](../../../../../docs/asdg/08-low-level-design/03.7.2-s004-screen-states.md). Commitment S004-CUE and the "add, never remove" principle.

## ADDED Requirements

### Requirement: Buttons and their states
The bar SHALL hold Start listening, Stop listening, Upload package and Download log in that order, each enabled only in its states with its cause shown as text; the Candidate line SHALL hold Confirm and Clear; Remove SHALL appear in the package line when a package is loaded.

#### Scenario: While listening
- **WHEN** a session is listening
- **THEN** Start, Upload and Remove are disabled with a visible reason and Stop is enabled.

### Requirement: Keys confirm, clear and set the cue
Space SHALL confirm the candidate and Esc clear it while one is present, and G, L and S SHALL set the cue, A SHALL toggle the avatar, to GOOD, LAND IT and STOP in any state, only when keyboard focus is not on a button, link or text field and no modifier key is held; Confirm by button and by Space SHALL send the same request with a field recording which was used.

#### Scenario: Space with a candidate
- **WHEN** a candidate is present and Pablo presses Space with nothing focused
- **THEN** it is confirmed once and the page does not scroll.

#### Scenario: Button focused
- **WHEN** a button has focus and Pablo presses G
- **THEN** nothing happens, and Space presses that button.

### Requirement: A manual cue holds for 10 seconds
A cue set by a key SHALL show for 10 seconds, during which the timer does not change it; the latest key SHALL win and restart the hold; a new question, a Focus change, Start or Stop SHALL NOT end it; afterwards the timer's cue returns, GOOD when not listening. Timer and hold SHALL use only the page's standard clock.

#### Scenario: Two keys
- **WHEN** Pablo presses L and 6 seconds later S
- **THEN** STOP shows for 10 seconds from the second key, then the timer's cue returns.

### Requirement: Every input stays
The inputs SHALL be Start, Stop, Confirm, Clear, Space, Esc, G, L, S, A, the avatar toggle, Upload, Remove, Download and speech, with Tab order following the screen (the avatar toggle after Download) and a visible 3 px outline on focus, and no control to hide the monitor line.

#### Scenario: Tab order
- **WHEN** Pablo tabs through the page
- **THEN** focus visits the controls in screen order with a visible outline.
