export interface RawBorderValue {
  red: number
  gold: number
}

export interface RawThemeBorder {
  values: RawBorderValue[]
}

export interface RawThemeGauge {
  red: number
  gold: number
}

export interface RawDaniJson {
  title: string
  tja_Path: string[]
  tja_Diff: number[]
  tja_Genre: string[]
  tja_Hidden: boolean[]
  theme_Genre: string[]
  theme_Continuous: boolean[]
  theme_Gauge: RawThemeGauge
  theme_Borders: RawThemeBorder[]
}
