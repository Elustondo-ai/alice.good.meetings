"""Replacement acceptance exercises against disposable initialized client repositories."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

CORE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CORE / 'scripts/lib'))
from cli_files import Conflict, apply
from cli_project import plan_initialization
from cli_push import BUILD, SYNC, _changes, preview, recover, replace, verify_installed
from cli_push_inventory import canonical, digest
from distribution_files import package_files


def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], check=True,
                          capture_output=True, text=True).stdout.strip()


def seal(root):
    manifest = root / 'metadata/MANIFEST.json'
    value = json.loads(manifest.read_text())
    value['files'] = {path.relative_to(root).as_posix(): digest(path.read_bytes())
                      for path in package_files(root) if path != manifest}
    manifest.write_bytes(canonical(value))


class PushReplaceTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='asdg-push-acceptance-')
        self.addCleanup(temp.cleanup)
        self.area = Path(temp.name).resolve()
        self.source, self.client = self.area / 'canonical', self.area / "client's folder"
        self.source.mkdir()
        self.client.mkdir()
        for file in package_files(CORE):
            destination = self.source / file.relative_to(CORE)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, destination)
        seal(self.source)
        shutil.copytree(self.source, self.client / 'asdg')
        for root, origin in ((self.source, 'https://github.com/Elustondo-ai/asdg2.git'),
                             (self.client, 'https://example.test/team/client.git')):
            git(root, 'init', '-q')
            git(root, 'config', 'user.name', 'Fixture')
            git(root, 'config', 'user.email', 'fixture@example.test')
            git(root, 'remote', 'add', 'origin', origin)
            git(root, 'add', '.')
            git(root, 'commit', '-qm', 'fixture')
        (self.client / 'app.py').write_text('application work must survive\n')
        self.initialize('both')

    def initialize(self, client):
        _, changes = plan_initialization(self.client, self.client, client=client, timestamp='2026-11-24T00:00:00Z')
        apply(changes)

    def run_replace(self):
        plan = preview(self.source, self.client)
        self.assertEqual(plan['conflicts'], [])
        return replace(self.source, self.client, apply=True, expected_plan=plan['plan_id'])

    def test_both_clients_replace_preserve_verify_and_second_run_noop(self):
        owned = self.client / 'asdg/README.md'
        owned.write_text('local owned customization to replace\n')
        unknown = self.client / 'asdg/docs/private-client-notes.md'
        unknown.write_text('unowned extra\n')
        project = self.client / 'docs/asdg/02-purpose/notes.md'
        project.write_text('client purpose\n')
        original = {p: (self.client / p).read_bytes() for p in
                    ('app.py', '.asdg/project.json', '.asdg/sprint.json', '.asdg/lifecycle.json')}
        ledger = json.loads((self.client / '.asdg/document-reviews.json').read_text())['events']
        result = self.run_replace()
        self.assertTrue(result['applied'])
        self.assertEqual(owned.read_bytes(), (self.source / 'README.md').read_bytes())
        self.assertEqual(unknown.read_text(), 'unowned extra\n')
        self.assertEqual(project.read_text(), 'client purpose\n')
        for path, data in original.items():
            self.assertEqual((self.client / path).read_bytes(), data)
        new_ledger = json.loads((self.client / '.asdg/document-reviews.json').read_text())['events']
        self.assertEqual(new_ledger[:len(ledger)], ledger)
        self.assertTrue(verify_installed(self.client)['verified'])
        before = self.snapshot()
        next_run = self.run_replace()
        self.assertTrue(next_run['unchanged'])
        self.assertFalse(next_run['applied'])
        self.assertEqual(self.snapshot(), before)

    def snapshot(self):
        return {p.relative_to(self.client).as_posix(): (digest(p.read_bytes()), p.stat().st_mode)
                for p in self.client.rglob('*') if p.is_file() and '.git' not in p.relative_to(self.client).parts}

    def test_source_with_the_package_in_an_asdg_folder_replaces_identically(self):
        (self.client / 'asdg/README.md').write_text('local owned customization to replace\n')
        standalone = preview(self.source, self.client)
        workshop = self.area / 'workshop'
        shutil.copytree(self.source, workshop / 'asdg', ignore=shutil.ignore_patterns('.git'))
        (workshop / 'AGENTS.md').write_text('workshop instructions, never shipped\n')
        git(workshop, 'init', '-q')
        git(workshop, 'config', 'user.name', 'Fixture')
        git(workshop, 'config', 'user.email', 'fixture@example.test')
        git(workshop, 'remote', 'add', 'origin', 'https://github.com/Elustondo-ai/asdg2.git')
        git(workshop, 'add', '.')
        git(workshop, 'commit', '-qm', 'workshop layout')
        nested = preview(workshop, self.client)
        self.assertEqual(nested['conflicts'], [])
        self.assertEqual(nested['source']['commit'], git(workshop, 'rev-parse', 'HEAD'))
        self.assertEqual(nested['source']['package_sha256'], standalone['source']['package_sha256'])
        before, after = standalone['verification']['expected'], nested['verification']['expected']
        self.assertEqual(set(before), set(after))
        # Only the two records that name the source commit may differ between layouts.
        self.assertLessEqual({path for path in before if before[path] != after[path]}, {SYNC, BUILD})
        result = replace(workshop, self.client, apply=True, expected_plan=nested['plan_id'])
        self.assertTrue(result['applied'])
        self.assertTrue(verify_installed(self.client)['verified'])
        self.assertEqual((self.client / 'asdg/README.md').read_bytes(), (workshop / 'asdg/README.md').read_bytes())
        self.assertEqual((self.client / 'app.py').read_text(), 'application work must survive\n')
        # The workshop's own root instructions are outside the package and never reach the client.
        self.assertNotIn('workshop instructions', (self.client / 'AGENTS.md').read_text())

    def test_a_source_under_the_former_name_replaces_and_is_recorded_under_that_name(self):
        workshop = self.area / 'former'
        shutil.copytree(self.source, workshop / 'asdg', ignore=shutil.ignore_patterns('.git'))
        git(workshop, 'init', '-q')
        git(workshop, 'config', 'user.name', 'Fixture')
        git(workshop, 'config', 'user.email', 'fixture@example.test')
        git(workshop, 'remote', 'add', 'origin', 'https://github.com/Elustondo-ai/asdg.git')
        git(workshop, 'add', '.')
        git(workshop, 'commit', '-qm', 'former repository name')
        plan = preview(workshop, self.client)
        self.assertEqual(plan['conflicts'], [])
        self.assertEqual(plan['source']['repository'], 'github.com/elustondo-ai/asdg')
        self.assertTrue(replace(workshop, self.client, apply=True, expected_plan=plan['plan_id'])['applied'])
        self.assertTrue(verify_installed(self.client)['verified'])
        state = json.loads((self.client / SYNC).read_text())['upstreams']
        self.assertEqual(state['github.com/elustondo-ai/asdg']['source_commit'], git(workshop, 'rev-parse', 'HEAD'))
        receipt = json.loads((self.client / '.asdg/installation-ownership.json').read_text())
        self.assertEqual(receipt['source']['repository'], 'github.com/elustondo-ai/asdg')
        again = replace(workshop, self.client, apply=True, expected_plan=preview(workshop, self.client)['plan_id'])
        self.assertTrue(again['unchanged'])
        self.assertFalse(again['applied'])

    def test_setup_and_replacement_agree_on_every_integration_file(self):
        # Setup has just run for both clients. With the same package, replacement may add only its own
        # records; any other path here means the two commands disagree about an integration file.
        records = {SYNC, BUILD, '.asdg/installation-ownership.json'}
        plan = preview(self.source, self.client)
        self.assertEqual(plan['conflicts'], [])
        self.assertEqual({change['path'] for change in plan['changes']} - records, set())
        # The same holds when the project already had its own Claude instructions before setup.
        notes = '# Team Claude notes\nUse plan mode.\n'
        (self.client / 'CLAUDE.md').write_text(notes)
        self.initialize('both')
        self.assertTrue((self.client / 'CLAUDE.md').read_text().endswith(notes))
        plan = preview(self.source, self.client)
        self.assertEqual({change['path'] for change in plan['changes']} - records, set())
        # And in the other order: after replacement, setup has nothing left to change.
        self.assertTrue(replace(self.source, self.client, apply=True, expected_plan=plan['plan_id'])['applied'])
        before = self.snapshot()
        self.initialize('both')
        self.assertEqual(self.snapshot(), before)

    def test_plan_is_clock_independent_and_target_edit_invalidates(self):
        with patch('cli_push.now', return_value='2020-01-01T00:00:00Z'):
            first = preview(self.source, self.client)
        with patch('cli_push.now', return_value='2030-01-01T00:00:00Z'):
            second = preview(self.source, self.client)
        self.assertEqual(first['plan_id'], second['plan_id'])
        self.assertEqual(first['changes'], second['changes'])
        (self.client / 'AGENTS.md').write_text((self.client / 'AGENTS.md').read_text() + '\nUser instruction\n')
        before = self.snapshot()
        with self.assertRaises(Conflict):
            replace(self.source, self.client, apply=True, expected_plan=first['plan_id'])
        self.assertEqual(before, self.snapshot())

    def test_source_edit_and_review_event_invalidate_plan(self):
        first = preview(self.source, self.client)
        (self.source / 'README.md').write_text('new source\n')
        seal(self.source)
        with self.assertRaises(Conflict):
            replace(self.source, self.client, apply=True, expected_plan=first['plan_id'])
        second = preview(self.source, self.client)
        path = self.client / '.asdg/document-reviews.json'
        ledger = json.loads(path.read_text())
        ledger['events'].append({'user_event': 'preserve'})
        path.write_bytes(canonical(ledger))
        with self.assertRaises(Conflict):
            replace(self.source, self.client, apply=True, expected_plan=second['plan_id'])

    def test_unknown_new_distribution_collision_blocks(self):
        name = 'docs/new-owned.md'
        (self.source / name).write_text('incoming\n')
        index = self.source / 'metadata/package-files.json'
        value = json.loads(index.read_text())
        value['files'].append(name)
        index.write_bytes(canonical(value))
        seal(self.source)
        (self.client / 'asdg' / name).write_text('existing unknown\n')
        plan = preview(self.source, self.client)
        self.assertTrue(plan['conflicts'])
        with self.assertRaises(Conflict):
            replace(self.source, self.client, apply=True, expected_plan=plan['plan_id'])

    def test_unknown_receipt_path_cannot_delete_application(self):
        self.run_replace()
        path = self.client / '.asdg/installation-ownership.json'
        value = json.loads(path.read_text())
        value['entries'][0]['path'] = 'app.py'
        path.write_bytes(canonical(value))
        with self.assertRaises(Conflict):
            preview(self.source, self.client)
        self.assertEqual((self.client / 'app.py').read_text(), 'application work must survive\n')

    def test_cli_preview_apply_verify(self):
        entry = CORE / 'scripts/cli.py'
        common = [sys.executable, '-B', str(entry), 'push-replace', '--target', str(self.client), '--json']
        result = subprocess.run(common + ['--source', str(self.source), '--dry-run'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(result.stdout)
        result = subprocess.run(common + ['--source', str(self.source), '--apply', '--plan', plan['plan_id']],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run(common + ['--verify'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['verified'])

    def test_existing_zero_mode_is_not_widened(self):
        with patch('cli_push._state', return_value={'sha256': digest(b'old'), 'mode': 0}):
            changes = _changes(self.client, {'AGENTS.md': b'new'})
        self.assertEqual(changes[0]['after_mode'], 0)

    def test_mismatched_running_generator_is_rejected(self):
        path = self.source / 'scripts/lib/cli_push.py'
        path.write_bytes(path.read_bytes() + b'\n# different generator\n')
        seal(self.source)
        with self.assertRaisesRegex(Conflict, 'generator differs'):
            preview(self.source, self.client)

    def test_duplicate_shared_receipts_and_empty_selection_are_rejected(self):
        for name, bad in (
                ('.asdg/integrations.json', b'{"schema_version":1,"clients":{},"clients":{}}'),
                ('.asdg/integrations.json', b'{"schema_version":1,"clients":{}}'),
                ('asdg/metadata/sync-state.json', b'{"schema_version":1,"upstreams":{},"upstreams":{}}')):
            path = self.client / name
            old = path.read_bytes() if path.exists() else None
            path.write_bytes(bad)
            with self.assertRaises(Conflict):
                preview(self.source, self.client)
            if old is None:
                path.unlink()
            else:
                path.write_bytes(old)

    def test_unfinished_publication_blocks_noop_and_resumes_without_source(self):
        import cli_push_transaction as transaction
        original = transaction._journal
        def interrupt(root, txid, state, **details):
            if state == 'COMMITTED':
                raise KeyboardInterrupt('simulated interruption after publication')
            return original(root, txid, state, **details)
        plan = preview(self.source, self.client)
        with patch.object(transaction, '_journal', side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt):
                replace(self.source, self.client, apply=True, expected_plan=plan['plan_id'])
        with self.assertRaises(Conflict):
            preview(self.source, self.client)
        with self.assertRaises(Conflict):
            verify_installed(self.client)
        txid = next((self.client / '.asdg/backups/push-replace').iterdir()).name
        shutil.rmtree(self.source)
        result = recover(self.client, txid, 'resume')
        self.assertEqual(result['recovery']['state'], 'COMMITTED')
        self.assertTrue(verify_installed(self.client)['verified'])


if __name__ == '__main__':
    unittest.main()
