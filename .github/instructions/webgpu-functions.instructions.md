# WGSL テクスチャ関数リファレンス

## 型パラメータ凡例

- `ST`: `i32`, `u32`, `f32`
- `C`: `i32`, `u32`
- `A`: `i32`, `u32` (配列インデックス)
- `L`: `i32`, `u32` (レベル)
- `S`: `i32`, `u32` (サンプルインデックス)
- `F`: テクセルフォーマット
- `CF`: チャンネルフォーマット（テクセルフォーマットに依存）

## WGSLコーディングルール

- **WGSLとGLSLを混同しない**
- **三項演算子は使用不可** - `a ? b : c` ではなく `if` 文または `select()` 関数を使用
- **letは再代入不可** - 再代入が必要な場合は `var` を使用

## テクスチャ次元取得

### textureDimensions

```wgsl
// 1Dテクスチャ
fn textureDimensions(t: T) -> u32
// ST: i32, u32, f32; F: テクセルフォーマット; A: アクセスモード
// T: texture_1d<ST> または texture_storage_1d<F,A>

fn textureDimensions(t: texture_1d<ST>, level: L) -> u32
// ST: i32, u32, f32; L: i32, u32

// 2Dテクスチャ
fn textureDimensions(t: T) -> vec2<u32>
// ST: i32, u32, f32; F: テクセルフォーマット; A: アクセスモード
// T: texture_2d<ST>, texture_2d_array<ST>, texture_cube<ST>, texture_cube_array<ST>,
//    texture_multisampled_2d<ST>, texture_depth_2d, texture_depth_2d_array,
//    texture_depth_cube, texture_depth_cube_array, texture_depth_multisampled_2d,
//    texture_storage_2d<F,A>, texture_storage_2d_array<F,A>, texture_external

fn textureDimensions(t: T, level: L) -> vec2<u32>
// ST: i32, u32, f32; L: i32, u32
// T: texture_2d<ST>, texture_2d_array<ST>, texture_cube<ST>, texture_cube_array<ST>,
//    texture_depth_2d, texture_depth_2d_array, texture_depth_cube, texture_depth_cube_array

// 3Dテクスチャ
fn textureDimensions(t: T) -> vec3<u32>
// ST: i32, u32, f32; F: テクセルフォーマット; A: アクセスモード
// T: texture_3d<ST> または texture_storage_3d<F,A>

fn textureDimensions(t: texture_3d<ST>, level: L) -> vec3<u32>
// ST: i32, u32, f32; L: i32, u32
```

**戻り値**: テクスチャの座標次元。ミップレベル、配列サイズ、サンプル数は除外。

**詳細**:
- 論理テクセルアドレスの座標に対する整数境界を提供
- キューブテクスチャの場合、各面の次元を返す（x=y）
- `level`が`[0, textureNumLevels(t))`範囲外の場合、戻り値型の不定値が返される可能性がある

## テクスチャギャザー

### textureGather

```wgsl
// 2Dテクスチャ
fn textureGather(component: C, t: texture_2d<ST>, s: sampler, coords: vec2<f32>) -> vec4<ST>
// C: i32, u32; ST: i32, u32, f32

fn textureGather(component: C, t: texture_2d<ST>, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> vec4<ST>
// C: i32, u32; ST: i32, u32, f32

// 2D配列テクスチャ
fn textureGather(component: C, t: texture_2d_array<ST>, s: sampler, coords: vec2<f32>, array_index: A) -> vec4<ST>
// C: i32, u32; A: i32, u32; ST: i32, u32, f32

fn textureGather(component: C, t: texture_2d_array<ST>, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> vec4<ST>
// C: i32, u32; A: i32, u32; ST: i32, u32, f32

// キューブテクスチャ
fn textureGather(component: C, t: texture_cube<ST>, s: sampler, coords: vec3<f32>) -> vec4<ST>
// C: i32, u32; ST: i32, u32, f32

fn textureGather(component: C, t: texture_cube_array<ST>, s: sampler, coords: vec3<f32>, array_index: A) -> vec4<ST>
// C: i32, u32; A: i32, u32; ST: i32, u32, f32

// 深度テクスチャ
fn textureGather(t: texture_depth_2d, s: sampler, coords: vec2<f32>) -> vec4<f32>
fn textureGather(t: texture_depth_2d, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> vec4<f32>
fn textureGather(t: texture_depth_cube, s: sampler, coords: vec3<f32>) -> vec4<f32>
fn textureGather(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A) -> vec4<f32>
// A: i32, u32
fn textureGather(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32
fn textureGather(t: texture_depth_cube_array, s: sampler, coords: vec3<f32>, array_index: A) -> vec4<f32>
// A: i32, u32
```

**戻り値**: 指定チャンネルから抽出した4成分ベクトル

**例: 2Dテクスチャからのコンポーネントギャザー**
```wgsl
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var dt: texture_depth_2d;
@group(0) @binding(2) var s: sampler;

fn gather_x_components(c: vec2<f32>) -> vec4<f32> {
  return textureGather(0,t,s,c);
}
fn gather_y_components(c: vec2<f32>) -> vec4<f32> {
  return textureGather(1,t,s,c);
}
fn gather_z_components(c: vec2<f32>) -> vec4<f32> {
  return textureGather(2,t,s,c);
}
fn gather_depth_components(c: vec2<f32>) -> vec4<f32> {
  return textureGather(dt,s,c);
}
```

### textureGatherCompare

```wgsl
// 深度比較ギャザー
fn textureGatherCompare(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32) -> vec4<f32>
fn textureGatherCompare(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32, offset: vec2<i32>) -> vec4<f32>
fn textureGatherCompare(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32) -> vec4<f32>
// A: i32, u32
fn textureGatherCompare(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32
fn textureGatherCompare(t: texture_depth_cube, s: sampler_comparison, coords: vec3<f32>, depth_ref: f32) -> vec4<f32>
fn textureGatherCompare(t: texture_depth_cube_array, s: sampler_comparison, coords: vec3<f32>, array_index: A, depth_ref: f32) -> vec4<f32>
// A: i32, u32
```

**戻り値**: 比較結果の4成分ベクトル（範囲: [0.0..1.0]）

**例: 深度比較ギャザー**
```wgsl
@group(0) @binding(0) var dt: texture_depth_2d;
@group(0) @binding(1) var s: sampler;

fn gather_depth_compare(c: vec2<f32>, depth_ref: f32) -> vec4<f32> {
  return textureGatherCompare(dt,s,c,depth_ref);
}
```

## テクスチャロード

### textureLoad

```wgsl
// 1Dテクスチャ
fn textureLoad(t: texture_1d<ST>, coords: C, level: L) -> vec4<ST>
// C: i32, u32; L: i32, u32; ST: i32, u32, f32

// 2Dテクスチャ
fn textureLoad(t: texture_2d<ST>, coords: vec2<C>, level: L) -> vec4<ST>
// C: i32, u32; L: i32, u32; ST: i32, u32, f32

fn textureLoad(t: texture_2d_array<ST>, coords: vec2<C>, array_index: A, level: L) -> vec4<ST>
// C: i32, u32; A: i32, u32; L: i32, u32; ST: i32, u32, f32

// 3Dテクスチャ
fn textureLoad(t: texture_3d<ST>, coords: vec3<C>, level: L) -> vec4<ST>
// C: i32, u32; L: i32, u32; ST: i32, u32, f32

// マルチサンプルテクスチャ
fn textureLoad(t: texture_multisampled_2d<ST>, coords: vec2<C>, sample_index: S) -> vec4<ST>
// C: i32, u32; S: i32, u32; ST: i32, u32, f32

// 深度テクスチャ
fn textureLoad(t: texture_depth_2d, coords: vec2<C>, level: L) -> f32
// C: i32, u32; L: i32, u32

fn textureLoad(t: texture_depth_2d_array, coords: vec2<C>, array_index: A, level: L) -> f32
// C: i32, u32; A: i32, u32; L: i32, u32

fn textureLoad(t: texture_depth_multisampled_2d, coords: vec2<C>, sample_index: S) -> f32
// C: i32, u32; S: i32, u32

// 外部テクスチャ
fn textureLoad(t: texture_external, coords: vec2<C>) -> vec4<f32>
// C: i32, u32
```

**戻り値**: フィルタリングされていないテクセルデータ

**論理テクセルアドレスが無効な場合**:
- `coords`の要素が対応する`[0, textureDimensions(t, level))`範囲外
- `array_index`が`[0, textureNumLayers(t))`範囲外
- `level`が`[0, textureNumLevels(t))`範囲外
- `sample_index`が`[0, textureNumSamples(s))`範囲外

**無効なアドレスの場合の戻り値**:
- 範囲内の別のテクセルデータ
- ゼロベクトル `(0,0,0,0)` または `(0,0,0,1)`（非深度テクスチャ）
- `0.0`（深度テクスチャ）

## テクスチャメタデータ

### textureNumLayers

```wgsl
fn textureNumLayers(t: T) -> u32
// F: テクセルフォーマット; A: アクセスモード; ST: i32, u32, f32
// T: texture_2d_array<ST>, texture_cube_array<ST>, texture_depth_2d_array,
//    texture_depth_cube_array, texture_storage_2d_array<F,A>
```

**戻り値**:
- キューブベーステクスチャの場合：キューブ配列テクスチャ内のキューブ数
- その他：配列テクスチャ内のレイヤー数（テクセルの同次グリッド数）

### textureNumLevels

```wgsl
fn textureNumLevels(t: T) -> u32
// ST: i32, u32, f32
// T: texture_1d<ST>, texture_2d<ST>, texture_2d_array<ST>, texture_3d<ST>,
//    texture_cube<ST>, texture_cube_array<ST>, texture_depth_2d,
//    texture_depth_2d_array, texture_depth_cube, texture_depth_cube_array
```

**戻り値**: ミップレベル数

### textureNumSamples

```wgsl
fn textureNumSamples(t: T) -> u32
// ST: i32, u32, f32
// T: texture_multisampled_2d<ST> または texture_depth_multisampled_2d
```

**戻り値**: マルチサンプルテクスチャのサンプル数

## テクスチャサンプリング

### textureSample

```wgsl
// 1Dテクスチャ
fn textureSample(t: texture_1d<f32>, s: sampler, coords: f32) -> vec4<f32>

// 2Dテクスチャ
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>) -> vec4<f32>
fn textureSample(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> vec4<f32>

// 2D配列テクスチャ
fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A) -> vec4<f32>
// A: i32, u32
fn textureSample(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32

// 3D/キューブテクスチャ
fn textureSample(t: T, s: sampler, coords: vec3<f32>) -> vec4<f32>
// T: texture_3d<f32> または texture_cube<f32>
fn textureSample(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, offset: vec3<i32>) -> vec4<f32>

// キューブ配列テクスチャ
fn textureSample(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A) -> vec4<f32>
// A: i32, u32

// 深度テクスチャ
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>) -> f32
fn textureSample(t: texture_depth_2d, s: sampler, coords: vec2<f32>, offset: vec2<i32>) -> f32
fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A) -> f32
// A: i32, u32
fn textureSample(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, offset: vec2<i32>) -> f32
// A: i32, u32
fn textureSample(t: texture_depth_cube, s: sampler, coords: vec3<f32>) -> f32
fn textureSample(t: texture_depth_cube_array, s: sampler, coords: vec3<f32>, array_index: A) -> f32
// A: i32, u32
```

**戻り値**: サンプリングされた値

**注意**: 非均一制御フローで呼び出すと不定値が返される

### textureSampleBias

```wgsl
// バイアス付きサンプリング
fn textureSampleBias(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, bias: f32) -> vec4<f32>
fn textureSampleBias(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, bias: f32, offset: vec2<i32>) -> vec4<f32>
fn textureSampleBias(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, bias: f32) -> vec4<f32>
// A: i32, u32
fn textureSampleBias(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, bias: f32, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32
fn textureSampleBias(t: T, s: sampler, coords: vec3<f32>, bias: f32) -> vec4<f32>
// T: texture_3d<f32> または texture_cube<f32>
fn textureSampleBias(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, bias: f32, offset: vec3<i32>) -> vec4<f32>
fn textureSampleBias(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A, bias: f32) -> vec4<f32>
// A: i32, u32
```

**戻り値**: サンプリングされた値

**注意**: 非均一制御フローで呼び出すと不定値が返される

### textureSampleCompare

```wgsl
// 深度比較サンプリング
fn textureSampleCompare(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32) -> f32
fn textureSampleCompare(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32, offset: vec2<i32>) -> f32
fn textureSampleCompare(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32) -> f32
// A: i32, u32
fn textureSampleCompare(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32, offset: vec2<i32>) -> f32
// A: i32, u32
fn textureSampleCompare(t: texture_depth_cube, s: sampler_comparison, coords: vec3<f32>, depth_ref: f32) -> f32
fn textureSampleCompare(t: texture_depth_cube_array, s: sampler_comparison, coords: vec3<f32>, array_index: A, depth_ref: f32) -> f32
// A: i32, u32
```

**戻り値**: 比較結果（範囲: [0.0..1.0]）

各サンプルテクセルは`sampler_comparison`で定義された比較演算子を使用して基準値と比較され、各テクセルで0または1の値になります。サンプラーがバイリニアフィルタリングを使用する場合、戻り値はこれらの値のフィルタリング平均です。そうでなければ単一テクセルの比較結果が返されます。

**注意**: 非均一制御フローで呼び出すと不定値が返される

### textureSampleCompareLevel

```wgsl
// レベル指定深度比較サンプリング（ミップレベル0固定）
fn textureSampleCompareLevel(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32) -> f32
fn textureSampleCompareLevel(t: texture_depth_2d, s: sampler_comparison, coords: vec2<f32>, depth_ref: f32, offset: vec2<i32>) -> f32
fn textureSampleCompareLevel(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32) -> f32
// A: i32, u32
fn textureSampleCompareLevel(t: texture_depth_2d_array, s: sampler_comparison, coords: vec2<f32>, array_index: A, depth_ref: f32, offset: vec2<i32>) -> f32
// A: i32, u32
fn textureSampleCompareLevel(t: texture_depth_cube, s: sampler_comparison, coords: vec3<f32>, depth_ref: f32) -> f32
fn textureSampleCompareLevel(t: texture_depth_cube_array, s: sampler_comparison, coords: vec3<f32>, array_index: A, depth_ref: f32) -> f32
// A: i32, u32
```

**戻り値**: 比較結果（範囲: [0.0..1.0]）

`textureSampleCompareLevel`は`textureSampleCompare`と同じですが、以下の違いがあります：
- 常にミップレベル0からテクセルをサンプリング
- 微分値を計算せず、均一制御フローでの呼び出しが不要
- 任意のシェーダーステージで呼び出し可能

### textureSampleGrad

```wgsl
// 勾配指定サンプリング
fn textureSampleGrad(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, ddx: vec2<f32>, ddy: vec2<f32>) -> vec4<f32>
fn textureSampleGrad(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, ddx: vec2<f32>, ddy: vec2<f32>, offset: vec2<i32>) -> vec4<f32>
fn textureSampleGrad(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, ddx: vec2<f32>, ddy: vec2<f32>) -> vec4<f32>
// A: i32, u32
fn textureSampleGrad(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, ddx: vec2<f32>, ddy: vec2<f32>, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32
fn textureSampleGrad(t: T, s: sampler, coords: vec3<f32>, ddx: vec3<f32>, ddy: vec3<f32>) -> vec4<f32>
// T: texture_3d<f32> または texture_cube<f32>
fn textureSampleGrad(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, ddx: vec3<f32>, ddy: vec3<f32>, offset: vec3<i32>) -> vec4<f32>
fn textureSampleGrad(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A, ddx: vec3<f32>, ddy: vec3<f32>) -> vec4<f32>
// A: i32, u32
```

**戻り値**: サンプリングされた値

### textureSampleLevel

```wgsl
// レベル指定サンプリング
fn textureSampleLevel(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, level: f32) -> vec4<f32>
fn textureSampleLevel(t: texture_2d<f32>, s: sampler, coords: vec2<f32>, level: f32, offset: vec2<i32>) -> vec4<f32>
fn textureSampleLevel(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, level: f32) -> vec4<f32>
// A: i32, u32
fn textureSampleLevel(t: texture_2d_array<f32>, s: sampler, coords: vec2<f32>, array_index: A, level: f32, offset: vec2<i32>) -> vec4<f32>
// A: i32, u32
fn textureSampleLevel(t: T, s: sampler, coords: vec3<f32>, level: f32) -> vec4<f32>
// T: texture_3d<f32> または texture_cube<f32>
fn textureSampleLevel(t: texture_3d<f32>, s: sampler, coords: vec3<f32>, level: f32, offset: vec3<i32>) -> vec4<f32>
fn textureSampleLevel(t: texture_cube_array<f32>, s: sampler, coords: vec3<f32>, array_index: A, level: f32) -> vec4<f32>
// A: i32, u32

// 深度テクスチャ
fn textureSampleLevel(t: texture_depth_2d, s: sampler, coords: vec2<f32>, level: L) -> f32
// L: i32, u32
fn textureSampleLevel(t: texture_depth_2d, s: sampler, coords: vec2<f32>, level: L, offset: vec2<i32>) -> f32
// L: i32, u32
fn textureSampleLevel(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, level: L) -> f32
// A: i32, u32; L: i32, u32
fn textureSampleLevel(t: texture_depth_2d_array, s: sampler, coords: vec2<f32>, array_index: A, level: L, offset: vec2<i32>) -> f32
// A: i32, u32; L: i32, u32
fn textureSampleLevel(t: texture_depth_cube, s: sampler, coords: vec3<f32>, level: L) -> f32
// L: i32, u32
fn textureSampleLevel(t: texture_depth_cube_array, s: sampler, coords: vec3<f32>, array_index: A, level: L) -> f32
// A: i32, u32; L: i32, u32
```

**戻り値**: サンプリングされた値

### textureSampleBaseClampToEdge

```wgsl
// エッジクランプサンプリング
fn textureSampleBaseClampToEdge(t: T, s: sampler, coords: vec2<f32>) -> vec4<f32>
// T: texture_2d<f32> または texture_external
```

**戻り値**: サンプリングされた値

## テクスチャ書き込み

### textureStore

```wgsl
// ストレージテクスチャへの書き込み
fn textureStore(t: texture_storage_1d<F,write>, coords: C, value: vec4<CF>)
// F: テクセルフォーマット; C: i32, u32
// CF: ストレージテクセルフォーマットFに依存。テクセルフォーマット表を参照

fn textureStore(t: texture_storage_2d<F,write>, coords: vec2<C>, value: vec4<CF>)
// F: テクセルフォーマット; C: i32, u32
// CF: ストレージテクセルフォーマットFに依存。テクセルフォーマット表を参照

fn textureStore(t: texture_storage_2d_array<F,write>, coords: vec2<C>, array_index: A, value: vec4<CF>)
// F: テクセルフォーマット; C: i32, u32; A: i32, u32
// CF: ストレージテクセルフォーマットFに依存。テクセルフォーマット表を参照

fn textureStore(t: texture_storage_3d<F,write>, coords: vec3<C>, value: vec4<CF>)
// F: テクセルフォーマット; C: i32, u32
// CF: ストレージテクセルフォーマットFに依存。テクセルフォーマット表を参照
```
