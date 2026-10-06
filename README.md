# diagram-pane

Claude Code の mod。Claude の説明のうち、図にしたほうが読みやすいもの（処理の流れ、複数案の比較）を、ターミナル横のペインに描く。チャット本文は結論の数行だけになる。

描画は Claude Code の画面部品（枠線つきの箱と文字）だけで行う。画像を使わないので、画像表示に対応していないターミナルでも出る。日本語の文字幅も崩れない。

動作確認は Claude Code v2.1.291（macOS、Orca）。

## 入れ方

このリポジトリ自体がマーケットプレイスになっている。

```bash
claude plugin marketplace add Akagamisora/diagram-pane
claude plugin install diagram-pane@diagram-pane
```

入れずに 1 セッションだけ試すなら、clone して `--plugin-dir` で読み込む。

```bash
git clone https://github.com/Akagamisora/diagram-pane
claude --plugin-dir diagram-pane
```

mod は本人の権限で動く。入れる前に `claude plugin validate diagram-pane` で、どのイベントに割り込み、どの API を呼ぶかを確認できる。

## 使い方

| 操作 | 動き |
| :- | :- |
| `/diagram on` | 図解モードをオンにする。プロンプト下に `◆ 図解モード` が出る |
| `/diagram off` | 図解モードをオフにする |
| `/diagram`（`/diagram open`） | ペインを開き、最後に描いた図を出す |
| `/diagram close` | ペインを閉じる（`Esc` や `ctrl+x x` でも閉じる） |

図解モードの間は、システムプロンプトに図の書き出し方が 1 節足される。Claude は図が役立つときだけ `<名前>.diagram.json` を書き出し、mod がその Write を検知してペインに描く。短い返答や作業報告では図を作らない。

## 図の形式

フロー（箱と矢印）:

```json
{
  "type": "flow",
  "title": "レビューの分担",
  "direction": "row",
  "nodes": [
    { "label": "AIが実装" },
    { "label": "AIがレビュー" },
    { "label": "人間は判断だけ", "note": "認可・移行・本番操作" }
  ]
}
```

`direction` は `row`（横）か `column`（縦）。ペインが狭いと縦になる。`color` で枠の色を変えられる。

比較表:

```json
{
  "type": "compare",
  "title": "レビューを AI に任せる範囲",
  "options": ["全部 AI", "リスクで分ける", "全部人間"],
  "rows": [{ "aspect": "人間の負荷", "cells": ["◎ ほぼゼロ", "○ 対象だけ", "× 追いつかない"] }],
  "recommend": 1,
  "note": "推奨: リスクで分ける"
}
```

`recommend` は推す案の添字。見出しに `★` が付く。

## 制限

- ペインの閉じる印は枠の右上に出る。ターミナルが同じ位置に自前のボタンを重ねる場合（Orca など）は隠れるので、`/diagram close` か `Esc` で閉じる
- 図は最後の 1 枚だけを持つ。履歴はない
