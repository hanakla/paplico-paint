import {
  LayerEntity,
  VectorFillSetting,
  createDocument,
  createFilterEntry,
  createRasterLayerEntity,
  createVectorAppearance,
  createVectorLayerEntity,
  createVectorObject,
  createVectorPath,
} from '@/Document'
import { RenderCommands, RenderTargets, buildRenderSchedule } from './Scheduler'
import { DocumentContext } from '.'
import { VectorAppearanceFill } from '@/Document/LayerEntity/VectorAppearance'
import { ulid } from '@/utils/ulid'

describe('Scheduler', () => {
  it('Should straight outputs when no filters', () => {
    const [doc, docCx] = documentFactory([
      createRasterLayerEntity({ width: 1, height: 1 }),
      createVectorLayerEntity({}),
    ])
    const s = buildRenderSchedule(doc.layerTreeRoot, docCx).tasks

    expect(s).toMatchObject([
      {
        command: RenderCommands.CLEAR_TARGET,
        renderTarget: RenderTargets.PREDEST,
      },
      {
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        renderTarget: RenderTargets.PREDEST,
      },
    ])

    // Must finish with 2 commands
    expect(s).toHaveLength(2)
  })

  it('Should direct outputs to PREDIST when all objects are normal compositeMode', () => {
    const [doc, docCx] = documentFactory([
      createVectorLayerEntity({
        blendMode: 'normal',
        objects: [
          createVectorObject({
            blendMode: 'normal',
            path: createVectorPath({}),
          }),
        ],
      }),
      createVectorLayerEntity({
        blendMode: 'normal',
        objects: [
          createVectorObject({
            blendMode: 'normal',
            path: createVectorPath({}),
          }),
        ],
      }),
    ])
    const s = buildRenderSchedule(doc.layerTreeRoot, docCx).tasks

    expect(s.every((t) => t.renderTarget == RenderTargets.PREDEST)).toBe(true)
  })

  it('Should use VectorAccum when any object has filter', () => {
    const [doc, docCx] = documentFactory([
      createVectorLayerEntity({
        blendMode: 'normal',
        objects: [
          createVectorObject({
            blendMode: 'normal',
            path: createVectorPath({}),
            filters: [
              // s[0]
              vectorFill(),
            ],
          }),
        ],
      }),
      createVectorLayerEntity({
        blendMode: 'normal',
        objects: [
          createVectorObject({
            name: 'has filter',
            blendMode: 'normal',
            path: createVectorPath({}),
            filters: [
              // s[1-2]: this layer can not to direct output (for having external filter),
              // it emits clear and fill command
              vectorFill(),
              // s[2-3]
              createVectorAppearance({
                kind: 'external',
                enabled: true,
                processor: {
                  opacity: 1,
                  filterId: 'test',
                  filterVersion: '1',
                  settings: {},
                },
              }),
              // s[4]
              vectorFill(),
            ],
          }),
        ],
      }),
    ])

    const s = buildRenderSchedule(doc.layerTreeRoot, docCx).tasks
    let i = 0

    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.PREDEST,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.PREDEST,
    })

    // emits clear by external filter
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // let emits internal `fill` filter
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // applying external filter `test`
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER,
      source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
      renderTarget: RenderTargets.SHARED_FILTER_BUF,
    })

    // draw back result of external filter to FILTER_BUF for next filter
    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.SHARED_FILTER_BUF,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // Ending of external filter, next filter `fill` emits
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // Ending all layers, draw to PREDEST
    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })
  })

  it('has multiply composition layer', () => {
    const [doc, docCx] = documentFactory([
      createVectorLayerEntity({
        blendMode: 'multiply',
        objects: [
          createVectorObject({
            blendMode: 'normal',
            path: createVectorPath({}),
            filters: [vectorFill()],
          }),
        ],
      }),
    ])

    const s = buildRenderSchedule(doc.layerTreeRoot, docCx).tasks

    let i = 0

    // console.log(s)
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.PREDEST,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
      renderTarget: RenderTargets.LAYER_PRE_FILTER,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.LAYER_PRE_FILTER,
      renderTarget: RenderTargets.PREDEST,
      blendMode: 'multiply',
    })
  })

  it.only('Layer filters', () => {
    const [doc, docCx] = documentFactory([
      createVectorLayerEntity({
        blendMode: 'normal',
        objects: [
          createVectorObject({
            blendMode: 'normal',
            path: createVectorPath({}),
            filters: [
              vectorFill(),
              createVectorAppearance({
                kind: 'external',
                processor: {
                  filterId: 'test',
                  filterVersion: '1',
                  opacity: 1,
                  settings: {},
                },
              }),
            ],
          }),
        ],
        filters: [
          createFilterEntry({
            enabled: true,
            filterId: 'test',
            filterVersion: '1',
            settings: {},
            opacity: 1,
          }),
        ],
      }),
    ])
    const s = buildRenderSchedule(doc.layerTreeRoot, docCx).tasks
    let i = 0

    process.env.NODE_ENV !== 'test' && console.log(s)

    // Clearing PREDEST
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.PREDEST,
    })

    // Layer has layer filter, first emits clear
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // next, draw intaernal filter `fill`
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // next, draw external filter `test`
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER,
      renderTarget: RenderTargets.SHARED_FILTER_BUF,
    })

    // next, draw back result of external filter to FILTER_BUF for next filter
    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.SHARED_FILTER_BUF,
      renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
    })

    // next, finishing external filter, drawback to PRE_FILTER
    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
      renderTarget: RenderTargets.LAYER_PRE_FILTER,
    })

    // next, applying layer filter, first emits clear
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.SHARED_FILTER_BUF,
    })

    // apply layer filter
    expect(s[i++]).toMatchObject({
      command: RenderCommands.APPLY_LAYER_FILTER,
      source: RenderTargets.LAYER_PRE_FILTER,
      renderTarget: RenderTargets.SHARED_FILTER_BUF,
    })

    // swapping draw buffers
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.LAYER_PRE_FILTER,
    })

    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.SHARED_FILTER_BUF,
      renderTarget: RenderTargets.LAYER_PRE_FILTER,
    })

    // last! composite results into PREDEST
    expect(s[i++]).toMatchObject({
      command: RenderCommands.DRAW_SOURCE_TO_DEST,
      source: RenderTargets.LAYER_PRE_FILTER,
      renderTarget: RenderTargets.PREDEST,
    })

    // cleaning SHARED_FILTER_BUF
    expect(s[i++]).toMatchObject({
      command: RenderCommands.CLEAR_TARGET,
      renderTarget: RenderTargets.SHARED_FILTER_BUF,
    })

    expect(s).toHaveLength(12)
  })
})

function documentFactory(layers: LayerEntity[]) {
  const doc = createDocument({ width: 1, height: 1 })
  layers.forEach((layer) => doc.addLayerNode(layer))
  return [doc, new DocumentContext(doc)] as const
}

function vectorFill(): VectorAppearanceFill {
  return {
    uid: ulid(),
    kind: 'fill',
    enabled: true,
    fill: {
      type: 'fill',
      color: { r: 1, g: 1, b: 1 },
      opacity: 1,
    },
  }
}
