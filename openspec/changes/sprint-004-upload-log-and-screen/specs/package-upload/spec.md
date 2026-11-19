# Package upload

## Purpose

Let Pablo load his preparation package from the page, see what is loaded before Start and after a reload, and remove it. Rules SU-1 to SU-10 are on the 08 page [upload and download](../../../../../docs/asdg/08-low-level-design/03.7.4-s004-upload-and-download.md); states SS-1, SS-7 and SS-9 on [states](../../../../../docs/asdg/08-low-level-design/03.7.2-s004-screen-states.md). Commitments S004-STATUS and S004-UPLOAD; sources are 05 01.8 and 01.8.1 (see the [proposal](../../proposal.md)).

## ADDED Requirements

### Requirement: Several files replace the package
The page SHALL let Pablo pick several `.md` or `.txt` files, no folder and no zip, decode each as strict UTF-8, and send them to the service, which SHALL replace the package with them, keep them in memory only and keep them after Stop.

#### Scenario: Two notes
- **WHEN** Pablo picks two valid notes while not listening
- **THEN** the package is replaced, the line shows the file count, characters and source, and nothing is written to disk.

### Requirement: Safe limits and refusals keep the old package
The service SHALL accept only a caller with the right Host and Origin and a JSON content type, a body of at most 200 KB, at most 20 files of `.md` or `.txt`, no dotfiles, `README.md` skipped, at most 20,000 characters in total, and SHALL refuse the whole upload, keeping the old package, for a name with `/`, `\`, `..`, a drive letter, a NUL or control character or over 255 characters, and for text holding U+FFFD or NUL.

#### Scenario: Unsafe name
- **WHEN** an upload carries a file named `../notes.md`
- **THEN** the whole upload is refused as `refused`, the file is named and the previous package is still in use.

#### Scenario: Wrong content type
- **WHEN** a request is not `application/json`
- **THEN** it is refused as `content-type` and nothing changes.

### Requirement: Not while listening
Upload and Remove SHALL be disabled while listening and the service SHALL answer 409 with reason `listening` if asked anyway.

#### Scenario: Asked during a session
- **WHEN** a package route is called during a session
- **THEN** the answer is 409 `listening` and the package is unchanged.

### Requirement: Status before Start
The page SHALL ask `GET /package` on load, after an upload and after Stop and show the file count, characters and source (uploaded or folder) or "No package", never a file name or text.

#### Scenario: After a reload
- **WHEN** the page is reloaded with an uploaded package in the service
- **THEN** the foot of the Alice column shows its counts and source before Start.

### Requirement: Remove clears what is loaded
Remove SHALL send `DELETE /package` and clear the package loaded now, uploaded or folder. The folder package SHALL stay cleared until the service restarts, after which the status shows the folder package or "No package".

#### Scenario: Remove then restart
- **WHEN** Pablo removes a folder package and the service later restarts
- **THEN** the status shows the folder package again.

### Requirement: Package text stays in memory
No route SHALL return package text, and no file, log or audit SHALL hold it; the audit holds counts and names only.

#### Scenario: Canary text
- **WHEN** an uploaded file holds a unique sentinel sentence
- **THEN** the sentinel appears in no status, log, audit or page frame.
