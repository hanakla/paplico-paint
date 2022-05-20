import { logImage } from '../DebugHelper'
import { FilterContext, IFilter } from '../engine/IFilter'
import { WebGLContext } from '../engine/WebGLContext'
import { createContext2D } from '../Engine3_CanvasFactory'
import { setCanvasSize } from '../utils'
import { ColorStop1D } from '../Value/ColorStop1D'

export declare namespace GradientMapFilter {
  export type Params = {
    map: ColorStop1D[]
    mixRatio: number
  }
}

export class GradientMapFilter implements IFilter {
  public static readonly id = '@paplico/filters/gradient-map'

  public get id() {
    return GradientMapFilter.id
  }

  public get initialConfig(): GradientMapFilter.Params {
    return {
      map: [
        { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
        // { color: { r: 0.2, g: 0.9, b: 0.8, a: 1 }, position: 0.5 },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
      ],
      mixRatio: 1,
    }
  }

  private gradientCanvas!: CanvasRenderingContext2D
  private program: WebGLContext.ProgramSet | null = null

  public async initialize({ gl }: { gl: WebGLContext }) {
    this.gradientCanvas = createContext2D()
    setCanvasSize(this.gradientCanvas.canvas, { width: 256, height: 1 })

    this.program = gl.createProgram(FRAGMENT_SHADER)
  }

  public async render({
    source,
    dest,
    gl,
    size,
    settings,
  }: FilterContext<GradientMapFilter.Params>) {
    settings = {
      ...this.initialConfig,
      ...settings,
    }

    const gradCtx = this.gradientCanvas

    const gradient = gradCtx.createLinearGradient(0, 0, 256, 0)

    settings.map.forEach((stop) => {
      const color = `rgba(${stop.color.r * 255}, ${stop.color.g * 255}, ${
        stop.color.b * 255
      }, 1)`

      gradient.addColorStop(stop.position, color)
    })

    gradCtx.fillStyle = gradient
    gradCtx.fillRect(0, 0, 256, 2)

    gl.applyProgram(
      this.program!,
      {
        uMap: gl.uniTexture2D(gradCtx.canvas),
        uMix: gl.uni1f(settings.mixRatio),
      },
      source,
      dest
      // { clear: true }
    )

    await logImage(source, 'source')
    await logImage(dest, 'dest')
  }
}

// From: https://wgld.org/d/glsl/g007.html
const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D source;
  uniform sampler2D uMap;
  uniform float uMix;

  const float redScale   = 0.298912;
  const float greenScale = 0.586611;
  const float blueScale  = 0.114478;
  const vec3 monochromeScale = vec3(redScale, greenScale, blueScale);

  void main() {
    vec4 sourceColor = texture2D(source, vUv);
    float grayColor = dot(sourceColor.rgb, monochromeScale);

    vec4 mappedColor = texture2D(uMap, vec2(grayColor, 0.0));
    gl_FragColor = vec4(grayColor, grayColor, grayColor, 0.0);
    // gl_FragColor = mappedColor;
    // gl_FragColor = vec4(mappedColor.rgb, sourceColor.a);
    // gl_FragColor = vec4(mix(sourceColor.rgb, mappedColor.rgb, uMix).rgb, sourceColor.a);
    // gl_FragColor = sourceColor;
  }
`
