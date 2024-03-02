'use client'

import {
  BufferGeometry,
  InstancedMesh,
  Mesh,
  Program,
  Renderer,
  Scene,
  geometry,
  Matrix4,
} from '@paplico/core-new/expr-webgl'
import { useRef } from 'react'
import { useEffectOnce } from 'react-use'

export default function DevPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffectOnce(() => {
    // return
    const cx = canvasRef.current!.getContext('webgl2', {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    })!
    const renderer = new Renderer(cx)
    renderer.setSize(1000, 1000)

    const instanceCount = 1000

    const program = new Program(
      `#version 300 es
      precision highp float;

      in vec2 vUv;
      in vec4 vColor;

      out vec4 outColor;

      void main() {
        outColor = vColor;
          // outColor = vec4(vUv, 1.0, 1.0); // UV座標を色として出力
      }`,
      `#version 300 es
      in vec3 aPosition;
      in vec2 uv;
      in mat4 instanceMatrix;
      in vec4 instanceColor;

      out vec2 vUv;
      out vec4 vColor;

      void main() {
          vUv = uv;
          vColor = instanceColor;
          gl_Position = instanceMatrix * vec4(aPosition, 1.0);
      }
    `,
    )

    const scene = new Scene()

    // prettier-ignore
    const geometry = new BufferGeometry(
      [
        -0.5, -0.5, 0.0, // 第1の三角形の頂点1
        0.5, -0.5, 0.0, // 頂点2
        -0.5, 0.5, 0.0, // 頂点3
        -0.5, 0.5, 0.0, // 第2の三角形の頂点1
        0.5, -0.5, 0.0, // 頂点2
        0.5, 0.5, 0.0, // 頂点3
      ],
      // [
      //   0, 1, 2,
      //   2, 3, 0,
      // ]
    )

    geometry.setAttribute(
      'uv',
      // prettier-ignore
      new Float32Array([
        0.0, 0.0, // 第1の三角形の頂点
        1.0, 0.0, // 頂点2
        0.0, 1.0, // 頂点3
        0.0, 1.0, // 第2の三角形の頂点1
        1.0, 0.0, // 頂点2
        1.0, 1.0, // 頂点3
      ]),
      2,
    )

    geometry.setAttribute(
      'instanceMatrix',
      new Float32Array(
        Array.from({ length: instanceCount })
          .map((_, i) => {
            return new Matrix4().toArray()
          })
          .flat(),
      ),
      4,
      { bufferSubData: true, stride: 4 * 16, offset: 1 },
    )

    geometry.setAttribute(
      'instanceColor',
      new Float32Array(
        Array.from({ length: instanceCount })
          .map((_, i) => {
            return [i / instanceCount, i / instanceCount, i / instanceCount, 1]
          })
          .flat(),
      ),
      4,
      { bufferSubData: true },
    )

    // const mesh = new InstancedMesh(
    //   geometry.createPlaneGeometry(10, 10),
    //   program,
    //   10,
    // )
    const mesh = new InstancedMesh(geometry, program, 10)

    // const scene2 = new Scene()
    // scene2.add(
    //   new Mesh(
    //     geometry.createPlaneGeometry(10, 10),
    //     new Program(testFragmentShader2),
    //   ),
    // )

    scene.add(mesh)

    let frag = false
    requestAnimationFrame(function update() {
      // renderer.clear()
      renderer.render(scene)
      // renderer.render(scene2)
      // ;(frag = !frag) ? renderer.render(scene) : renderer.render(scene2)
      requestAnimationFrame(update)
    })
    console.log('ok')
  })

  useEffectOnce(() => {
    return
    const gl = canvasRef.current!.getContext('webgl2', {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    })!

    if (!gl) {
      alert('WebGL2をサポートしていないブラウザです。')
      throw new Error('WebGL2 not supported')
    }

    // シェーダーのソースコード
    const vertexShaderSource = `#version 300 es
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}`

    const fragmentShaderSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

void main() {
    outColor = vec4(vUv, 1.0, 1.0); // UV座標を色として出力
}`

    // シェーダーのコンパイル
    function createShader(
      gl: WebGL2RenderingContext,
      type: number,
      source: string,
    ) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
          'シェーダーコンパイルエラー:',
          gl.getShaderInfoLog(shader),
        )
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    // シェーダーのセットアップ
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    )

    // プログラムの作成とリンク
    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('プログラムリンクエラー:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      throw new Error('Program link failed')
    }

    // 3D四角形の頂点データ（位置）
    const positionVertices = new Float32Array([
      -0.5,
      -0.5,
      0.0, // 第1の三角形の頂点1
      0.5,
      -0.5,
      0.0, // 頂点2
      -0.5,
      0.5,
      0.0, // 頂点3
      -0.5,
      0.5,
      0.0, // 第2の三角形の頂点1
      0.5,
      -0.5,
      0.0, // 頂点2
      0.5,
      0.5,
      0.0, // 頂点3
    ])

    // UV座標データ
    const uvVertices = new Float32Array([
      0.0,
      0.0, // 第1の三角形の頂点1
      1.0,
      0.0, // 頂点2
      0.0,
      1.0, // 頂点3
      0.0,
      1.0, // 第2の三角形の頂点1
      1.0,
      0.0, // 頂点2
      1.0,
      1.0, // 頂点3
    ])

    // 位置データのバッファを作成してバインド
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positionVertices, gl.STATIC_DRAW)

    // UVデータのバッファを作成してバインド
    const uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvVertices, gl.STATIC_DRAW)

    // シェーダープログラムの使用
    gl.useProgram(program)

    // 位置属性の設定
    const positionAttributeLocation = gl.getAttribLocation(program, 'position')
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.enableVertexAttribArray(positionAttributeLocation)
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0)

    // UV属性の設定
    const uvAttributeLocation = gl.getAttribLocation(program, 'uv')
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.enableVertexAttribArray(uvAttributeLocation)
    gl.vertexAttribPointer(uvAttributeLocation, 2, gl.FLOAT, false, 0, 0)

    // 描画
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 6) //
  })

  return <canvas ref={canvasRef} width={1000} height={1000} />
}

const testFragmentShader = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

void main() {
    outColor = vec4(vUv, 1.0, 1.0); // UV座標を色として出力
}
`
const testFragmentShader2 = `
precision mediump float;

varying vec2 vUv;
// varying vec2 vTexCoord;

void main() {
  gl_FragColor = vec4(.85,.85,.85,1);
}
`
