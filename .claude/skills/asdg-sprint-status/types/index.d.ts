export type Sprint = {
  /** False when the project has no `.asdg/sprint.json`: the band stays empty. */
  isAsdgProject: boolean
  status: string
  id: string | null
  objective: string | null
  scope: string[]
  acceptance: string[]
  branch: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'asdg-sprint-status': { sprint: Shaped<Sprint | null> }
  }
}
