# Portable integration tests: case guide

[Module guide](test_portable.md) · [Source](test_portable.py)

Each method below belongs to `PortableTests`, takes `self`, returns `None` and uses unittest assertions.
Names describe the intended regression checks; this index is not an execution result.

| Test method | Responsibility |
| --- | --- |
| `test_dry_run_then_init_repeat_is_byte_identical` | dry run then init repeat is byte identical. |
| `test_default_initial_state_new_and_no_later_redeclaration` | default initial state new and no later redeclaration. |
| `test_init_guidance_resolves_to_installed_status_without_changing_state_on_repeat` | init guidance resolves to installed status without changing state on repeat. |
| `test_init_guidance_is_only_emitted_after_successful_console_initialization` | init guidance is only emitted after successful console initialization. |
| `test_factual_entry_points_never_import_advice_or_mutate_initialized_project` | factual entry points never import advice or mutate initialized project. |
| `test_purpose_focus_adapter_installs_exactly_without_resetting_unregistered_work` | purpose focus adapter installs exactly without resetting unregistered work. |
| `test_governance_focus_installs_without_changing_lifecycle_or_authority` | governance focus installs without changing lifecycle or authority. |
| `test_missing_governance_focus_template_fails_before_any_writes` | missing governance focus template fails before any writes. |
| `test_advice_report_creates_planning_parents_without_changing_state` | advice report creates planning parents without changing state. |
| `test_preserves_client_instructions_documents_and_ignore` | preserves client instructions documents and ignore. |
| `test_existing_codex_config_conflict_has_no_side_effects` | existing codex config conflict has no side effects. |
| `test_foreign_binding_and_legacy_data_are_not_overwritten` | foreign binding and legacy data are not overwritten. |
| `test_edited_adapter_is_preserved_and_verification_fails` | edited adapter is preserved and verification fails. |
| `test_malformed_or_missing_state_is_never_recreated` | malformed or missing state is never recreated. |
| `test_symlink_destination_is_rejected` | symlink destination is rejected. |
| `test_relocation_and_subdirectory_invocation` | relocation and subdirectory invocation. |
| `test_rejects_non_git_and_external_root` | rejects non git and external root. |
| `test_inactive_sprint_blocks_patch_and_arbitrary_shell` | inactive sprint blocks patch and arbitrary shell. |
| `test_active_sprint_checks_every_path_and_is_preserved` | active sprint checks every path and is preserved. |
| `test_protected_governance_traversal_and_symlink_scope_blocked` | protected governance traversal and symlink scope blocked. |
| `test_guard_failure_fallback_and_unknown_tool` | guard failure fallback and unknown tool. |
| `test_guard_allows_only_local_factual_status` | guard allows only local factual status. |
| `test_logs_ignored_state_retained_and_no_raw_tool_data` | logs ignored state retained and no raw tool data. |
| `test_recorded_evidence_and_release_survive_repeat_init` | recorded evidence and release survive repeat init. |
| `test_advice_context_and_environment_without_model_call` | advice context and environment without model call. |
| `test_transaction_rolls_back_only_its_own_changes` | transaction rolls back only its own changes. |
