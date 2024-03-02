import { Paplico } from '../Engine/Paplico'

export type LocaleStrings<
  T extends Record<string, any> = Record<string, string>,
> = {
  [K in Paplico.SupportedLocales]: T
}

const tx = <T extends Record<string, any>>(texts: LocaleStrings<T>) => texts

export const scatterBrushTexts = tx({
  en: {
    texture: 'Texture',
    texturePlaceholder: 'Select texture',
    scatter: 'Scatter',
    inOut: 'Strength of In / Out',
    inOutLength: 'Length of In / Out ',
    pressureInfluence: 'Pressure Influence',
  },
  ja: {
    texture: 'テクスチャ',
    texturePlaceholder: 'テクスチャを選ぶ',
    scatter: '散布の広さ',
    inOut: '入り抜きの強さ',
    inOutLength: '入り抜きの長さ',
    pressureInfluence: '筆圧の影響度',
  },
})
