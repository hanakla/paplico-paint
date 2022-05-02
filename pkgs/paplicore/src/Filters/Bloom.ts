import { setCanvasSize } from '../utils'
import { FilterContext, IFilter } from '../engine/IFilter'
import { createContext2D } from '../Engine3_CanvasFactory'

const SAMPLE_COUNT = 40

const FRAGMENT_SHADER_1 = `
precision mediump float;

uniform sampler2D source;
uniform float minBright;

varying vec2 vTexCoord;

void main() {
    vec3 texel = max(vec3(0.0), (texture2D(source, vTexCoord) - minBright).rgb);
    gl_FragColor = vec4(texel, texture2D(source, vTexCoord).a);
}
`

const FRAGMENT_SHADER_2 = `
precision mediump float;

uniform sampler2D source;

#define SAMPLE_COUNT ${SAMPLE_COUNT}
uniform vec2 offsetsH[SAMPLE_COUNT];
uniform float weightsH[SAMPLE_COUNT];
uniform vec2 offsetsV[SAMPLE_COUNT];
uniform float weightsV[SAMPLE_COUNT];

uniform bool isVertical;

varying vec2 vTexCoord;

void main() {
    vec4 color = vec4(0.0);
    if (isVertical) {
        for (int i = 0; i < SAMPLE_COUNT; i++) {
            color += texture2D(source, vTexCoord + offsetsV[i]) * weightsV[i];
        }
    }
    else {
        for (int i = 0; i < SAMPLE_COUNT; i++) {
            color += texture2D(source, vTexCoord + offsetsH[i]) * weightsH[i];
        }
    }
    gl_FragColor = vec4(color.rgb, 1.0);
}
`

const FRAGMENT_SHADER_ADD = `
precision mediump float;

uniform sampler2D originalTexture;
uniform sampler2D bloomTexture;
uniform float toneScale;

varying vec2 vTexCoord;

void main() {
    vec4 texel = vec4(0.0);
    texel = texture2D(originalTexture, vTexCoord) * toneScale;
    texel += texture2D(bloomTexture, vTexCoord);
    gl_FragColor = vec4(texel.rgb, texture2D(originalTexture, vTexCoord).a);
}
`

export class BloomFilter implements IFilter {
  public static readonly id = '@paplico/filters/bloom'

  public get id() {
    return BloomFilter.id
  }

  public get initialConfig() {
    return {}
  }

  public async initialize() {}

  public async render({ source, dest, gl, size }: FilterContext) {
    const program1 = gl.createProgram(FRAGMENT_SHADER_1)
    const program2 = gl.createProgram(FRAGMENT_SHADER_2)
    const program3 = gl.createProgram(FRAGMENT_SHADER_ADD)

    const buffer = createContext2D()
    setCanvasSize(buffer.canvas, size)

    let offsetH = new Array(SAMPLE_COUNT)
    let weightH = new Array(SAMPLE_COUNT)
    {
      var offsetTmp = new Array(SAMPLE_COUNT)
      var total = 0

      for (var i = 0; i < SAMPLE_COUNT; i++) {
        var p = (i - (SAMPLE_COUNT - 1) * 0.5) * 0.0006
        offsetTmp[i] = p
        weightH[i] = Math.exp((-p * p) / 2) / Math.sqrt(Math.PI * 2)
        total += weightH[i]
      }
      for (var i = 0; i < SAMPLE_COUNT; i++) {
        weightH[i] /= total
      }
      var tmp = []
      for (var key in offsetTmp) {
        tmp.push(offsetTmp[key], 0)
      }
      offsetH = tmp
    }

    // var offsetV = new Array(SAMPLE_COUNT)
    let weightV = new Array(SAMPLE_COUNT)
    let offsetV = new Array(SAMPLE_COUNT)
    {
      var offsetTmp = new Array(SAMPLE_COUNT)
      var total = 0

      for (var i = 0; i < SAMPLE_COUNT; i++) {
        var p = (i - (SAMPLE_COUNT - 1) * 0.5) * 0.0006
        offsetTmp[i] = p
        weightV[i] = Math.exp((-p * p) / 2) / Math.sqrt(Math.PI * 2)
        total += weightV[i]
      }
      for (var i = 0; i < SAMPLE_COUNT; i++) {
        weightV[i] /= total
      }
      var tmp = []
      for (var key in offsetTmp) {
        tmp.push(0, offsetTmp[key])
      }
      offsetV = tmp
    }

    gl.applyProgram(
      program1,
      { minBright: gl.uni1f(0.5) },
      source,
      buffer.canvas
    )
    gl.applyProgram(
      program2,
      {
        isVertical: gl.uni1f(1),
        offsetsV: gl.uni2fv(offsetV),
        weightsV: gl.uni1fv(weightV),
      },
      buffer.canvas,
      buffer.canvas
    )

    gl.applyProgram(
      program2,
      {
        isVertical: gl.uni1f(0),
        offsetsH: gl.uni2fv(offsetH),
        weightsH: gl.uni1fv(weightH),
      },
      buffer.canvas,
      buffer.canvas
    )
    gl.applyProgram(
      program3,
      {
        originalTexture: gl.uniTexture2D(source),
        bloomTexture: gl.uniTexture2D(buffer.canvas),
        toneScale: gl.uni1f(1),
      },
      buffer.canvas,
      dest
    )
  }
}
