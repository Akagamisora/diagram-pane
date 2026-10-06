import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CompareDiagram, Diagram, FlowDiagram } from '../types'

const PANE = 'diagram'
const FILE = /\.diagram\.json$/
const PALETTE = ['#5b9bd5', '#e0a33a', '#5cb85c', '#c678dd', '#e06c75', '#56b6c2']

const diagram = atom({ plugin: 'diagram-pane', key: 'diagram' } as const, null)
const isModeOn = atom({ plugin: 'diagram-pane', key: 'isModeOn' } as const, false)
const error = atom({ plugin: 'diagram-pane', key: 'error' } as const, null)

const MODE_PROMPT = `# 図解モード（diagram-pane）
図解モードがオンです。説明に図が役立つとき（処理の流れ・分担・手順、または複数案の比較）だけ、
スクラッチパッド内に \`<名前>.diagram.json\` を Write ツールで書き出すと、ターミナル横のペインに描画される。
短い返答・作業報告では図を作らない。図を出したら、チャット本文は結論を先に 3〜5 行で書き、図の内容を文章で繰り返さない。
チャット本文に罫線文字で図を描かない（日本語の幅が揃わず崩れる）。

フロー: {"type":"flow","title":"…","direction":"row"|"column","nodes":[{"label":"…","note":"補足（任意）","color":"#RRGGBB（任意）"}]}
- ラベルは短く（全角 10 字程度まで）。ノードは 6 個まで。横に収まらなければ "column"。
比較表: {"type":"compare","title":"…","options":["案A","案B"],"rows":[{"aspect":"観点","cells":["◎ 理由","△ 理由"]}],"recommend":0,"note":"結論（任意）"}
- options は 4 個まで、rows は 8 行まで。cells は options と同じ数。セルは「記号＋短い理由」。recommend は推す案の添字。`

const STATUS = '◆ 図解モード'

function parse(text: string): Diagram {
  const value = JSON.parse(text)
  if (value?.type === 'flow' && Array.isArray(value.nodes)) return value as FlowDiagram
  if (value?.type === 'compare' && Array.isArray(value.options) && Array.isArray(value.rows)) {
    return value as CompareDiagram
  }
  throw new Error('type は flow か compare、nodes / options / rows が必要です')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'diagram',
      description: '図解モードとペイン: on / off（モード）・open / close（ペイン）。引数なしでペインを開く',
    })
    $.ui.status((await read($, isModeOn)) ? STATUS : undefined)

    return next(e)
  })

  on('command.run', { command: 'diagram' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      const isOn = arg === 'on'
      await update($, isModeOn, () => isOn)
      $.ui.status(isOn ? STATUS : undefined)
      return { text: `図解モード: ${isOn ? 'オン' : 'オフ'}` }
    }
    if (arg === 'close') {
      await $.ui.close({ id: PANE })
      return { text: 'ペインを閉じました。' }
    }
    if (arg === '' || arg === 'open') {
      await $.ui.open({ id: PANE, title: 'Diagram' })
      return { text: 'ペインを開きました。' }
    }

    return { text: '使い方: /diagram [on | off | open | close]' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await read($, isModeOn))) return composed

    return {
      sections: [
        ...composed.sections,
        { id: 'diagram-pane:mode', text: MODE_PROMPT, scope: 'session' as const },
      ],
    }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (!FILE.test(e.file_path) || ran.deny !== undefined || ran.isError === true) return ran
    try {
      const parsed = parse(e.content)
      await update($, diagram, () => parsed)
      await update($, error, () => null)
    } catch (cause) {
      await update($, error, () => `${e.file_path}: ${String(cause)}`)
    }
    await $.ui.open({ id: PANE, title: 'Diagram' })

    return ran
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const current = await read($, diagram)
    const failure = await read($, error)
    const columns = e.props.bodyColumns

    if (failure) return <Text color="#e06c75">図を読めませんでした: {failure}</Text>
    if (!current) return <Text dimColor>まだ図がありません。</Text>

    if (current.type === 'flow') {
      const isColumn = current.direction === 'column' || columns < 60
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>{current.title}</Text>
          <Box flexDirection={isColumn ? 'column' : 'row'} alignItems={isColumn ? 'flex-start' : 'center'} flexWrap="wrap">
            {current.nodes.map((node, i) => (
              <Box flexDirection={isColumn ? 'column' : 'row'} alignItems="center">
                {i > 0 && <Text color="gray">{isColumn ? '   ▼' : ' ──▶ '}</Text>}
                <Box flexDirection="column" borderStyle="round" borderColor={node.color ?? PALETTE[i % PALETTE.length]} paddingX={1}>
                  <Text bold>{node.label}</Text>
                  {node.note && <Text dimColor>{node.note}</Text>}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )
    }

    const aspectWidth = '22%'
    const optionWidth = `${Math.floor(78 / Math.max(1, current.options.length))}%`
    const rule = '─'.repeat(Math.max(10, columns - 4))
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{current.title}</Text>
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Box flexDirection="row">
            <Box width={aspectWidth}><Text dimColor>観点</Text></Box>
            {current.options.map((option, i) => (
              <Box width={optionWidth} paddingRight={1}>
                <Text bold color={i === current.recommend ? '#5cb85c' : undefined}>
                  {i === current.recommend ? `★ ${option}` : option}
                </Text>
              </Box>
            ))}
          </Box>
          <Text color="gray" wrap="truncate">{rule}</Text>
          {current.rows.map(row => (
            <Box flexDirection="row">
              <Box width={aspectWidth} paddingRight={1}><Text bold>{row.aspect}</Text></Box>
              {current.options.map((_, i) => (
                <Box width={optionWidth} paddingRight={1}>
                  <Text>{row.cells[i] ?? ''}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
        {current.note && <Text>{current.note}</Text>}
      </Box>
    )
  })
}
