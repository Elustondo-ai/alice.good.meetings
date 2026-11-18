import { expect, test } from 'claude-code/testing'

const RECORD = {
  status: 'active',
  sprint_id: 'SPRINT-003',
  objective: 'Give Alice a new page design.',
  scope: ['index.html', 'poc/'],
  acceptance_criteria: ['Tests pass.', 'Pablo approves the layout.'],
}

const BAND = {
  plugin: 'asdg-sprint-status',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PANE = {
  plugin: 'asdg-sprint-status',
  component: 'Pane',
  requestId: 'sprint',
  props: {
    title: 'ASDG sprint',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const engine = (on: any, files: Record<string, string>) => {
  on('command.register', () => ({ value: { command: 'asdg-sprint-pane' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  // Refused: the poll's timer never fires inside a test.
  on('clock.every', () => ({ deny: 'no timers in a test' }))
  on('fs.read', (_: unknown, e: any) => {
    // The engine hands the path over absolute, under the working directory.
    const name = Object.keys(files).find(one => e.path.endsWith('/' + one))
    const text = name === undefined ? undefined : files[name]

    if (text === undefined) {
      throw new Error('missing')
    }

    return { value: text }
  })
}

test('the band names the active sprint and its branch', async ($, on) => {
  engine(on, {
    '.asdg/sprint.json': JSON.stringify(RECORD),
    '.git/HEAD': 'ref: refs/heads/sprint-03\n',
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ type: 'Text', text: /active/ }))?.text).toBe('SPRINT-003 active')
    expect((await ui.find({ type: 'Text', text: /sprint-03/ }))?.text).toContain('Give Alice')
    await ui.unmount()
  }
})

test('the pane lists scope and acceptance criteria', async ($, on) => {
  engine(on, {
    '.asdg/sprint.json': JSON.stringify(RECORD),
    '.git/HEAD': 'ref: refs/heads/sprint-03\n',
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /poc/ }))?.text).toBe('poc/')
  expect((await ui.find({ type: 'Text', text: /2\. / }))?.text).toBe('2. Pablo approves the layout.')
  await ui.unmount()
})

test('an inactive sprint says so', async ($, on) => {
  engine(on, {
    '.asdg/sprint.json': JSON.stringify({ status: 'inactive', sprint_id: null, scope: [] }),
    '.git/HEAD': 'ref: refs/heads/main\n',
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /sprint/ }))?.text).toBe('No active sprint')
  await ui.unmount()
})
