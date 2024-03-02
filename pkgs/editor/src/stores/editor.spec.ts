import { Document } from '@paplico/core-new'
import {
  editablePathFormToVectorPath,
  vectorPathPointsToEditablePathForm,
} from './editor'

describe('editor', () => {
  describe('editablePathFormToVectorPath', () => {
    it('with closed path', () => {
      const result = vectorPathPointsToEditablePathForm([
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
        { isClose: true },
      ])

      expect(result[0]).toMatchObject({
        isMoveTo: true,
        x: 0,
        y: 0,
        nextBegin: { x: 20, y: 20 },
        // Expect to ignore previous isClose point
        currentEnd: { x: 40, y: 40 },
        pathBeginnerIdx: 0,
      })

      expect(result[1]).toMatchObject({
        x: 1,
        y: 1,
        nextBegin: { x: 30, y: 30 },
        currentEnd: { x: 30, y: 30 },
        pathBeginnerIdx: 0,
      })

      expect(result[2]).toMatchObject({
        x: 1,
        y: 1,
        // Begin point of [1] in source
        nextBegin: { x: 30, y: 30 },
        currentEnd: { x: 40, y: 40 },
        pathBeginnerIdx: 0,
      })
    })

    it('with complexed path', () => {
      const result = vectorPathPointsToEditablePathForm([
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
        { isClose: true },

        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
        { isClose: true },
      ])

      expect(result[0]).toMatchObject({
        isMoveTo: true,
        x: 0,
        y: 0,
        nextBegin: { x: 20, y: 20 },
        // Expect to ignore previous isClose point
        currentEnd: { x: 40, y: 40 },
        pathBeginnerIdx: 0,
      })

      expect(result[1]).toMatchObject({
        x: 1,
        y: 1,
        nextBegin: { x: 30, y: 30 },
        currentEnd: { x: 30, y: 30 },
        pathBeginnerIdx: 0,
      })
    })

    it('with open path', () => {
      const result = vectorPathPointsToEditablePathForm([
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
      ])

      expect(result[0]).toMatchObject({
        isMoveTo: true,
        x: 0,
        y: 0,
        nextBegin: { x: 20, y: 20 },
        currentEnd: { x: 40, y: 40 },
      })

      expect(result[1]).toMatchObject({
        x: 1,
        y: 1,
        nextBegin: { x: 30, y: 30 },
        currentEnd: { x: 30, y: 30 },
      })
    })
  })

  describe('vectorPathPointsToEditablePathForm', () => {
    it('with closed path', () => {
      const source: Document.VisuElement.VectorPathPointStrict[] = [
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
        { isClose: true },
      ]

      const editable = vectorPathPointsToEditablePathForm(source)

      const result = editablePathFormToVectorPath(editable)

      expect(result[0]).toMatchObject(source[0])
      expect(result[1]).toMatchObject(source[1])
      expect(result[2]).toMatchObject(source[2])
      expect(result[3]).toMatchObject(source[3])
    })

    it('with open path', () => {
      const source: Document.VisuElement.VectorPathPointStrict[] = [
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1, y: 1, begin: { x: 20, y: 20 }, end: { x: 30, y: 30 } },
        { x: 1, y: 1, begin: { x: 30, y: 30 }, end: { x: 40, y: 40 } },
      ]

      const editable = vectorPathPointsToEditablePathForm(source)

      const result = editablePathFormToVectorPath(editable)

      expect(result[0]).toMatchObject(source[0])
      expect(result[1]).toMatchObject(source[1])
      expect(result[2]).toMatchObject(source[2])
    })
  })
})
