import { expect, test } from 'claude-code/testing'

import { buttonsFor, mergeCatalogs, normalizeCatalog, type CatalogEntry } from './register'

const JSON_CATALOG = [
  { id: 'da', title: 'yes', titles: { ru: 'да' } },
  { id: 'commit', title: 'commit', titles: { ru: 'коммить' } },
  {
    id: 'hint',
    title: 'Hint',
    titles: { ru: 'Подсказка' },
    texts: { ru: 'Покажи подсказку', en: 'Show the hint' },
  },
]

const SETTINGS: CatalogEntry = {
  id: 'settings',
  kind: 'pane',
  title: 'settings',
  titles: { ru: '⚙', en: '⚙' },
}

test('normalizeCatalog keeps valid entries and drops broken ones', () => {
  const cat = normalizeCatalog([
    { id: 'da', title: 'yes' },
    { title: 'no id' },
    { id: 'no-title' },
    'garbage',
    null,
    { id: 'x', title: 'X', titles: { ru: 'икс' }, texts: { ru: 'икс!' } },
  ])
  expect(cat.map(b => b.id)).toEqual(['da', 'x'])
  expect(cat[1]).toEqual({
    id: 'x',
    kind: 'prompt',
    title: 'X',
    titles: { ru: 'икс' },
    text: undefined,
    texts: { ru: 'икс!' },
    command: undefined,
  })
})

test('buttonsFor resolves labels and submit per language: texts → text → label', () => {
  const cat = normalizeCatalog(JSON_CATALOG)
  expect(buttonsFor(cat, 'ru', {})).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'да' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
    { id: 'hint', kind: 'prompt', label: 'Подсказка', submit: 'Покажи подсказку' },
  ])
  expect(buttonsFor(cat, 'en', {})).toEqual([
    { id: 'da', kind: 'prompt', label: 'yes', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'commit', submit: 'commit' },
    { id: 'hint', kind: 'prompt', label: 'Hint', submit: 'Show the hint' },
  ])
})

test('buttonsFor: per-language texts win over single text; command wins over both', () => {
  const cat = normalizeCatalog([
    { id: 'a', title: 'A', texts: { ru: 'по-русски' }, text: 'fixed' },
    { id: 'b', title: 'B', text: 'fixed', command: 'ctx' },
  ])
  expect(buttonsFor(cat, 'ru', {}).map(b => b.submit)).toEqual(['по-русски', '/ctx'])
  expect(buttonsFor(cat, 'en', {}).map(b => b.submit)).toEqual(['fixed', '/ctx'])
})

test('buttonsFor: unknown language falls back to title and text', () => {
  const cat = normalizeCatalog(JSON_CATALOG)
  expect(buttonsFor(cat, 'de', {})[2]).toEqual({
    id: 'hint',
    kind: 'prompt',
    label: 'Hint',
    submit: 'Hint',
  })
})

test('buttonsFor honours show toggles; hidden entries are filtered by the caller', () => {
  const cat = normalizeCatalog(JSON_CATALOG).concat([SETTINGS])
  expect(buttonsFor(cat, 'ru', { settings: false })).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'да' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
    { id: 'hint', kind: 'prompt', label: 'Подсказка', submit: 'Покажи подсказку' },
  ])
  // Buttons hidden via $.store are filtered by the caller before buttonsFor:
  expect(buttonsFor(cat.filter(b => b.id !== 'settings'), 'ru', {}).map(b => b.id)).toEqual([
    'da',
    'commit',
    'hint',
  ])
})

test('mergeCatalogs: the topmost non-empty layer defines the order', () => {
  const base = normalizeCatalog([
    { id: 'da', title: 'yes' },
    { id: 'commit', title: 'commit' },
  ])
  const global = normalizeCatalog([
    { id: 'commit', title: 'commit!', titles: { ru: 'коммит!' } },
    { id: 'review', title: 'Review' },
  ])
  const merged = mergeCatalogs([base, global])
  expect(merged.map(b => [b.id, b.title])).toEqual([
    ['commit', 'commit!'],
    ['review', 'Review'],
    ['da', 'yes'],
  ])
  expect(merged[0]?.titles).toEqual({ ru: 'коммит!' })
})

test('mergeCatalogs: a layer can reorder existing buttons', () => {
  const base = normalizeCatalog([
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ])
  const reordered = normalizeCatalog([
    { id: 'b', title: 'B!' },
    { id: 'a', title: 'A!' },
  ])
  expect(mergeCatalogs([base, reordered]).map(b => b.id)).toEqual(['b', 'a'])
})

test('mergeCatalogs: empty layers are skipped', () => {
  const base = normalizeCatalog([{ id: 'da', title: 'yes' }])
  expect(mergeCatalogs([[], base, []]).map(b => b.id)).toEqual(['da'])
  expect(mergeCatalogs([])).toEqual([])
})

test('mergeCatalogs deep-merges per-language maps for the same id', () => {
  const shipped = normalizeCatalog([
    {
      id: 'yes',
      title: 'yes',
      titles: { en: 'yes', es: 'sí', fr: 'oui' },
      texts: { en: 'yes', es: 'sí', fr: 'oui' },
    },
  ])
  const user = normalizeCatalog([
    { id: 'yes', title: 'yes', titles: { ru: 'да' }, texts: { ru: 'да' } },
  ])
  const merged = mergeCatalogs([shipped, user])
  expect(merged[0]?.titles).toEqual({ en: 'yes', es: 'sí', fr: 'oui', ru: 'да' })
  expect(merged[0]?.texts).toEqual({ en: 'yes', es: 'sí', fr: 'oui', ru: 'да' })
})
