# Answer package

## Purpose

Load Pablo's interview preparation package strictly and never send more than he intends. Rules PK-1 to PK-10 are on the 08 page [package loader](../../../../../docs/asdg/08-low-level-design/03.5.5-s003-package-loader.md); sources are architecture 02 and the data statements. Commitment S003-CONTEXT.

## ADDED Requirements

### Requirement: Eligible files only
The loader SHALL read only regular files directly in `poc/context/interview/` (or the configured test folder) with extension `.txt` or `.md`, excluding dotfiles and any file named `README.md`, and SHALL skip links and subfolders. Skipped names SHALL appear only in the audit and start log.

#### Scenario: Link and README
- **WHEN** the folder holds a link to a file, a README.md and two notes
- **THEN** only the two notes are read and the others are listed as skipped.

### Requirement: A package within 20,000 characters or not at all
The loader SHALL use a package of at most 20,000 characters, SHALL NOT use a larger one and SHALL NOT cut it. A status of none, empty, unreadable, too-large or usable SHALL be decided in that order, and any unreadable file SHALL void the package.

#### Scenario: Boundary
- **WHEN** the package is exactly 20,000 characters, then 20,001
- **THEN** the first is used and the second is not, with status too-large.

### Requirement: Live code never reads the benchmark
No `poc/` source other than the files in `poc/review/` SHALL name, open, read, import or resolve a path under `eval-data/`, and nothing outside `poc/review/` SHALL import the reviewer script `poc/review/package-check.mjs`. The service start, `alice-run.sh` and `node --test poc/poc.test.mjs` SHALL never run it. The one existing 404 probe is allowed and listed.

#### Scenario: Static scan
- **WHEN** the sources under `poc/` are scanned
- **THEN** every occurrence of `eval-data` is under `poc/review/` or is the listed 404 probe, or the scan fails.

### Requirement: Held in memory only
The package SHALL be read once at session start, held in memory for that session and written nowhere. Its text SHALL go only to the answer generator, never to the page, audit, health reply, interview agent or test output.

#### Scenario: Audit
- **WHEN** a session starts with a package
- **THEN** the audit records status, file names, sizes, digests and skipped names, and no text.
