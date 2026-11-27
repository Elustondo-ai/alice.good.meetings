"""Numbered teams: the next team's number, branch and worktree, and the packaging of both team skills."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CORE = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(CORE / 'scripts/lib'))
sys.path.insert(0, str(CORE / 'skills/asdg-create-team'))
import team_worktree
from cli_clients import skill_names
from distribution_files import package_files


def run(folder, *args):
    subprocess.run(['git', '-C', str(folder), *args], check=True, capture_output=True, text=True)


class NumberedTeams(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.clone = Path(self.temp.name).resolve() / 'project'
        self.clone.mkdir()
        run(self.clone, 'init', '-q', '-b', 'sprint-04')
        run(self.clone, 'config', 'user.email', 'test@example.invalid')
        run(self.clone, 'config', 'user.name', 'Test')
        (self.clone / 'a.txt').write_text('a\n')
        run(self.clone, 'add', 'a.txt')
        run(self.clone, 'commit', '-q', '-m', 'first')

    def tearDown(self):
        self.temp.cleanup()

    def test_first_extra_team_is_number_two_and_plan_changes_nothing(self):
        (self.clone / 'draft.txt').write_text('uncommitted\n')
        plan = team_worktree.plan(self.clone)
        self.assertEqual((plan['number'], plan['branch'], plan['base']), (2, 'sprint-04-2', 'sprint-04'))
        self.assertEqual(Path(plan['path']), self.clone / '.claude/worktrees/sprint-04-2')
        self.assertEqual(plan['not_carried'], ['draft.txt'])
        self.assertFalse((self.clone / '.claude').exists())

    def test_create_adds_worktree_and_branch_and_hides_the_folder_locally(self):
        made = team_worktree.create(self.clone)
        self.assertTrue((Path(made['path']) / 'a.txt').is_file())
        self.assertIn(('sprint-04-2'), [branch for _, branch in team_worktree.worktrees(self.clone)])
        self.assertIn('.claude/worktrees/\n', (self.clone / '.git/info/exclude').read_text())
        status = subprocess.run(['git', '-C', str(self.clone), 'status', '--porcelain'], capture_output=True, text=True)
        self.assertEqual(status.stdout, '')

    def test_next_number_follows_the_last_team_from_the_clone_or_from_a_team_folder(self):
        second = team_worktree.create(self.clone)
        self.assertEqual(team_worktree.plan(self.clone)['branch'], 'sprint-04-3')
        from_team = team_worktree.plan(second['path'])
        self.assertEqual((from_team['number'], from_team['branch'], from_team['base']), (3, 'sprint-04-3', 'sprint-04-2'))
        self.assertEqual(Path(from_team['path']), self.clone / '.claude/worktrees/sprint-04-3')
        team_worktree.create(second['path'])
        self.assertEqual(team_worktree.plan(self.clone)['teams_found'], [1, 2, 3])

    def test_numbers_seen_in_titles_or_left_as_branches_are_never_reused(self):
        self.assertEqual(team_worktree.plan(self.clone, seen=[9])['number'], 10)
        run(self.clone, 'branch', 'sprint-04-5')
        self.assertEqual(team_worktree.plan(self.clone)['branch'], 'sprint-04-6')

    def test_a_branch_that_only_looks_numbered_keeps_its_name_as_stem(self):
        run(self.clone, 'checkout', '-q', '-b', 'release-2')
        self.assertEqual(team_worktree.plan(self.clone)['branch'], 'release-2-2')

    def test_blocked_states_exit_two_and_change_nothing(self):
        run(self.clone, 'checkout', '-q', '--detach')
        self.assertEqual(team_worktree.main(['--folder', str(self.clone), '--create']), 2)
        self.assertEqual(team_worktree.main(['--folder', self.temp.name]), 2)
        self.assertFalse((self.clone / '.claude').exists())

    def test_in_claude_a_project_chat_starts_every_team_lead(self):
        chats = (CORE / 'skills/asdg-create-team/create-chats.md').read_text()
        self.assertIn('### The team tree', chats)
        self.assertIn('leads no team itself', chats)
        self.assertIn("quotes the user's Create team request word for word", chats)
        self.assertNotIn('The user then asks for Create team in that lead', chats)
        self.assertNotIn('first sends a message', chats)
        self.assertIn('ask the user to say go', chats)
        skill = (CORE / 'skills/asdg-create-team/SKILL.md').read_text()
        self.assertIn('quotes it word for word', skill)
        self.assertNotIn('detach_session', chats)
        rule = (CORE / 'skills/asdg-create-team/numbered-teams.md').read_text()
        self.assertIn('## Who starts the chats', rule)
        self.assertNotIn('team 1 lead"] -- "starts"', rule)
        for page in ('skills/asdg-create-team/SKILL.md', 'skills/asdg-create-team/numbered-teams.md',
                     'skills/asdg-create-team/ordering.md', 'skills/asdg-focus/rename-chat.md'):
            self.assertIn('create-chats.md#the-team-tree', (CORE / page).read_text(), page)
        admin = (CORE / 'skills/asdg-create-team-admin/SKILL.md').read_text()
        self.assertIn('numbered-teams.md#who-starts-the-chats', admin)
        ordering = (CORE / 'skills/asdg-create-team/ordering.md').read_text()
        self.assertNotIn('Title the calling chat as the [team lead]', ordering)
        titles = (CORE / 'skills/asdg-focus/rename-chat.md').read_text()
        self.assertIn('`<Project Nickname> ASDG [<focus>] [<attitude>]`', titles)

    def test_both_team_skills_are_packaged_indexed_and_linked(self):
        packaged = {path.relative_to(CORE).as_posix() for path in package_files(CORE)}
        for name in ('skills/asdg-create-team/numbered-teams.md', 'skills/asdg-create-team/team_worktree.py',
                     'skills/asdg-create-team/team_worktree.md', 'skills/asdg-create-team-admin/SKILL.md',
                     'templates/.agents/skills/asdg-create-team-admin/SKILL.md',
                     'templates/.agents/skills/asdg-create-team-admin/agents/openai.yaml',
                     'tests/test_numbered_teams.py', 'tests/test_numbered_teams.md'):
            self.assertIn(name, packaged)
        self.assertIn('asdg-create-team-admin', skill_names(CORE.parent))
        for page in ('skills/README.md', 'skills/asdg-help/SKILL.md'):
            self.assertIn('asdg-create-team-admin/SKILL.md', (CORE / page).read_text())
        for page in ('skills/asdg-create-team/SKILL.md', 'skills/asdg-create-team/create-chats.md',
                     'skills/asdg-create-team-admin/SKILL.md'):
            self.assertIn('numbered-teams.md', (CORE / page).read_text())
        self.assertIn('<team number>', (CORE / 'skills/asdg-focus/rename-chat.md').read_text())
        self.assertIn('asdg-create-team-admin', (CORE / 'admin/AGENTS.md').read_text())
        adapter = (CORE / 'templates/.agents/skills/asdg-create-team-admin/agents/openai.yaml').read_text()
        self.assertIn('allow_implicit_invocation: false', adapter)


if __name__ == '__main__':
    unittest.main()
