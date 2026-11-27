#!/usr/bin/env python3
"""Tell a team lead chat the one next step in creating its twelve ASDG role chats, and remember progress."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

BATCH = 12    # chats the human typed into started twelve at once on 25 November 2026; a refusal lowers it
LIMIT = 12    # the same for starts per message; a refusal after a wait turns the rest into cards
DENIALS = 2   # after this many permission denials in a row, stop trying and leave cards
PROGRAM = 'asdg/skills/asdg-team-members-create/team_members.py'
TOOL = 'mcp__ccd_session__start_session'
OUTCOMES = ('started', 'denied', 'refused', 'carded', 'failed')
ROLES = (('ASDG-01', 'Context'), ('ASDG-02', 'Purpose'), ('ASDG-03', 'UseCases'), ('ASDG-04', 'EvalStrategy'),
         ('ASDG-05', 'Architecture'), ('ASDG-06', 'POC'), ('ASDG-07', 'Planning'), ('ASDG-08', 'Specs'),
         ('ASDG-09', 'Coding'), ('ASDG-10', 'ReviewQA'), ('ASDG-11', 'Operations'), ('ASDG-12', 'Observability'))
BACKGROUND = ('ASDG team setup: this chat holds one specialist role for its team and waits for the human; '
              'it starts no project work.')
PROMPT = '''You are the {title} chat of team {team} of the ASDG project "{nickname}". Project root: {root}.

Do these in order, and ask nothing:
1. Read `asdg/skills/asdg-focus/SKILL.md` and follow it to select role {role}, with no focus and no attitude. Record team {team} and the project root in your session receipt.
2. Keep this chat's title exactly as it is: `{title}`. Do not rename it.
3. Reply with one line naming your role, then wait for the human.

Team setup gives you no work: write no file, start no sprint, create no chat and message no chat.'''
WORDS = {'confirmed': 'started',
         'unconfirmed': 'start reported, but the chat is not seen in the list',
         'carded-limit': 'card left in this chat (the app would not start more): click it to start',
         'carded-denied': "card left in this chat (the app's permission check denied the start): click it to start",
         'failed': 'not started: the call failed',
         'denied': "not started: the app's permission check denied it",
         'todo': 'not started yet'}


class Problem(Exception):
    """A call the program cannot act on; nothing was changed."""


def git_worktrees(folder):
    """Return (path, branch) for every worktree of the project at folder; the clone itself comes first."""
    result = subprocess.run(['git', '-C', str(folder), 'worktree', 'list', '--porcelain'], capture_output=True, text=True)
    if result.returncode:
        raise Problem('%s is not inside a Git checkout.' % folder)
    rows = []
    for line in result.stdout.splitlines():
        if line.startswith('worktree '):
            rows.append([Path(line[9:]), None])
        elif line.startswith('branch refs/heads/') and rows:
            rows[-1][1] = line[18:]
    return [tuple(row) for row in rows]


def team_root(team, here):
    """Team 1 works in the clone; team N in the one worktree under .claude/worktrees on a branch ending -N."""
    rows = git_worktrees(here)
    if team == 1:
        return rows[0][0]
    found = [path for path, branch in rows[1:]
             if branch and branch.endswith('-%d' % team) and '.claude/worktrees' in path.as_posix()]
    if len(found) != 1:
        raise Problem('Team %d has %d team folders under .claude/worktrees; it needs exactly one.' % (team, len(found)))
    return found[0]


def new_state(nickname, team, root, cwd=None):
    """Describe a team whose twelve role chats are all still to be created; cwd is set when its folder is not the lead's."""
    team = int(team)
    if team < 1 or not str(nickname).strip():
        raise Problem('A nickname and a team number of 1 or more are needed.')
    suffix, dash = ('', '') if team == 1 else (' %d' % team, '-%d' % team)
    members = [{'role': role, 'title': '%02d %s%s' % (number, label, suffix),
                'name': 'asdg-%02d-%s%s' % (number, label.lower(), dash), 'status': 'todo', 'why': ''}
               for number, (role, label) in enumerate(ROLES, 1)]
    return {'nickname': str(nickname).strip(), 'team': team, 'root': str(root), 'cwd': str(cwd) if cwd else None,
            'members': members, 'pending': None, 'batch': 0, 'since_human': 0, 'denials': 0, 'cards_only': False}


def arguments(state, member, initiation):
    """Return the exact arguments of the one app call that starts, or proposes, a role chat."""
    prompt = PROMPT.format(title=member['title'], team=state['team'], nickname=state['nickname'],
                           root=state['root'], role=member['role'])
    call = {'initiation': initiation, 'context': 'fresh', 'use_worktree': False, 'title': member['title'],
            'name': member['name'], 'background': BACKGROUND, 'prompt': prompt}
    if state.get('cwd'):
        call['cwd'] = state['cwd']
    return call


def start(state, member):
    state['pending'] = {'action': 'start', 'title': member['title']}
    return dict(state['pending'], arguments=arguments(state, member, 'user_asked'))


def card(state, member):
    state['pending'] = {'action': 'card', 'title': member['title']}
    return dict(state['pending'], arguments=arguments(state, member, 'own_initiative'))


def find(state, title):
    return next(member for member in state['members'] if member['title'] == title)


def reconcile(state, have):
    """A role chat exists only when its exact title is in the list the lead read from the app."""
    seen = set(have or ())
    for member in state['members']:
        if member['title'] in seen:
            member['status'], member['why'] = 'confirmed', ''


def started(state, member):
    state['batch'] += 1
    state['since_human'] += 1
    state['denials'] = 0
    member['status'] = 'unconfirmed'


def settle(state, have):
    """Close a start nobody reported on: it happened if its chat is in the list, otherwise it is still due."""
    pending = state.get('pending')
    if pending and pending['action'] == 'start' and pending['title'] in set(have or ()):
        started(state, find(state, pending['title']))
        state['pending'] = None
    elif pending and pending['action'] in ('wait', 'done'):
        state['pending'] = None


def report(state):
    members = state['members']
    exist = sum(1 for member in members if member['status'] == 'confirmed')
    lines = ['Team %d of "%s": %d of %d role chats exist.' % (state['team'], state['nickname'], exist, len(members)),
             '', '| Role chat | Status |', '| --- | --- |']
    for member in members:
        key = 'carded-' + (member['why'] or 'limit') if member['status'] == 'carded' else member['status']
        lines.append('| %s | %s |' % (member['title'], WORDS[key]))
    cards = sum(1 for member in members if member['status'] == 'carded')
    other = len(members) - exist - cards
    if cards:
        lines += ['', 'Click the %d card(s) in this chat to add the missing chat(s).' % cards]
    if other:
        lines += ['', 'Type /asdg-team-members-create in this chat to try the %d other(s) again.' % other]
    return '\n'.join(lines)


def next_action(state):
    """Choose the single next step from the recorded progress and what the app has refused so far."""
    pending = state.get('pending')
    if pending and pending['action'] in ('start', 'card'):
        member = find(state, pending['title'])
        return (start if pending['action'] == 'start' else card)(state, member)
    todo = [member for member in state['members'] if member['status'] == 'todo']
    if todo:
        if state['cards_only'] or state['since_human'] >= LIMIT:
            todo[0]['why'] = todo[0]['why'] or ('denied' if state['cards_only'] else 'limit')
            return card(state, todo[0])
        if state['batch'] >= BATCH:
            state['pending'] = {'action': 'wait'}
            titles = [m['title'] for m in state['members'] if m['status'] in ('confirmed', 'unconfirmed')]
            return dict(state['pending'], line='Team %d: %d of 12 role chats started so far; waiting for them to '
                                               'report before starting the next.' % (state['team'], len(titles)))
        return start(state, todo[0])
    denied = [member for member in state['members'] if member['status'] == 'denied']
    if denied:
        denied[0]['why'] = 'denied'
        return card(state, denied[0])
    state['pending'] = {'action': 'done'}
    return dict(state['pending'], report=report(state))


def begin(state, have):
    """A fresh run: the human's request gives a new allowance of starts."""
    settle(state, have)
    state.update(pending=None, batch=0, since_human=0, denials=0, cards_only=False)
    for member in state['members']:
        if member['status'] != 'confirmed':
            member['status'], member['why'] = 'todo', ''
    reconcile(state, have)
    return next_action(state)


def woke(state, have):
    """The app woke the lead because started chats reported, so more may run."""
    settle(state, have)
    state['batch'] = 0
    reconcile(state, have)
    return next_action(state)


def result(state, outcome, have):
    """Record what the app answered to the pending call, check the list, and choose the next step."""
    pending = state.get('pending')
    if outcome not in OUTCOMES:
        raise Problem('The result must be one of: %s.' % ', '.join(OUTCOMES))
    if not pending or pending['action'] not in ('start', 'card'):
        raise Problem('No start or card is waiting for a result. Run "woke", or "begin" for a new run.')
    member = find(state, pending['title'])
    state['pending'] = None
    if pending['action'] == 'card':
        member['status'] = 'carded' if outcome == 'carded' else 'failed'
    elif outcome == 'started':
        started(state, member)
    elif outcome == 'denied':
        member['status'] = 'denied'
        state['denials'] += 1
        state['cards_only'] = state['cards_only'] or state['denials'] >= DENIALS
    elif outcome == 'refused' and state['batch'] > 0:
        state['batch'] = BATCH
    elif outcome == 'refused':
        state['since_human'] = LIMIT
    else:
        member['status'] = 'failed'
    reconcile(state, have)
    return next_action(state)


def render(action, team):
    """Print one action and the exact command that reports back, so the lead has nothing to decide."""
    back = 'python3 %s %%s --team %d --have "<title>" (one --have per chat this chat has started)' % (PROGRAM, team)
    kind = action['action']
    if kind in ('start', 'card'):
        note = ('It starts one chat.' if kind == 'start'
                else 'It leaves one card for the human and starts nothing.')
        answers = ('started = the tool says the session started; denied = the auto mode classifier, the '
                   "app's permission check, denied it; refused = the app says it can't start another now; "
                   'failed = anything else' if kind == 'start' else
                   'carded = the tool says it was proposed; failed = anything else')
        return '\n'.join(['ACTION: ' + kind, 'MEMBER: ' + action['title'],
                          'Call %s once with exactly these arguments. %s' % (TOOL, note),
                          json.dumps(action['arguments'], indent=2, ensure_ascii=False),
                          'Then list the chats this chat has started and run, with the one word that fits:',
                          back % ('result <%s>' % ('started|denied|refused|failed' if kind == 'start' else 'carded|failed')),
                          answers, 'Do not retry the call and do not change an argument.'])
    if kind == 'wait':
        return '\n'.join(['ACTION: wait', 'End your turn now with exactly this line:', action['line'],
                          'When the app wakes this chat, list the chats this chat has started and run:',
                          back % 'woke'])
    return '\n'.join(['ACTION: done', 'Give the human exactly this report, then end your turn. Start nothing '
                      'else, and run this program again only when the human types /asdg-team-members-create.',
                      '', action['report']])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('begin', 'result', 'woke', 'status'):
        command = commands.add_parser(name)
        command.add_argument('--team', required=True, type=int)
        command.add_argument('--here', default='.', help='the folder this chat works in; progress is kept here')
        command.add_argument('--have', action='append', default=[], help='title of a chat this chat has started; repeatable')
        if name == 'begin':
            command.add_argument('--nickname', required=True)
            command.add_argument('--root', help="the team's folder; default: found from Git")
        if name == 'result':
            command.add_argument('outcome', help=' | '.join(OUTCOMES))
    args = parser.parse_args(argv)
    here = Path(args.here).resolve()
    path = here / '.asdg/cache' / ('team-members-%d.json' % args.team)
    try:
        state = json.loads(path.read_text(encoding='utf-8')) if path.is_file() else None
        if args.command == 'begin':
            root = Path(args.root).resolve() if args.root else team_root(args.team, here)
            cwd = None if root == here else root
            if not state or (state['nickname'], state['team'], state['root']) != (args.nickname.strip(), args.team, str(root)):
                state = new_state(args.nickname, args.team, root, cwd)
            action = begin(state, args.have)
        elif state is None:
            raise Problem('No run has begun for team %d in %s. Run "begin" first.' % (args.team, here))
        elif args.command == 'status':
            print(report(state))
            return 0
        elif args.command == 'woke':
            action = woke(state, args.have)
        else:
            action = result(state, args.outcome, args.have)
    except Problem as problem:
        print('BLOCKED: %s' % problem, file=sys.stderr)
        return 2
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    print(render(action, args.team))
    return 0


if __name__ == '__main__':
    sys.exit(main())
