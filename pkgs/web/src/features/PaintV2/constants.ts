import { ExtraBrushes, StandardBrushes } from '@paplico/core-new'
import { nanoid } from 'nanoid'


export const BRUSH_PRESETS = [
  {
    id: nanoid(),
    nameKey: 'circle',
    brushId: StandardBrushes.CircleBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'circle',
      inOutInfluence: 0,
      randomRotation: 0,
      randomScale: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<StandardBrushes.CircleBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'scatter',
    brushId: ExtraBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'pencil',
      // inOutInfluence: 0,
      // randomRotation: 0,
      // randomScale: 0,
      // scatterRange: 0,
      // pressureInfluence: 0.5,
    } satisfies Partial<ExtraBrushes.ScatterBrush.SpecificSetting>,
  },
  // {
  //   id: nanoid(),
  //   nameKey: 'circle',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 0.8,
  //   specific: {
  //     texture: 'circle',
  //     inOutInfluence: 0,
  //     randomRotation: 0,
  //     randomScale: 0,
  //     scatterRange: 0,
  //     pressureInfluence: 0.5,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'fade',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 0.8,
  //   specific: {
  //     texture: 'fadeBrush',
  //     randomRotation: 0,
  //     randomScale: 0,
  //     inOutInfluence: 0.2,
  //     scatterRange: 0,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'pencil',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 0.8,
  //   specific: {
  //     texture: 'pencil',
  //     inOutInfluence: 1,
  //     randomRotation: 1,
  //     randomScale: 0,
  //     scatterRange: 0.5,
  //     pressureInfluence: 0.5,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'sparkle',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 100,
  //   opacity: 1,
  //   specific: {
  //     texture: 'sparkle',
  //     divisions: 5,
  //     rotationAdjust: 0,
  //     inOutInfluence: 2,
  //     randomRotation: 0,
  //     randomScale: 0.2,
  //     scatterRange: 0,
  //     pressureInfluence: 0,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'pencil-enterexit',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 1,
  //   specific: {
  //     texture: 'pencil',
  //     inOutInfluence: 1,
  //     randomRotation: 1,
  //     randomScale: 0,
  //     scatterRange: 1,
  //     pressureInfluence: 0.5,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'baribari',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 0.8,
  //   specific: {
  //     texture: 'baribari',
  //     inOutInfluence: 0,
  //     randomRotation: 0,
  //     randomScale: 0,
  //     scatterRange: 0,
  //     pressureInfluence: 0.5,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
  // {
  //   id: nanoid(),
  //   nameKey: 'noise',
  //   brushId: PapBrushes.ScatterBrush.id,
  //   size: 20,
  //   opacity: 1,
  //   specific: {
  //     texture: 'noise',
  //     inOutInfluence: 1,
  //     randomRotation: 1,
  //     randomScale: 0,
  //     scatterRange: 1,
  //     pressureInfluence: 0.5,
  //     noiseInfluence: 0.5,
  //   } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
  // },
]

export const FILTER_CATEGORIES = [
  // {
  //   category: 'filterCategory.blur',
  //   items: [
  //     PapFilters.BloomFilter.id,
  //     PapFilters.KawaseBlurFilter.id,
  //     PapFilters.ZoomBlurFilter.id,
  //     PapFilters.TiltShiftFilter.id,
  //   ],
  // },
  // {
  //   category: 'filterCategory.distortion',
  //   items: [
  //     PapFilters.LowResoFilter.id,
  //     PapFilters.BinarizationFilter.id,
  //     PapFilters.UVReplaceFilter.id,
  //     PapFilters.GlitchJpegFilter.id,
  //   ],
  // },
  // {
  //   category: 'filterCategory.coloring',
  //   items: [
  //     PapFilters.HalftoneFilter.id,
  //     PapFilters.GradientMapFilter.id,
  //     PapFilters.ChromaticAberrationFilter.id,
  //     PapFilters.PosterizationFilter.id,
  //   ],
  // },
  // {
  //   category: 'filterCategory.etc',
  //   items: [PapFilters.OutlineFilter.id, PapFilters.NoiseFilter.id],
  // },
]
