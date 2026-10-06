export type FlowNode = { label: string; note?: string; color?: string }
export type FlowDiagram = { type: 'flow'; title: string; direction?: 'row' | 'column'; nodes: FlowNode[] }
export type CompareRow = { aspect: string; cells: string[] }
export type CompareDiagram = {
  type: 'compare'
  title: string
  options: string[]
  rows: CompareRow[]
  recommend?: number
  note?: string
}
export type Diagram = FlowDiagram | CompareDiagram

declare module 'claude-code' {
  interface PluginState {
    'diagram-pane': { diagram: Diagram | null; isModeOn: boolean; error: string | null }
  }
}
