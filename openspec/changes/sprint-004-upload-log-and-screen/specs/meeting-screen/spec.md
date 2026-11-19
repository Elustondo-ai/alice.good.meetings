# Meeting screen

## Purpose

Give Pablo a calm screen he can read at a glance from a second monitor in any meeting. Rules SA-1 to SA-18 and SS-1 to SS-10 are on the 08 pages [areas](../../../../../docs/asdg/08-low-level-design/03.7.1-s004-screen-areas.md) and [states](../../../../../docs/asdg/08-low-level-design/03.7.2-s004-screen-states.md); the UC-05 answer states map to the screen states there. Commitments S004-SCREEN and S004-MEETING.

## ADDED Requirements

### Requirement: Five areas
The screen SHALL stack a sticky bar of 80 px (56 px in a window under 640 px high) with the avatar and the small name on the left, an empty centre and the buttons on the right, then the Question box, the Candidate line and two columns, "Alice suggests" and "What I hear"; it SHALL have no details box, no second question boxes, no cue buttons and no diagnostic readout unless `#diagnostics` is in the address.

#### Scenario: Wide window
- **WHEN** the window is 1280 × 900
- **THEN** the bar shows a left block, an empty centre and a right block, and the four areas below it follow in order.

### Requirement: The page scrolls and nothing is clipped
The page SHALL scroll in a short window with no area clipping its content, and SHALL have no horizontal scroll from 320 px wide.

#### Scenario: Short window
- **WHEN** the window is 1280 × 500
- **THEN** the page scrolls and the last line of the columns is reachable.

### Requirement: The cue colour, the cue word and the name
The bar SHALL be coloured by the cue (GOOD `#1b7f2a`, LAND IT `#a35c00`, STOP `#b3261e`) with white text, SHALL show a 16 px bold cue word at the left of the second row of its right block, followed by the monitor line, and SHALL carry the cue in its accessible name. With the avatar shown the name "Alice Good Meetings" SHALL be an 11 px regular caption under its head, hidden in a window under 640 px high; without the avatar the name SHALL show at 20 px bold.

#### Scenario: Land it
- **WHEN** the timer reaches 25 seconds of speech
- **THEN** the bar turns amber and shows LAND IT.

### Requirement: The centre of the bar is reserved
The centre of the bar between its left and right blocks SHALL be empty in this sprint, reserved for a future "Alice says" area, holding no text, border, placeholder or control and at least a quarter of the bar's width from 900 px wide.

#### Scenario: Wide window
- **WHEN** the window is 1280 wide
- **THEN** the centre of the bar holds nothing.

### Requirement: The question dominates, bullets follow
The Question SHALL be bold and sized by its length (34 to 64 px up to 90 characters, 28 to 48 px up to 180, 24 to 36 px beyond) without truncation, at least 1.5 times the bullet size, with at most three bold bullets, and the "What I hear" column SHALL show the newest transcript item bold and older items faded at contrast 4.5:1 or more.

#### Scenario: Long question
- **WHEN** a 190-character question is confirmed
- **THEN** it shows in full at a smaller size and the box grows.

### Requirement: Six states with their wording
The screen SHALL show the not listening, listening, candidate present, answer pending, error and package missing states with the wording of the states page, with an error row between the bar and the Question for each cause, and "No new question heard." for a pause with no new question.

#### Scenario: No key
- **WHEN** the service has no key
- **THEN** a bold row says "No OpenAI key is set up.", Start and Upload are disabled and nothing else is hidden.

### Requirement: Bold, contrast and no motion
Weight 700 SHALL be on exactly the cue word, the name only without the avatar, the Question, tags, bullets, newest words, an enabled Confirm and error lines; text SHALL meet 4.5:1 contrast (3:1 for large text); content SHALL change in place without animation or sound, except that the avatar box of the \`avatar\` capability alone MAY move, and show service text as plain text.

#### Scenario: Computed weights
- **WHEN** the page is measured
- **THEN** only the listed elements have weight 700 or more.

### Requirement: The screen says meeting
Visible text, tooltips and accessible names SHALL say "meeting" and never "interview".

#### Scenario: Scan
- **WHEN** the page text is scanned
- **THEN** it holds no word "interview".
