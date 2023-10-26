import {
  Camera,
  RawShaderMaterial,
  Scene,
  WebGLRenderer,
  PlaneGeometry,
  WebGLRenderTarget,
  Mesh,
  CanvasTexture,
  Wrapping,

  // consts
  RepeatWrapping,
  ClampToEdgeWrapping,
  MirroredRepeatWrapping,
  LinearFilter,
  NearestFilter,
  TextureFilter,
  IUniform,
} from 'three'
import {
  InputSource,
  OutputTarget,
  PapRenderTarget,
  PapFilterProgram,
  PapUniforms,
  __papRenderTargetMark,
  __paplicoFilterProgram,
  WebGLTypes,
  TexUniform,
  FilterWebGLContext,
} from './FilterContextAbst'

type PapThreeFilterProgram = PapFilterProgram<RawShaderMaterial>
type PapThreeRenderTarget = PapRenderTarget<WebGLRenderTarget>

export class ThreeFilterContext implements FilterWebGLContext {
  protected renderer: WebGLRenderer
  protected scene: Scene
  protected camera: Camera
  protected geometry: PlaneGeometry
  protected disposables: WeakRef<{ dispose(): void }>[] = []

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer
    // this.renderer = new WebGLRenderer({
    //   antialias: true,
    //   alpha: true,
    //   premultipliedAlpha: true,
    //   preserveDrawingBuffer: true,
    // })
    // this.renderer.setClearColor(0x000000, 0)

    this.scene = new Scene()
    this.camera = new Camera()
    this.geometry = new PlaneGeometry(2, 2)
  }

  public dispose(): void {
    // this.renderer.dispose() // It executs of parent component

    this.disposables.forEach((d) => d.deref()?.dispose())
    this.disposables = []

    this.scene.children.forEach((c) => c.removeFromParent())
  }

  public createRenderTarget(
    width: number,
    height: number,
  ): PapThreeRenderTarget {
    const renderTarget = new WebGLRenderTarget(width, height, {
      generateMipmaps: false,
    })

    this.disposables.push(new WeakRef(renderTarget))

    return {
      [__papRenderTargetMark]: true,
      renderTarget,
    }
  }

  public createProgram(
    frag: string,
    vert: string = DEFAULT_VERTEX_SHADER,
  ): PapThreeFilterProgram {
    const program = new RawShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
    })

    this.disposables.push(new WeakRef(program))

    return {
      [__paplicoFilterProgram]: true,
      program,
    }
  }

  public createTexture(
    tex: TexImageSource,
    {
      clamp = 'clampToEdge',
      filter = 'linear',
    }: {
      clamp?: WebGLTypes.TextureClamp
      filter?: WebGLTypes.TextureFilter
    } = {},
  ): TexUniform {
    return {
      type: 'texture2d',
      value: tex,
      clamp,
      filter,
      toNativeUniform: () => {
        const texUni = new CanvasTexture(
          tex,
          undefined,
          getTextureClampValue(clamp, 'x'),
          getTextureClampValue(clamp, 'y'),
          getTextureFilterValue(filter, 'mag'),
          getTextureFilterValue(filter, 'min'),
        )

        this.disposables.push(new WeakRef(texUni))

        return { value: texUni }
      },
    }
  }

  public uni(
    type: Omit<PapUniforms['type'], 'texture2d'>,
    values: number[] | Float32Array,
  ): PapUniforms {
    return {
      type: type as any,
      value: values,
      toNativeUniform: () => ({ value: values }),
    }
  }

  public apply(
    program: PapFilterProgram,
    uniforms: Record<string, PapUniforms>,
    input: InputSource,
    output: OutputTarget,
  ) {
    const originalUniforms = { ...program.program.uniforms }

    try {
      let inputInstance!: TexImageSource | WebGLRenderTarget
      let outputInstance!:
        | HTMLCanvasElement
        | OffscreenCanvas
        | WebGLRenderTarget

      if (__papRenderTargetMark in input) {
        inputInstance = input.renderTarget
      } else {
        inputInstance = input
      }

      const convertedUniforms = Object.entries(uniforms).reduce(
        (acc, [key, value]) => {
          acc[key] = value.toNativeUniform()
          return acc
        },
        {} as Record<string, IUniform>,
      )

      Object.assign(program.program.uniforms, convertedUniforms)
      convertedUniforms.uTexture = { value: inputInstance }

      const mesh = new Mesh(this.geometry, program.program)

      this.scene.add(mesh)
      this.renderer.setSize(outputInstance.width, outputInstance.height)

      if (__papRenderTargetMark in output) {
        this.renderer.setRenderTarget(output.renderTarget)
        this.renderer.render(this.scene, this.camera)
        this.renderer.setRenderTarget(null)
      } else {
        this.renderer.render(this.scene, this.camera)
        output.drawImage(this.renderer.domElement, 0, 0)
      }
    } finally {
      this.scene.children.forEach((c) => c.removeFromParent())
      program.program.uniforms = originalUniforms
    }
  }
}

const getTextureClampValue = (
  value: WebGLTypes.TextureClamp,
  xy: 'x' | 'y',
): Wrapping | undefined => {
  if (typeof value === 'string') {
    return (
      // prettier-ignore
      value === 'clampToEdge' ? ClampToEdgeWrapping
      : value === 'mirroredRepeat' ? MirroredRepeatWrapping
      : value === 'repeat' ? RepeatWrapping
      : undefined as never
    )
  } else {
    let dir = xy === 'x' ? value.x : value.y
    return getTextureClampValue(dir, xy)
  }
}

const getTextureFilterValue = (
  value: WebGLTypes.TextureFilter | undefined,
  minmag: 'min' | 'mag',
): TextureFilter | undefined => {
  if (typeof value === 'string') {
    // prettier-ignore
    return (
      value === 'linear' ? LinearFilter
      : value === 'nearest' ? NearestFilter
      : undefined
    )
  } else if (value != undefined) {
    let val = minmag === 'min' ? value.min : value.mag
    return getTextureFilterValue(val, minmag)
  }

  return undefined
}

const DEFAULT_VERTEX_SHADER = `
precision mediump float;

attribute vec2 aPosition;
attribute vec2 aCoord;

varying vec2 vUv;
varying vec2 vTexCoord;

void main(void) {
    vUv = aCoord;
    vTexCoord = aCoord;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`
