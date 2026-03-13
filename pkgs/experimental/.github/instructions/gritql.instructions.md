# GritQL Language Reference

GritQLは構造化されたコード検索・変換のためのクエリ言語です。SQLのような宣言的な構文でソースコードの検索・変換を行います。

## 基本構文

### パターン

パターンはGritQLの中核概念で、コードベース内で検索・マッチングを行う構造です。

#### コードスニペット
最も基本的なパターン形式。対象言語の有効なコード片をバッククォートで囲みます。
構文解析されて抽象構文木（AST）レベルでマッチングが行われるため、文字列マッチングよりも正確です。

```grit
`console.log('Hello, world!')`
```

**機能**:
- 構造的マッチング（文字列ではなくAST構造での比較）
- コメントや空白の違いを無視
- 引用符の違い（シングル/ダブル）を同一視

#### 言語アノテーション付きスニペット
特定の言語に限定してマッチングを行います。多言語プロジェクトで誤マッチを防ぎます。

```grit
js"console.log('Hello, world!')"
typescript"console.log('Hello, world!')"
```

**機能**:
- 言語固有のマッチング
- 多言語プロジェクトでの精密な制御
- サポート言語: js, typescript, python, go, rust等

#### rawプレフィックス
出力時の構文チェックをバイパスし、コードをそのまま出力します。
意図的に無効なコードを生成する場合や、構文チェックを回避したい場合に使用。

```grit
raw`if(' // I like broken code"`
```

**機能**:
- 構文チェック無効化
- そのままの文字列出力
- 一時的な無効コード生成に有用

### メタ変数 (Metavariables)

メタ変数はパターン内で可変部分を表現するプレースホルダーです。

#### 通常のメタ変数
コードの特定部分にバインドされ、パターン内で再利用できます。
スコープはファイル全体に及び、一度バインドされた値は保持されます。

```grit
`console.log($message)`
```

**機能**:
- AST構造の一部を捕捉
- パターン内での値の再利用
- 書き換え時の値の保持
- 命名規則: `$lowercase_snake_case`

#### 無名メタ変数
値の保存は不要だが、パターンの構造マッチングには必要な場合に使用。
メモリ効率が良く、マッチング性能を向上させます。

```grit
`console.log($_)`
```

**機能**:
- 値のバインド無し
- マッチングのみ実行
- メモリ効率向上
- 不要な値の捕捉を回避

#### スプレッドメタ変数
可変長の引数リストや配列要素など、0個以上のノードにマッチします。
関数の引数リスト変換等で威力を発揮します。

```grit
`console.log($message, $...)`
```

**機能**:
- 可変長ノードのマッチング
- 0個以上の要素に対応
- 関数引数、配列要素等に使用
- 無名のため値の取得は不可

#### 予約済みメタ変数
Gritシステムで特別な意味を持つメタ変数。ファイル操作や全体構造へのアクセスに使用。

**機能説明**:
- `$filename`: 現在処理中のファイルの相対パス
- `$new_files`: 新規作成ファイルのリスト（追加可能）
- `$program`: 現在のプログラム全体のAST
- `$grit_*`: Grit内部処理用（使用禁止）

### 書き換え演算子 (`=>`)

パターンマッチした部分を新しいコードに置換します。
左辺でマッチ条件を指定し、右辺で置換後のコードを定義します。

```grit
`println($message)` => `console.log($message)`
```

**機能**:
- マッチした部分の置換
- メタ変数の値を右辺で再利用
- 書き換え自体もパターンとして扱える
- 条件付き書き換えが可能

## データ型

GritQLは言語に依存しないプリミティブ型と、対象言語のAST構造を表現する構文ツリーノードを提供します。

### プリミティブ型

#### 文字列
GritQLの文字列は言語に依存せず、正確な文字列マッチングに使用されます。
コードスニペットとは異なり、AST解析を行わない生の文字列比較を実行します。

```grit
"Hello, world!"  // Grit文字列（生文字列）
`"Hello, world!"` // コードスニペット（AST解析）
```

**機能**:
- 言語非依存の文字列処理
- AST解析をバイパス
- 正確な文字列マッチング
- エスケープ文字対応（`\"`, `\\`）

#### 数値
整数と浮動小数点数をサポート。算術演算やインデックスアクセスに使用できます。
型推論により自動的に適切な型が選択されます。

```grit
42        // int
3.14      // double
```

**機能**:
- 型推論による自動型選択
- 算術演算のサポート
- インデックスアクセス
- 数値ベースの変換処理

#### リスト
順序付きの要素コレクション。配列的な操作とAST要素のマッチングに使用されます。
動的な要素追加と、特定順序でのマッチング検証が可能です。

```grit
$list = [`1`, `2`, `3`]
$list[0]   // `1` (正のインデックス)
$list[-1]  // `3` (負のインデックス)
$list += `4`  // 要素追加
```

**機能**:
- 順序付き要素の管理
- インデックスアクセス（正負両対応）
- 動的要素追加（`+=`演算子）
- AST要素の順序マッチング
- 範囲外アクセス時は`undefined`を返す

#### マップ
キー値ペアの不変コレクション。設定データやマッピングテーブルとして使用されます。
キーは文字とアンダースコアのみ使用可能です。

```grit
$capitals = { england: `london`, france: `paris` }
$capitals.england  // `london`
$capitals.nonexistent  // undefined
```

**機能**:
- 不変キー値ストレージ
- ドット記法でのアクセス
- 存在しないキーは`undefined`
- パターンマッチングとの組み合わせ

### 構文ツリーノード

対象言語のAST（抽象構文木）の各ノードを表現します。
各ノードは型とフィールドを持ち、言語固有の構造を正確に表現できます。

#### ノード構造
各ノードは型名とフィールドで構成され、階層的な構造を持ちます。
フィールドは他のノード、ノードリスト、またはプリミティブ値を含みます。

```grit
string(fragment = "foo")
augmented_assignment_expression(operator = $op, left = $x, right = $v)
```

**機能**:
- 言語固有のAST構造を表現
- 階層的なノード関係
- フィールドベースのアクセス
- 型安全なマッチング

#### フィールド省略
関心のないフィールドは省略可能で、記述を簡潔にできます。
省略されたフィールドは自動的に無名メタ変数として扱われます。

```grit
augmented_assignment_expression(operator = $op)
// 以下と同等
augmented_assignment_expression(operator = $op, left = $_, right = $_)
```

**機能**:
- 不要フィールドの省略
- 記述の簡素化
- 自動的な無名メタ変数化
- 重要な部分のみに集中

## 条件演算子

条件演算子はパターンマッチングの制御とフィルタリングを行う重要な機能です。

### where句
パターンが実行される前に満たすべき条件を定義します。
複数の条件を指定する場合は、全ての条件が真である必要があります。

```grit
`console.log($message)` => `logger.log($message)` where {
  $message <: string()
}
```

**機能**:
- パターン実行の前提条件
- 複数条件の論理積（AND）
- フィルタリング機能
- 書き換えの条件制御

### マッチ演算子 (`<:`)
Gritの最も重要な演算子で、左辺のメタ変数が右辺のパターンにマッチするかを検証します。
構造的マッチングを実行し、AST レベルでの比較を行います。

```grit
$message <: `Hello, world!`
$message <: string()
$method <: or { `log`, `error` }
```

**機能**:
- 構造的パターンマッチング
- AST レベルでの比較
- 複雑なパターンとの組み合わせ
- 型チェック機能

### 否定演算子 (`!`)
条件全体を否定し、条件が偽の場合に真を返します。
`not`修飾子とは異なり、条件レベルでの否定を行います。

```grit
! $message <: "Hello, world!"
```

**機能**:
- 条件レベルでの否定
- `not`修飾子との使い分け
- 排除パターンの実装
- 複雑な条件ロジック

### 論理演算子

#### and条件
全ての子条件が真の場合のみ真を返します。
where句のデフォルト動作と同じですが、明示的な記述に使用されます。

```grit
and {
  $message <: r"Hello, .*!",
  $method <: `log`
}
```

**機能**:
- 複数条件の論理積
- 明示的なAND演算
- 条件の階層化
- where句での冗長記述（通常不要）

#### or条件
いずれかの子条件が真の場合に真を返します。
短絡評価により、最初にマッチした条件で評価を終了します。

```grit
or {
  $message <: "Hello, world!",
  $method <: `error`
}
```

**機能**:
- 複数条件の論理和
- 短絡評価による効率化
- 選択的マッチング
- 代替パターンの指定

#### if条件
条件分岐を実装し、異なる条件下で異なる処理を実行します。
else句はオプションで、より複雑な条件ロジックを構築できます。

```grit
if ($message <: r"Hello, .*!") {
  $method => `console.info`
} else {
  $method => `console.warn`
}
```

**機能**:
- 条件分岐
- else句による代替処理
- 動的な書き換え選択
- 複雑なロジックの実装

### 代入演算子 (`=`)
メタ変数に値を代入します。代入は常に成功し、計算された値や変換結果を保存できます。
他のプログラミング言語の変数代入と似た動作をします。

```grit
$new_log_call = `logger.log($message)`
$counter = $counter + 1
```

**機能**:
- メタ変数への値代入
- 計算結果の保存
- 一時変数の作成
- 常に成功する条件

## パターン修飾子

パターン修飾子はパターンの動作を変更し、より柔軟で強力なマッチング機能を提供します。

### 論理演算子

#### and句
複数のパターンを組み合わせ、全てがマッチした場合のみ成功します。
複雑な変換を一度に実行する際に有用です。

```grit
and {
  contains js"React.useState" => js"useState",
  contains js"React.useMemo" => js"useMemo",
}
```

**機能**:
- 複数パターンの同時実行
- 複合的な変換処理
- 全条件の同時満足
- 複雑なリファクタリング

#### or句
複数のパターンを試行し、いずれかがマッチした場合に成功します。
短絡評価により、最初にマッチしたパターンのみが実行されます。

```grit
or {
  `console.log($message)`,
  `console.error($message)`
} => `winston.info($message)`
```

**機能**:
- 代替パターンの提供
- 短絡評価による効率化
- 選択的マッチング
- 類似パターンの統合処理

#### any句
orの非短絡評価版で、全てのパターンを試行し、マッチするもの全てを実行します。
複数の変換を同時に適用したい場合に使用されます。

```grit
any {
  contains js"React.useState" => js"useState",
  contains js"React.useMemo" => js"useMemo",
}
```

**機能**:
- 非短絡評価
- 複数マッチの同時実行
- 包括的な変換処理
- 全パターンの試行

#### not句
パターンを否定し、マッチしない場合に成功します。
除外条件や反対条件の実装に使用されます。

```grit
$method <: not `console.error`
```

**機能**:
- パターンレベルでの否定
- 除外条件の実装
- 反対条件の指定
- 否定的フィルタリング

#### maybe句
オプショナルなマッチングを提供し、パターンがマッチしなくても全体は成功します。
オプション機能や条件付き変換に有用です。

```grit
$err <: maybe string(fragment=$fun) => `{ message: $err }`
```

**機能**:
- オプショナルマッチング
- 失敗許容パターン
- 条件付き変換
- 柔軟性の向上

**注意**: maybe句内のメタ変数は、マッチした場合のみバインドされます。

### コンテキスト修飾子

#### contains
構文木を下方向に探索し、特定のパターンを含むノードをマッチングします。
深い階層での要素検索に使用されます。

```grit
`function ($args) { $body }` where {
  $args <: contains `x`
}
```

**機能**:
- 下方向への探索
- 深い階層でのマッチング
- 包含関係の検証
- 子要素の検索

#### until
contains探索を制限し、特定のパターンに到達した時点で探索を停止します。
セキュリティチェックや境界条件の実装に有用です。

```grit
$content <: contains `secret` until `sanitized($_)`
```

**機能**:
- 探索の境界設定
- 条件付き探索停止
- セキュリティ境界の実装
- 制限付きマッチング

#### within
特定のコンテキスト内でのみマッチングを行います。
コンテキスト依存の変換や条件付き処理に使用されます。

```grit
`console.log($arg)` where {
  $arg <: within `if (DEBUG) { $_ }`
}
```

**機能**:
- コンテキスト依存マッチング
- 上位構造での制限
- 条件付き処理
- 環境依存の変換

#### after
直後に特定のパターンが続く場合のみマッチングします。
順序依存の処理や連続要素の処理に使用されます。

```grit
`console.warn($_)` as $warn where {
  $warn <: after `console.log($_)`
}
```

**機能**:
- 順序依存マッチング
- 後続要素の検証
- 連続パターンの処理
- 次要素の取得も可能

#### before
直前に特定のパターンがある場合のみマッチングします。
前置条件や順序関係の検証に使用されます。

```grit
`console.warn($_)` as $warn where {
  $warn <: before `console.log($_)`
}
```

**機能**:
- 前置条件の検証
- 順序関係の確認
- 先行要素との関係
- 前要素の取得も可能

### リスト修飾子

#### some
リストの要素のうち、少なくとも一つが指定パターンにマッチする場合に成功します。
部分的な条件満足や存在確認に使用されます。

```grit
$names <: some { `"andrew"` }
```

**機能**:
- 部分マッチング
- 存在確認
- 最低一つの条件満足
- リスト要素の部分検証

**ヒント**: `maybe some`で要素が見つからなくても成功させることができます。

#### every
リストの全要素が指定パターンにマッチする場合のみ成功します。
全件条件や一括変換の検証に使用されます。

```grit
$names <: every or {`"andrew"`, `"alex"`}
```

**機能**:
- 全要素の条件満足
- 一括検証
- 短絡評価（最初の失敗で停止）
- 全件条件の確認

#### リストパターン
順序付きリストの正確なマッチングを行います。
特定の順序や構造を持つリストの検証に使用されます。

```grit
$numbers <: [`2`, `3`, `5`]
```

**機能**:
- 順序付きマッチング
- 正確な構造検証
- リスト構造の確認
- 固定パターンの検証

#### ...句
リストの部分的なマッチングを行い、中間要素を無視します。
可変長リストや部分的なパターンマッチングに使用されます。

```grit
$numbers <: [`2`, `3`, ..., `11`]
```

**機能**:
- 部分的リストマッチング
- 中間要素の無視
- 可変長対応
- 開始・終了パターンの検証

### その他の修飾子

#### as修飾子
マッチした部分全体をメタ変数にバインドします。
全体の変換と部分的な変更を同時に行う場合に有用です。

```grit
`function $name ($args) { $body }` as $func where {
  $func => `const $name = ($args) => { $body }`,
  $args <: contains `apple` => `mango`
}
```

**機能**:
- 全体のバインド
- 複合的な変換
- 部分と全体の同時処理
- 複雑なリファクタリング

#### limit句
マッチ数を制限し、指定された数に達した時点で処理を停止します。
大規模なコードベースでの段階的な変更や性能制御に使用されます。

```grit
`console.$method($message)` => `console.warn($message)` limit 2
```

**機能**:
- マッチ数の制限
- 段階的な変更
- 性能制御
- グローバルな制限（全ファイル対象）

**注意**: limitはファイルレベルで適用され、sequentialやmultifileパターンでは配置に注意が必要です。

## 高度なパターン

複雑な変換シナリオや特殊な要件に対応するための高度な機能群です。

### 順次パターン (sequential)
複数のパターンを順番に実行し、前のパターンの完了を待ってから次のパターンを実行します。
段階的な変換や依存関係のある変更に使用されます。

```grit
sequential {
  bubble file($body) where $body <: contains `console.log($message)` => `console.warn($message)`,
  bubble file($body) where $body <: contains `console.warn($message)` => `console.info($message)`
}
```

**機能**:
- 段階的変換
- 前段階の完了待ち
- 依存関係のある変更
- トップレベルのみ使用可能

**制限**: sequentialは最上位レベルでのみ使用でき、他のパターンの内部では使用できません。

### マルチファイルパターン (multifile)
複数ファイルにわたる変換を単一の状態で管理します。
一つのファイルから情報を収集し、他のファイルに適用する際に使用されます。

```grit
multifile {
  bubble($prop, $source_file) file($body) where $body <: contains `type $prop = $_` where {
    $prop <: `Props`,
    $prop => `NewProps`,
    $source_file = $filename
  },
  bubble($prop, $source_file) file($body) where {
    $body <: contains `$prop` => `NewProps`,
  }
}
```

**機能**:
- グローバル状態の共有
- ファイル間の情報伝達
- 一括リファクタリング
- 情報収集→適用のパターン

**用途**: 型名変更、import/exportの更新、依存関係の変更等

### 空パターン (.)
マッチした部分を削除します。コードの除去や不要部分の削除に使用されます。

```grit
`console.log($_)` => .
```

**機能**:
- コードの削除
- 不要部分の除去
- 書き換えの右辺でのみ使用
- 空のAST ノードを表現

### 正規表現
パターンマッチングに正規表現を使用し、より柔軟な文字列マッチングを実現します。
キャプチャグループを使用してマッチした部分をメタ変数にバインドできます。

```grit
"Hello, world!" <: r"Hello, (.*)"($name)
```

**機能**:
- 柔軟な文字列マッチング
- キャプチャグループ
- Rust正規表現構文
- 動的パターン構築

#### 動的正規表現
実行時に正規表現パターンを構築できます：

```grit
$message <: r`([a-zA-Z]*), $name`($greeting) => `$name, $greeting`
```

**機能**:
- 実行時パターン構築
- メタ変数を含む正規表現
- 複雑な文字列操作
- 条件付きマッチング

### fileとprogram
ファイル全体やプログラム全体に対する操作を提供します。

#### file
ファイル名とボディの両方を操作できます：

```grit
file($name, $body) where {
  $name => `$name.bak`,
  $body => `// Renamed!\n\n$body`
}
```

**機能**:
- ファイル名の変更
- ファイル全体の操作
- ヘッダー/フッターの追加
- ファイルレベルの変換

#### program
現在のプログラム全体へのアクセスを提供し、グローバルな条件判定に使用されます：

```grit
`console.log($log)` => `logger.log($log)` where {
  $program <: contains `logger`
}
```

**機能**:
- プログラム全体の参照
- グローバル条件判定
- 依存関係の確認
- ファイル全体の状態確認

### 範囲パターン (range)
ファイル内の特定の行・列範囲を対象とした操作を行います。
部分的な変更や位置ベースの編集に使用されます。

```grit
range(start_line=1, end_line=3) => .
range(start_line=2, end_line=2, start_column=1, end_column=10) => .
```

**パラメータ**:
- `start_line`: 開始行（1ベース、包含）
- `end_line`: 終了行（1ベース、包含、省略可）
- `start_column`: 開始列（1ベース、包含）
- `end_column`: 終了列（1ベース、包含）

**機能**:
- 位置ベースの編集
- 部分的な削除・変更
- 行・列レベルの精密制御
- containsとの組み合わせ

## 変数スコープ

GritQLの変数スコープシステムは、メタ変数の有効範囲を制御し、複雑なパターンマッチングを可能にします。

### デフォルトスコープ
メタ変数は一度バインドされると、ファイル全体でその値を保持します。
これにより、同じメタ変数は常に同じ値を持つことが保証されます。

**動作原理**:
- メタ変数はファイル全体で共通スコープ
- 一度バインドされた値は変更されない
- 同名メタ変数は同じ値でなければマッチ失敗

**例**: `console.log($x)`は、最初にマッチした`$x`の値で固定され、異なる値の`$x`はマッチしません。

### bubble句
新しいスコープを導入し、内部のメタ変数を外部から分離します。
複数箇所で同じパターンを適用する際に有用です。

```grit
bubble `console.log($message)` => `console.warn($message)`
```

**機能**:
- 新しい変数スコープの作成
- 内部変数の分離
- 複数マッチの独立性
- スコープ境界の明確化

**効果**: bubble内の`$message`は、各マッチで異なる値を持つことができます。

#### 引数付きbubble
特定のメタ変数のみスコープを越えて共有できます：

```grit
bubble($name) `console.log($message)` => `console.warn($message, $name)`
```

**機能**:
- 選択的な変数共有
- スコープ境界の制御
- 外部変数への限定アクセス
- 柔軟なスコープ管理

### パターン自動ラップ
ルートパターンは自動的にファイルスコープと複数マッチング用のbubbleでラップされます。

```grit
// 実際の記述
`console.log($message)` => `logger.log($message)`

// 自動的に以下と同等に変換
file(body=contains bubble `console.log($message)` => `logger.log($message)`)
```

**機能**:
- 自動的なマルチマッチ対応
- ファイル単位の処理
- 記述の簡素化
- デフォルトの利便性

**上書き**: fileパターンで明示的に記述することで、この動作を制御できます。

### グローバルメタ変数
`$GLOBAL_`プレフィックスで始まる大文字のメタ変数は、パターン定義を越えてスコープを共有します。

```grit
$GLOBAL_IMPORTS = []
$GLOBAL_COUNTER = 0
```

**機能**:
- パターン間の情報共有
- グローバル状態の管理
- 累積的な処理
- 複雑な変換での状態保持

**用途**: import文の管理、カウンター、累積リスト等

### 定義されたパターン
パターン定義時に新しいスコープが確立され、パラメータがスコープ境界を越えます。

```grit
pattern console_method_to_info($method) {
  `console.$method($message)` => `console.info($message)`
}
```

**機能**:
- パターンレベルのスコープ分離
- パラメータによるスコープ越え
- 再利用可能なパターン
- モジュール化された変換

### スコープ制御の戦略

#### 独立したマッチング
複数箇所で同じパターンを独立して適用：
```grit
bubble `console.log($message)` => `console.warn($message)`
```

#### 統一されたマッチング
ファイル全体で同じ値のみマッチ：
```grit
file(body = contains `console.$method` => `println`)
```

#### 選択的な情報共有
一部の変数のみ共有：
```grit
bubble($shared_var) `pattern($shared_var, $local_var)`
```

## ベストプラクティス

効果的で保守性の高いGritQLパターンを作成するための指針です。

### 具体的な書き換え
パターンはできるだけ具体的に記述し、意図しないマッチを避けます。
条件を追加することで、より安全で予測可能な変換を実現できます。

```grit
// Good: 基本的な変換
`println($message)` => `console.log($message)`

// Better: 条件付きで安全な変換
`println($message)` => `console.log($message)` where {
  $message <: string()
}
```

**理由**:
- 意図しないマッチの回避
- 変換の安全性向上
- デバッグの容易性
- 保守性の向上

### dry-run推奨
実際の変更を適用する前に、必ずdry-runで結果を確認します。
大規模な変更では特に重要です。

```bash
grit apply --dry-run 'pattern'
grit apply 'pattern'  # 確認後に実行
```

**利点**:
- 変更内容の事前確認
- 意図しない変更の発見
- 安全な変更プロセス
- 学習とデバッグに有効

### エスケープ
特殊文字（バッククォート、ドル記号）を文字通りに使用する場合は、適切にエスケープします。

```grit
`console.log(\`$template\`)`  // バッククォートとドル記号をエスケープ
`console.log("Price: \$$$price")`  // ドル記号をエスケープ
```

**必要な場面**:
- テンプレートリテラル内での処理
- 通貨記号等の処理
- 特殊文字を含む文字列マッチング

### 言語制限
対象言語を明示的に指定することで、マルチ言語プロジェクトでの誤マッチを防ぎます。

```grit
js"console.log($message)"     // JavaScript/TypeScriptのみ
typescript"interface $name"   // TypeScriptのみ
python"print($message)"       // Pythonのみ
```

**効果**:
- 言語固有の正確なマッチング
- 多言語プロジェクトでの安全性
- 構文の言語差異への対応

### パフォーマンス考慮

#### 効率的なパターン設計
```grit
// 効率的: 具体的な条件で絞り込み
`console.$method($message)` where $method <: `log`

// 非効率的: 広範囲なマッチング後にフィルタリング
$_ <: contains `console.log($message)`
```

#### limit句の活用
```grit
// 大規模コードベースでの段階的変更
`legacy_function($args)` => `new_function($args)` limit 10
```

### エラー処理とデバッグ

#### 段階的な開発
```grit
// Step 1: 基本パターンのテスト
`console.log($message)`

// Step 2: 条件追加
`console.log($message)` where $message <: string()

// Step 3: 書き換え追加
`console.log($message)` => `logger.info($message)` where $message <: string()
```

#### デバッグのためのas句活用
```grit
`function $name($args) { $body }` as $func where {
  $func => `// DEBUG: Found function $name\n$func`
}
```

### 保守性のための設計

#### 再利用可能なパターン定義
```grit
// パターン定義で再利用性を向上
pattern log_to_logger($level) {
  `console.$level($message)` => `logger.$level($message)`
}

// 呼び出し
log_to_logger("info")
log_to_logger("error")
```

#### 文書化
```grit
// Purpose: Convert console.log to logger.info for production builds
// Scope: JavaScript/TypeScript files only
// Safety: Only targets string literal messages
js`console.log($message)` => js`logger.info($message)` where {
  $message <: string()
}
```

## 使用例

### 基本的な関数呼び出し変換
```grit
`console.log($message)` => `logger.info($message)`
```

### 条件付き変換
```grit
`console.$method($message)` => `winston.$method($message)` where {
  $method <: or {
    `log` => `debug`,
    `error` => `warn`
  }
}
```

### 複雑なリファクタリング
```grit
`function $name($args) { $body }` => `const $name = ($args) => { $body }` where {
  $body <: contains `return $value` => `return $value`
}
```
