import { createWebGL2Context } from '@/Infra/CanvasFactory'
import { setCanvasSize } from '@/utils/canvas'
import { Scene } from './Scene'

export class PPLCWebGLRenderer {
  public gl: WebGL2RenderingContext
  public vertBuf: WebGLBuffer
  public texQuadBuf: WebGLBuffer
  public inputTex: WebGLTexture

  constructor(gl?: WebGL2RenderingContext) {
    this.gl = gl ??= createWebGL2Context({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    })

    if ('id' in gl.canvas) gl.canvas.id = '__paplico-fx-gl-canvas'
    if ('name' in gl.canvas) gl.canvas.name = '__paplico-fx-gl-canvas'

    // setCanvasSize(this.gl.canvas, 1, 1)

    // gl.enable(gl.DEPTH_TEST) // 深度テストを有効化
    // gl.depthFunc(gl.LEQUAL) // 奥にあるものは隠れるようにする
    // gl.clearColor(0, 0, 0, 0)
    // gl.clear(gl.COLOR_BUFFER_BIT)

    // // this.vertBuf = gl.createBuffer()!
    // // gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf)
    // // gl.bufferData(
    // //   gl.ARRAY_BUFFER,
    // //   // prettier-ignore
    // //   new Float32Array([
    // //     -1, -1,
    // //     1, -1,
    // //     1, 1,
    // //     -1, 1
    // //   ]),
    // //   gl.STATIC_DRAW,
    // // )
    // // gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // // this.texQuadBuf = this.gl.createBuffer()!
    // // gl.bindBuffer(gl.ARRAY_BUFFER, this.texQuadBuf)
    // // gl.bufferData(
    // //   gl.ARRAY_BUFFER,
    // //   // prettier-ignore
    // //   new Float32Array([
    // //     0, 1,
    // //     1, 1,
    // //     1, 0,
    // //     0, 0
    // //   ]),
    // //   gl.STATIC_DRAW,
    // // )
    // // gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // // this.inputTex = gl.createTexture()!
  }

  public dispose() {
    this.gl.deleteBuffer(this.vertBuf)
    this.gl.deleteBuffer(this.texQuadBuf)
    this.gl.deleteTexture(this.inputTex)
  }

  protected getError() {
    const gl = this.gl
    return (
      {
        [gl.NO_ERROR]: 'NO_ERROR',
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL',
      }[gl.getError()] ?? gl.getError()
    )
  }

  public setSize(width: number, height: number) {
    setCanvasSize(this.gl.canvas, width, height)
    this.gl.viewport(0, 0, width, height)
  }

  public clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
  }

  public render(scene: Scene) {
    const gl = this.gl

    // gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf)

    scene.objects.forEach((mesh) => {
      // console.log('render', mesh)
      mesh.render(gl)
    })

    this.gl.flush()

    const error = this.getError()
    if (error !== 'NO_ERROR') {
      console.warn({ error })
    }
  }
}
