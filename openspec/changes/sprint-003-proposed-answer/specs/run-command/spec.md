# Run command

## Purpose

One command gets Alice ready without interrupting a session or printing the key. Rules RN-1 to RN-14 are on the 08 page [run script](../../../../../docs/asdg/08-low-level-design/03.5.9-s003-run-script.md). Commitment S003-RUN.

## ADDED Requirements

### Requirement: Start, reuse or refuse
`bash poc/alice-run.sh` SHALL start the service when nothing answers on the port, reuse this service when it is current and exit with a message and code 2 when another program answers, starting or stopping nothing.

#### Scenario: Another program on the port
- **WHEN** a different program answers on the port
- **THEN** the script names the port and exits 2.

### Requirement: Never interrupt a session
When this service is older than its sources or `poc/.env.local` the script SHALL end it and start a new one only if no session is active, and otherwise SHALL leave it running and say a restart is pending. Pablo accepted this behavior on 18 November 2026 (R6).

#### Scenario: Older with a session
- **WHEN** the running service is older and a session is active
- **THEN** it keeps running and the script exits 0 with the reason.

### Requirement: Probe limits and failures
The script SHALL treat a listener that does not reply to the health probe within 2 seconds as another program (exit 2), SHALL exit 3 when an older idle service will not end within 5 seconds, and SHALL exit 3 without a ready line when a started service exits before it answers.

#### Scenario: Silent listener
- **WHEN** a listener never replies to the probe
- **THEN** the probe ends after 2 seconds and the script exits 2.

#### Scenario: Service exits early
- **WHEN** the started service exits before answering health
- **THEN** the script exits 3 and prints no ready line.

### Requirement: No key, no secrets
The script SHALL start the service when `poc/.env.local` is missing and say that recognition and answers are unavailable, SHALL report ready only after the health check answers within 30 seconds (otherwise exit 3), and SHALL never print the key, env file contents or package text or contact any host but 127.0.0.1.

#### Scenario: Key never printed
- **WHEN** the script runs with a sentinel key in the env file
- **THEN** its output never contains the sentinel.
