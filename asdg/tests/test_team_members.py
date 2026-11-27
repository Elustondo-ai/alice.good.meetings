"""The step program behind Team members create: one action at a time, checked, and ready for the app's limits."""
import contextlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

CORE = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(CORE / 'scripts/lib'))
sys.path.insert(0, str(CORE / 'skills/asdg-team-members-create'))
import cli_project
import team_members as tm


class Lead:
    """Play the lead chat against a pretend app; the defaults are a chat the human typed into, with no cap."""

    def __init__(self, test, team=2, nickname='Sandbox', deny=(), limit=12, work=12, see=True, folder=None):
        self.temp = tempfile.TemporaryDirectory()
        test.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.have, self.working, self.since, self.log = [], 0, 0, []
        self.deny, self.limit, self.work, self.see = set(deny), limit, work, see
        self.state = tm.new_state(nickname, team, self.root, folder)
        self.action = tm.begin(self.state, self.have)

    def run(self, steps=80):
        for _ in range(steps):
            action = self.action
            kind, title = action['action'], action.get('title')
            self.log.append((kind, title))
            if kind == 'done':
                return self
            if kind == 'wait':
                self.working = 0
                self.action = tm.woke(self.state, self.have)
            elif kind == 'card':
                self.action = tm.result(self.state, 'carded', self.have)
            elif title in self.deny:
                self.deny.discard(title)
                self.action = tm.result(self.state, 'denied', self.have)
            elif self.since >= self.limit or self.working >= self.work:
                self.action = tm.result(self.state, 'refused', self.have)
            else:
                self.since += 1
                self.working += 1
                if self.see:
                    self.have.append(title)
                self.action = tm.result(self.state, 'started', self.have)
        raise AssertionError('the loop did not finish')

    def human(self):
        self.since = self.working = 0
        self.action = tm.begin(self.state, self.have)
        return self.run()

    def kinds(self, kind):
        return [title for step, title in self.log if step == kind]


class TeamMembers(unittest.TestCase):
    def test_a_chat_the_human_typed_into_starts_all_twelve_in_order_without_waiting(self):
        lead = Lead(self).run()
        self.assertEqual(lead.kinds('start'), [m['title'] for m in lead.state['members']])
        self.assertEqual((lead.kinds('wait'), lead.kinds('card')), ([], []))
        self.assertIn('12 of 12', lead.action['report'])
        self.assertEqual(len(lead.have), 12)

    def test_a_capped_chat_waits_for_working_chats_then_leaves_cards_for_the_rest(self):
        lead = Lead(self, limit=10, work=5).run()
        titles = [m['title'] for m in lead.state['members']]
        self.assertEqual(lead.log[:7], [('start', t) for t in titles[:5]] + [('start', titles[5]), ('wait', None)])
        self.assertEqual(lead.kinds('card'), titles[10:])
        self.assertEqual(len(lead.have), 10)
        self.assertIn('10 of 12', lead.action['report'])
        self.assertEqual(lead.kinds('wait'), [None, None])

    def test_a_denied_start_is_never_retried_and_becomes_the_last_card(self):
        lead = Lead(self, deny=['01 Context 2']).run()
        self.assertEqual(lead.kinds('start').count('01 Context 2'), 1)
        self.assertEqual(lead.kinds('card'), ['01 Context 2'])
        self.assertIn('permission check', lead.action['report'])
        self.assertIn('11 of 12', lead.action['report'])

    def test_two_denials_in_a_row_turn_the_rest_into_cards(self):
        lead = Lead(self, deny=['01 Context 2', '02 Purpose 2']).run()
        self.assertEqual(lead.kinds('start'), ['01 Context 2', '02 Purpose 2'])
        self.assertEqual(len(lead.kinds('card')), 12)

    def test_typing_the_command_again_starts_only_what_is_missing(self):
        lead = Lead(self, limit=10, work=5).run()
        lead.log.clear()
        lead.limit = 12
        lead.human()
        self.assertEqual(lead.kinds('start'), ['11 Operations 2', '12 Observability 2'])
        self.assertEqual(lead.kinds('card'), [])
        self.assertIn('12 of 12', lead.action['report'])

    def test_a_start_counts_only_when_its_chat_is_in_the_list(self):
        lead = Lead(self, see=False).run()
        self.assertIn('0 of 12', lead.action['report'])
        self.assertIn('not seen', lead.action['report'])
        seen = tm.woke(lead.state, [m['title'] for m in lead.state['members']])
        self.assertIn('12 of 12', seen['report'])

    def test_an_unreported_start_is_settled_from_the_list_not_repeated_blindly(self):
        lead = Lead(self)
        first = lead.action['title']
        self.assertEqual(tm.woke(lead.state, [])['title'], first)
        self.assertEqual(tm.woke(lead.state, [first])['title'], '02 Purpose 2')
        with self.assertRaises(tm.Problem):
            tm.result(tm.new_state('X', 1, lead.root), 'started', [])

    def test_titles_names_and_arguments_are_fixed_by_the_program(self):
        one = tm.new_state('Alice', 1, '/tmp/alice')
        two = tm.new_state('Alice', 2, '/tmp/alice/.claude/worktrees/main-2', '/tmp/alice/.claude/worktrees/main-2')
        self.assertEqual((one['members'][5]['title'], one['members'][5]['name']), ('06 POC', 'asdg-06-poc'))
        self.assertEqual((two['members'][3]['title'], two['members'][3]['name']), ('04 EvalStrategy 2', 'asdg-04-evalstrategy-2'))
        for member in one['members'] + two['members'] + tm.new_state('A', 12, '/x')['members']:
            self.assertRegex(member['name'], r'^[a-z0-9-]{1,24}$')
        arguments = tm.begin(two, [])['arguments']
        self.assertEqual((arguments['initiation'], arguments['context'], arguments['use_worktree']), ('user_asked', 'fresh', False))
        self.assertEqual(arguments['cwd'], '/tmp/alice/.claude/worktrees/main-2')
        self.assertNotIn('cwd', tm.begin(one, [])['arguments'])
        for text in ('asdg/skills/asdg-focus/SKILL.md', 'ASDG-01', '`01 Context 2`', 'team 2', 'create no chat', 'main-2'):
            self.assertIn(text, arguments['prompt'])
        card = tm.card(two, two['members'][0])['arguments']
        self.assertEqual((card['initiation'], card['cwd']), ('own_initiative', arguments['cwd']))

    def test_role_table_matches_focus_choices_and_the_catalogue(self):
        choices = (CORE / 'skills/asdg-focus/focus-choices.md').read_text(encoding='utf-8')
        labels = dict(re.findall(r'^\| (\d\d) [^|]+\| (\w+) \|', choices, re.MULTILINE))
        catalogue = json.loads((CORE / '00-governance/types/agent-catalog.json').read_text(encoding='utf-8'))
        stages = {agent['role_id']: agent['stage'] for agent in catalogue['agents']}
        self.assertEqual(len(tm.ROLES), 12)
        for number, (role, label) in enumerate(tm.ROLES, 1):
            self.assertEqual((role, stages[role]), ('ASDG-%02d' % number, number))
            self.assertEqual(labels['%02d' % number], label)
        self.assertEqual((tm.BATCH, tm.LIMIT), (12, 12))

    def test_the_team_folder_comes_from_git(self):
        with tempfile.TemporaryDirectory() as temp:
            clone = Path(temp).resolve() / 'project'
            clone.mkdir()
            git = lambda *args: subprocess.run(['git', '-C', str(clone), *args], check=True, capture_output=True, text=True)
            git('init', '-q', '-b', 'main')
            git('config', 'user.email', 'test@example.invalid')
            git('config', 'user.name', 'Test')
            (clone / 'a.txt').write_text('a\n')
            git('add', 'a.txt')
            git('commit', '-q', '-m', 'first')
            git('worktree', 'add', '-q', '-b', 'main-2', str(clone / '.claude/worktrees/main-2'))
            git('worktree', 'add', '-q', '-b', 'feature-12', str(clone / 'elsewhere'))
            self.assertEqual(tm.team_root(1, clone), clone)
            self.assertEqual(tm.team_root(2, clone), clone / '.claude/worktrees/main-2')
            self.assertEqual(tm.team_root(2, clone / '.claude/worktrees/main-2'), clone / '.claude/worktrees/main-2')
            for missing in (3, 12):
                with self.assertRaises(tm.Problem):
                    tm.team_root(missing, clone)
            with self.assertRaises(tm.Problem):
                tm.team_root(2, Path(temp))

    def test_command_line_keeps_progress_per_team_and_prints_one_action(self):
        with tempfile.TemporaryDirectory() as folder:
            def call(*args):
                out, err = io.StringIO(), io.StringIO()
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                    code = tm.main([*args, '--here', folder])
                return code, out.getvalue(), err.getvalue()

            code, out, _ = call('begin', '--nickname', 'Sandbox', '--team', '1', '--root', folder)
            self.assertEqual(code, 0)
            self.assertEqual(out.count('ACTION: '), 1)
            self.assertIn('ACTION: start', out)
            self.assertIn('"title": "01 Context"', out)
            self.assertNotIn('"cwd"', out)
            self.assertIn('team_members.py result <started|denied|refused|failed> --team 1', out)
            self.assertTrue((Path(folder) / '.asdg/cache/team-members-1.json').is_file())
            code, out, _ = call('result', 'started', '--team', '1', '--have', '01 Context')
            self.assertEqual(code, 0)
            self.assertIn('"title": "02 Purpose"', out)
            code, out, _ = call('status', '--team', '1')
            self.assertIn('1 of 12', out)
            code, out, _ = call('begin', '--nickname', 'Sandbox', '--team', '2', '--root', folder + '/wt')
            self.assertIn('"cwd": "%s"' % (Path(folder).resolve() / 'wt'), out)
            self.assertTrue((Path(folder) / '.asdg/cache/team-members-2.json').is_file())
            self.assertIn('1 of 12', call('status', '--team', '1')[1])
            code, _, err = call('result', 'bogus', '--team', '1')
            self.assertEqual(code, 2)
        with tempfile.TemporaryDirectory() as folder:
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = tm.main(['woke', '--team', '3', '--here', folder])
            self.assertEqual(code, 2)
            self.assertIn('BLOCKED', err.getvalue())
        self.assertIn('/.asdg/cache/', cli_project.IGNORE)


if __name__ == '__main__':
    unittest.main()
