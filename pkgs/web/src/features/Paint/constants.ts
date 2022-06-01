import { PapBrushes } from '@paplico/core'
import { nanoid } from 'nanoid'

export const BRUSH_PRESETS = [
  {
    id: nanoid(),
    nameKey: 'vector',
    brushId: PapBrushes.Brush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'circle',
      inOutInfluence: 0,
      randomRotation: 0,
      randomScale: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'circle',
    brushId: PapBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'circle',
      inOutInfluence: 0,
      randomRotation: 0,
      randomScale: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'fade',
    brushId: PapBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'fadeBrush',
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 0.2,
      scatterRange: 0,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'pencil',
    brushId: PapBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'pencil',
      inOutInfluence: 1,
      randomRotation: 1,
      randomScale: 0,
      scatterRange: 0.5,
      pressureInfluence: 0.5,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'sparkle',
    brushId: PapBrushes.ScatterBrush.id,
    size: 100,
    opacity: 1,
    specific: {
      texture: 'sparkle',
      divisions: 5,
      rotationAdjust: 0,
      inOutInfluence: 2,
      randomRotation: 0,
      randomScale: 0.2,
      scatterRange: 0,
      pressureInfluence: 0,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'pencil-enterexit',
    brushId: PapBrushes.ScatterBrush.id,
    size: 20,
    opacity: 1,
    specific: {
      texture: 'pencil',
      inOutInfluence: 1,
      randomRotation: 1,
      randomScale: 0,
      scatterRange: 1,
      pressureInfluence: 0.5,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'baribari',
    brushId: PapBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'baribari',
      inOutInfluence: 0,
      randomRotation: 0,
      randomScale: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  },
]
