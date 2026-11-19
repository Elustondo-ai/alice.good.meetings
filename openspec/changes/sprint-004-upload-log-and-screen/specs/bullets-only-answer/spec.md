# Bullets-only answer

## Purpose

Remove the details area and stop asking the model for details, in both places the model returns an answer. Rules AD-1 to AD-4 are on the 08 page [answer without details](../../../../../docs/asdg/08-low-level-design/03.7.8-s004-answer-without-details.md). Commitment S004-SCREEN; decided by Pablo as Q11. 05 is to send its own wording.

## ADDED Requirements

### Requirement: Both calls ask for bullets only
The post-pause reader call and the fallback answer request SHALL ask, in their instructions and result schemas, for at most three bullets of at most 120 characters each and no details; the reader reply SHALL keep the question, coverage and bullets.

#### Scenario: Reader call
- **WHEN** the reader call is made after a pause
- **THEN** its instructions and schema name bullets and no details.

### Requirement: Details are rejected
A result from either call that carries a `details` field or any other unknown field SHALL be rejected whole, and no details limit SHALL exist.

#### Scenario: Fallback with details
- **WHEN** the fallback result holds a `details` field
- **THEN** the attempt fails and nothing is shown.

### Requirement: One bullets-only message
Both paths SHALL produce the same `proposed` message and state, with bullets and no details, for a shown or a general answer, and the log's answer event SHALL hold bullets only.

#### Scenario: General answer
- **WHEN** no usable package exists
- **THEN** the general answer holds bullets and a reason and no details.
