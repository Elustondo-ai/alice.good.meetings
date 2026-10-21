"""Purpose readiness and User acceptance stay separate and bound to reviewed bytes."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/lib'))
from cli_files import Conflict
from cli_status import evidence_status, read_lifecycle, render_status
from purpose_review import CRITERIA, DOCUMENTS, PREFIX, bundle_hashes, completion_status, validate_reviews


class PurposeReviewTests(unittest.TestCase):
    def setUp(self):
        self.area = tempfile.TemporaryDirectory(prefix='asdg-purpose-review-')
        self.addCleanup(self.area.cleanup)
        self.root = Path(self.area.name)
        self.folder = self.root / PREFIX
        (self.folder / 'images').mkdir(parents=True)
        (self.folder / 'images/purpose.png').write_bytes(b'fixture image bytes')
        for name in DOCUMENTS:
            (self.folder / name).write_text('# Purpose fixture\n\nObserved or proposed content.\n')
        (self.folder / DOCUMENTS[0]).write_text(
            '# Purpose\n\n![Desired experience](images/purpose.png)\n\nVision, not implemented behavior.\n')
        (self.folder / 'README.md').write_text('[Purpose](01-purpose.md)\n')
        self.entry = {'artifacts': [str(PREFIX / name) for name in DOCUMENTS],
                      'not_applicable_reason': None, 'reviews': []}
        self.rules = [{'number': 2, 'slug': '02-purpose'}]

    def ready(self):
        event = {'decision': 'READY_FOR_ACCEPTANCE', 'actor': 'ASDG-02',
                 'recorded_at': '2026-10-20T20:00:00Z',
                 'artifacts': bundle_hashes(self.root, self.entry['artifacts']),
                 'criteria': {key: 'Observed fixture evidence for ' + key for key in CRITERIA}}
        self.entry['reviews'].append(event)
        return event

    def accept(self):
        event = {'decision': 'ACCEPTED', 'actor': 'User', 'recorded_at': '2026-10-20T21:00:00Z',
                 'artifacts': copy.deepcopy(self.entry['reviews'][-1]['artifacts']),
                 'statement': 'I accept this Purpose baseline as done for now.'}
        self.entry['reviews'].append(event)
        return event

    def test_file_presence_never_implies_readiness_or_user_acceptance(self):
        stage = evidence_status(self.root, self.rules, {'stages': {'02': self.entry}})[0]
        self.assertEqual(stage['readiness'], 'ESTABLISHED')
        self.assertEqual(stage['completion']['status'], 'IN_PROGRESS')
        ready = self.ready()
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'READY_FOR_ACCEPTANCE')
        self.assertFalse(completion_status(self.root, self.entry)['user_accepted'])
        self.assertIn(str(PREFIX / 'images/purpose.png'), ready['artifacts'])
        self.accept()
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'ACCEPTED')

    def test_changed_document_image_and_navigation_invalidate_the_baseline(self):
        self.ready(); self.accept()
        for name in (DOCUMENTS[0], DOCUMENTS[1], DOCUMENTS[2], 'images/purpose.png', 'README.md'):
            with self.subTest(name=name):
                path = self.folder / name
                before = path.read_bytes()
                path.write_bytes(before + b'\nChanged\n')
                state = completion_status(self.root, self.entry)
                self.assertEqual(state['status'], 'IN_PROGRESS')
                self.assertTrue(state['review_stale'])
                self.assertFalse(state['user_accepted'])
                path.write_bytes(before)
        self.assertEqual(len(self.entry['reviews']), 2)
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'ACCEPTED')

    def test_reassessment_requires_new_acceptance_and_preserves_history(self):
        self.ready(); self.accept()
        (self.folder / DOCUMENTS[1]).write_text('# Revised capabilities\n')
        self.ready()
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'READY_FOR_ACCEPTANCE')
        self.assertEqual(len(self.entry['reviews']), 3)
        self.accept()
        self.assertTrue(completion_status(self.root, self.entry)['user_accepted'])

    def test_cannot_accept_without_agent_gate_or_explicit_statement(self):
        self.ready(); event = self.accept()
        with self.assertRaises(Conflict):
            validate_reviews([event])
        for field, value in [('actor', 'ASDG-02'), ('statement', ''), ('artifacts', {})]:
            invalid = copy.deepcopy(self.entry['reviews'])
            invalid[-1][field] = value
            with self.subTest(field=field), self.assertRaises(Conflict):
                validate_reviews(invalid)
        invalid = copy.deepcopy(self.entry['reviews'])
        invalid[-1]['artifacts'][str(PREFIX / DOCUMENTS[0])] = '0' * 64
        with self.assertRaises(Conflict):
            validate_reviews(invalid)

    def test_missing_criterion_or_unsafe_path_fails_closed(self):
        ready = self.ready()
        del ready['criteria']['visual']
        with self.assertRaises(Conflict):
            validate_reviews([ready])
        ready['criteria']['visual'] = 'Image inspected.'
        ready['artifacts']['../outside'] = '0' * 64
        with self.assertRaises(Conflict):
            validate_reviews([ready])

    def test_missing_image_broken_link_and_symlink_prevent_current_readiness(self):
        self.ready()
        image = self.folder / 'images/purpose.png'
        image.unlink()
        self.assertTrue(completion_status(self.root, self.entry)['review_stale'])
        image.symlink_to(self.folder / DOCUMENTS[1])
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'IN_PROGRESS')
        image.unlink(); image.write_bytes(b'fixture image bytes')
        (self.folder / 'README.md').write_text('[Missing](does-not-exist.md)\n')
        self.assertIn('Broken Purpose link', completion_status(self.root, self.entry)['reason'])

    def test_state_schema_is_backward_compatible_and_review_is_purpose_only(self):
        (self.root / '.asdg').mkdir()
        state = {'schema_version': 1, 'stages': {'02': self.entry}}
        path = self.root / '.asdg/lifecycle.json'
        path.write_text(json.dumps(state))
        self.assertEqual(read_lifecycle(self.root, self.rules), state)
        del self.entry['reviews']
        path.write_text(json.dumps(state))
        self.assertEqual(read_lifecycle(self.root, self.rules), state)
        self.entry['reviews'] = []
        state['stages']['01'] = state['stages'].pop('02')
        path.write_text(json.dumps(state))
        with self.assertRaises(Conflict):
            read_lifecycle(self.root, [{'number': 1, 'slug': '01-context-and-domain-analysis'}])

    def test_navigation_may_link_to_methodology_but_not_escape_the_client(self):
        policy = self.root / 'asdg/policy.md'
        policy.parent.mkdir(); policy.write_text('# Completion rule\n')
        index = self.folder / 'README.md'
        index.write_text('[Completion](../../../asdg/policy.md)\n')
        self.ready()
        self.assertTrue(completion_status(self.root, self.entry)['agent_ready'])
        index.write_text('[Escape](../../../../outside.md)\n')
        self.assertEqual(completion_status(self.root, self.entry)['status'], 'IN_PROGRESS')


if __name__ == '__main__':
    unittest.main()
