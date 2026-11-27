"""Team create and Team members create: packaging, the pages, the loop and who may start chats."""
from pathlib import Path
import sys
import unittest

CORE = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(CORE / 'scripts/lib'))
from cli_clients import claude_adapter, skill_names
from distribution_files import package_files

SKILLS = ('asdg-team-create', 'asdg-team-members-create')


def page(name):
    return (CORE / 'skills' / name / 'SKILL.md').read_text(encoding='utf-8')


class TeamCreate(unittest.TestCase):
    def test_both_skills_are_packaged_registered_and_human_only(self):
        packaged = {path.relative_to(CORE).as_posix() for path in package_files(CORE)}
        for name in SKILLS:
            for relative in (f'skills/{name}/SKILL.md', f'templates/.agents/skills/{name}/SKILL.md',
                             f'templates/.agents/skills/{name}/agents/openai.yaml'):
                self.assertIn(relative, packaged)
            self.assertIn(name, skill_names(CORE.parent))
            self.assertIn(b'disable-model-invocation: true', claude_adapter(CORE.parent, name))
            for index in ('skills/README.md', 'skills/asdg-help/SKILL.md'):
                self.assertIn(f'{name}/SKILL.md', (CORE / index).read_text(encoding='utf-8'), index)
        for relative in ('tests/test_team_create.py', 'tests/test_team_create.md',
                         'tests/test_team_members.py', 'tests/test_team_members.md',
                         'skills/asdg-team-members-create/team_members.py',
                         'skills/asdg-team-members-create/team_members.md'):
            self.assertIn(relative, packaged)

    def test_each_skill_is_one_short_page_that_asks_nothing_and_holds_no_prompt(self):
        for name in SKILLS:
            text = page(name)
            self.assertLessEqual(sum(1 for line in text.splitlines() if line.strip()), 50, name)
            self.assertIn('**Ask nothing.**', text, name)
            self.assertIn('Claude desktop app only', text, name)
            self.assertEqual(text.count('```text'), 0, name)

    def test_team_create_turns_the_typed_chat_into_the_lead(self):
        text = page('asdg-team-create')
        self.assertIn('`parentSessionId`', text)
        self.assertIn('fresh chat', text)
        self.assertIn('set_session_title', text)
        self.assertIn('list_sessions', text)
        self.assertIn('asdg/skills/asdg-create-team/team_worktree.py', text)
        self.assertTrue((CORE / 'skills/asdg-create-team/team_worktree.py').is_file())
        self.assertIn('(../asdg-team-members-create/SKILL.md) now, in this chat', text)
        self.assertNotIn('Start exactly one chat', text)

    def test_members_page_is_a_loop_that_the_program_drives(self):
        members = page('asdg-team-members-create')
        program = 'asdg/skills/asdg-team-members-create/team_members.py'
        self.assertIn('python3 %s begin --nickname' % program, members)
        self.assertTrue((CORE.parent / program).is_file())
        self.assertIn('Do exactly that one action', members)
        self.assertIn('Decide nothing either', members)
        for action in ('`start`', '`card`', '`wait`', '`done`'):
            self.assertIn(action, members)
        self.assertIn('**Never** retry a call', members)
        self.assertNotRegex(members, r'\| `ASDG-\d\d` \|')
        self.assertIn('(team_members.md)', members)
        companion = (CORE / 'skills/asdg-team-members-create/team_members.md').read_text(encoding='utf-8')
        self.assertIn('at most 10 sessions without a card after each message from the user', companion)
        self.assertIn('typed into', companion)

    def test_only_the_human_request_authorizes_and_policy_names_both_routes(self):
        members = page('asdg-team-members-create')
        self.assertIn("Only the human's typed request authorizes it", members)
        self.assertIn('skips those that exist', members)
        policy = (CORE / 'skills/asdg-focus/session-policy.md').read_text(encoding='utf-8')
        runtime = (CORE / '00-governance/docs/runtime-contract.md').read_text(encoding='utf-8')
        self.assertIn('asdg-team-create/SKILL.md', policy)
        self.assertIn('asdg-team-create/SKILL.md', runtime)


if __name__ == '__main__':
    unittest.main()
