import { expect, test } from 'claude-code/testing'

const COMPARE = JSON.stringify({
  type: 'compare',
  title: 'レビューの範囲',
  options: ['全部 AI', 'リスクで分ける'],
  rows: [{ aspect: '人間の負荷', cells: ['◎ ほぼゼロ', '○ 対象だけ'] }],
  recommend: 1,
})

const REQUEST = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['terminal' as const],
  tools: [],
  outputStyle: null,
  traits: [],
}

test('/diagram on のあいだだけ、システムプロンプトに図解の節が足される', async ($, on) => {
  // エンジンの代わりに、素のシステムプロンプトを 1 節だけ答える
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))

  const ids = async () => (await $.prompt.compose(REQUEST)).sections.map(section => section.id)

  expect(await ids()).not.toContain('diagram-pane:mode')
  expect((await $.command.run({ command: 'diagram', args: 'on' })).text).toBe('図解モード: オン')
  expect(await ids()).toContain('diagram-pane:mode')
  expect((await $.command.run({ command: 'diagram', args: 'off' })).text).toBe('図解モード: オフ')
  expect(await ids()).not.toContain('diagram-pane:mode')
})

test('*.diagram.json の Write で比較表が描かれ、推す案に ★ が付く', async ($, on) => {
  on('tool.call', () => ({ result: { type: 'create' } }))

  await $.tool.call({ tool: 'Write', file_path: '/tmp/x/review.diagram.json', content: COMPARE })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'diagram-pane',
      surface,
      component: 'Pane',
      requestId: 'diagram',
      props: { title: 'Diagram', isFocused: true, bodyColumns: 80, placement: 'dock' },
    })
    expect(await ui.find({ type: 'Text', text: /レビューの範囲/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /★ リスクで分ける/ })).toBeDefined()
    await ui.unmount()
  }
})

test('壊れた JSON はペインにエラーとして出し、Write 自体は通す', async ($, on) => {
  on('tool.call', () => ({ result: { type: 'create' } }))

  const ran = await $.tool.call({ tool: 'Write', file_path: '/tmp/x/bad.diagram.json', content: '{ broken' })
  expect(ran.isError).not.toBe(true)

  const ui = await $.ui.mount({
    plugin: 'diagram-pane',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'diagram',
    props: { title: 'Diagram', isFocused: true, bodyColumns: 80, placement: 'dock' },
  })
  expect(await ui.find({ type: 'Text', text: /図を読めませんでした/ })).toBeDefined()
  await ui.unmount()
})

test('ほかのファイルの Write では図を変えない', async ($, on) => {
  on('tool.call', () => ({ result: { type: 'create' } }))

  await $.tool.call({ tool: 'Write', file_path: '/tmp/x/notes.json', content: COMPARE })

  const ui = await $.ui.mount({
    plugin: 'diagram-pane',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'diagram',
    props: { title: 'Diagram', isFocused: true, bodyColumns: 80, placement: 'dock' },
  })
  expect(await ui.find({ type: 'Text', text: /まだ図がありません/ })).toBeDefined()
  await ui.unmount()
})
