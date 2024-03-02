import { PaneUI } from '@paplico/core-new'
import { Fragment } from 'react'
import { TextInput } from './TextInput'
import { View } from './View'
import { Text } from './Text'
import { Button } from './Button'
import { BrowserDOM } from './BrowserDOM'
import { Slider } from './Slider'
import { FieldSet } from './FieldSet'
import { SelectBox } from './SelectBox'

export const PaneUIImpls: PaneUI.PaplicoComponents = {
  Fragment: Fragment as PaneUI.PaplicoComponents['Fragment'],
  View: View as PaneUI.PaplicoComponents['View'],
  Text: Text as PaneUI.PaplicoComponents['Text'],
  FieldSet: FieldSet as PaneUI.PaplicoComponents['FieldSet'],
  SelectBox: SelectBox as PaneUI.PaplicoComponents['SelectBox'],
  TextInput: TextInput as PaneUI.PaplicoComponents['TextInput'],
  Button: Button as PaneUI.PaplicoComponents['Button'],
  Slider: Slider as PaneUI.PaplicoComponents['Slider'],
  BrowserDOM: BrowserDOM as PaneUI.PaplicoComponents['BrowserDOM'],
}
