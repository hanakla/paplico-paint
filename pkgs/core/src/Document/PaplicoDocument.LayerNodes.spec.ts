import { PPLCOptionInvariantViolationError } from '@/Errors'
import { fakeVisu, mockDocument, mockNode } from '@/spec-lib/fakeVisu'
import { rescue } from '@/utils/rescue'

describe('Document.LayerNodes', () => {
  describe('moveNodeOrder', () => {
    it.only('Should not move to non-containable node', () => {
      const doc = mockDocument(
        [mockNode('canvas-1'), mockNode('canvas-2')],
        [fakeVisu('canvas', 'canvas-1'), fakeVisu('canvas', 'canvas-2')],
      )

      const result = rescue(() => {
        doc.layerNodes.moveLayerNodeOver(['canvas-1'], ['canvas-2', 'PLACE_IT'])
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(PPLCOptionInvariantViolationError)
    })

    it('Should move node order between siblings', () => {
      const doc = mockDocument([mockNode('group-1'), mockNode('group-2')])

      doc.layerNodes.moveLayerNodeOver(['group-1'], ['group-2'])

      expect(doc.layerTreeRoot.children).toEqual([
        {
          visuUid: 'group-2',
          children: [],
        },
        {
          visuUid: 'group-1',
          children: [],
        },
      ])
    })

    it('Should move node with children', () => {
      const doc = mockDocument([
        mockNode('group-1', [mockNode('canvas-1')]),
        mockNode('group-2'),
      ])

      doc.layerNodes.moveLayerNodeOver(['group-1'], ['group-2', 'PLACE_IT'])

      expect(doc.layerTreeRoot.children).toEqual([
        {
          visuUid: 'group-2',
          children: [
            {
              visuUid: 'group-1',
              children: [{ visuUid: 'canvas-1', children: [] }],
            },
          ],
        },
      ])
    })

    it('Should move node between group to empty group with PLACE_IT mark', () => {
      const doc = mockDocument([
        mockNode('group-1', [mockNode('canvas-1')]),
        mockNode('group-2'),
      ])

      doc.layerNodes.moveLayerNodeOver(
        ['group-1', 'canvas-1'],
        ['group-2', 'PLACE_IT'],
      )

      expect(doc.layerTreeRoot.children).toEqual([
        {
          visuUid: 'group-1',
          children: [],
        },
        {
          visuUid: 'group-2',
          children: [{ visuUid: 'canvas-1', children: [] }],
        },
      ])
    })
  })
})
