import type { BorderValue, StatKind } from './daniSet'

export interface ConditionPreset {
  name: string
  gauge: BorderValue
  statKinds: StatKind[]
}

function common(good: BorderValue, miss: BorderValue): StatKind[] {
  return [
    { label: 'Good', continuous: true, cumulativeBorder: good },
    { label: 'Miss', continuous: true, cumulativeBorder: miss }
  ]
}

/** Named board (stat kind) configurations the user can apply to a rank in
 * one click. All conditions here are 可の数(Good)/不可の数(Miss) only,
 * with the soul gauge fixed at 100% for both red and gold. */
export const CONDITION_PRESETS: readonly ConditionPreset[] = [
  {
    name: '十段(個別)',
    gauge: { red: 100, gold: 100 },
    statKinds: [
      {
        label: 'Good',
        continuous: false,
        perSongBorders: [
          { red: 20, gold: 15 },
          { red: 25, gold: 20 },
          { red: 30, gold: 25 }
        ]
      },
      { label: 'Miss', continuous: true, cumulativeBorder: { red: 7, gold: 4 } }
    ]
  },
  {
    name: '十段(共通)',
    gauge: { red: 100, gold: 100 },
    statKinds: common({ red: 75, gold: 50 }, { red: 7, gold: 4 })
  },
  {
    name: '玄人',
    gauge: { red: 100, gold: 100 },
    statKinds: common({ red: 50, gold: 35 }, { red: 6, gold: 3 })
  },
  {
    name: '名人',
    gauge: { red: 100, gold: 100 },
    statKinds: common({ red: 30, gold: 20 }, { red: 5, gold: 3 })
  },
  {
    name: '超人',
    gauge: { red: 100, gold: 100 },
    statKinds: common({ red: 15, gold: 6 }, { red: 4, gold: 2 })
  },
  {
    name: '達人',
    gauge: { red: 100, gold: 100 },
    statKinds: common({ red: 8, gold: 1 }, { red: 3, gold: 1 })
  }
]
