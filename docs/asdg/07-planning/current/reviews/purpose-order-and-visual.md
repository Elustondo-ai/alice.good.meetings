# Purpose document order and illustration — maintenance review

On 20 October 2026, Pablo requested numbered Purpose documents and an embedded image stored in an `images/` subfolder.

The documents are ordered `01-purpose.md`, `02-current-capabilities.md` and `03-planned-improvements.md`.
The README and cross-links use those names; earlier content and decision status were retained.
The Purpose procedure, contract, package guidance and native/template adapters were aligned with numbering and supporting image assets.
Shared rules retain the bounded Purpose allowance; other stages' layouts and application gates were retained.

The purpose illustration was generated with the built-in `image_gen.imagegen` tool and copied into the client documentation.
It depicts the desired interview experience and the outcomes of attention, recall and clear answers.
Its caption identifies it as a vision illustration, including future capabilities, rather than an implemented UI.
The full generation prompt is retained in [asset metadata](../../../02-purpose/images/speaker-coach-purpose.json).
The image was visually inspected: the question, keywords and three outcome labels are readable and correctly spelled.

## Verification and limits

ASDG structure verification and `git diff --check` passed.
Changed Markdown length and relative-link checks passed; the PNG signature and 1536 × 1024 dimensions were checked.
Exact-hash modification records retain previous document paths, content hashes and image provenance.
No application code changed; no new application tests were needed for this documentation update.
Fresh-session native behavior and trusted hook enforcement remain unverified.
Earlier review events and unrelated edits were retained; no lifecycle transition, commit or publication occurred.
