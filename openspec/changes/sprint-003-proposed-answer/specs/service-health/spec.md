# Service health and no key

## Purpose

Let the page and the run script know what is available without opening a session, and keep the page useful with no OpenAI key. Rules HL-1 to HL-6 and NK-1 to NK-8 are on the 08 page [health and no key](../../../../../docs/asdg/08-low-level-design/03.5.4-s003-health-and-no-key.md). Commitments S003-NOKEY, S003-RUN.

## ADDED Requirements

### Requirement: Health reply
`GET /health` SHALL return the service name, start time, whether a key is configured, the session count and whether a package was found with its size, and SHALL never include the key, file names, package text or error text.

#### Scenario: Blank key
- **WHEN** the key is absent or blank
- **THEN** the reply says not configured and holds no key text.

### Requirement: Three no-key cases
The service SHALL start with no `poc/.env.local`, treat a blank key as absent and make no OpenAI connection without a key. A key that OpenAI rejects, recognized by its error code `invalid_api_key` or a 401 on the transcription handshake, SHALL be found only when a session starts, end it with the public error text and leave the page Unavailable. The rejection mapping is verified only against fixtures. `poc/start.sh` is outside this requirement.

#### Scenario: Page loads without a key
- **WHEN** the page loads and the reply says not configured
- **THEN** the answer card and Live say Unavailable with the reason, Start listening is disabled with that reason, and the timer and cue work.

### Requirement: No service
If the health reply is unreachable or names another service, the page SHALL show Unavailable and disable Start listening.

#### Scenario: Service not running
- **WHEN** the page is opened with no service
- **THEN** it says the service is not running.
