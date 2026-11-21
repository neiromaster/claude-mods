import { expect, test } from 'claude-code/testing'

import { buttonsFor, normalizeCatalog, type CatalogEntry } from './register'

const JSON_CATALOG = [
  { id: 'da', title: 'yes', titles: { ru: 'да' }, text: 'yes' },
  { id: 'commit', title: 'commit', titles: { ru: 'коммить' } },
  { id: 'ctx', title: 'Context', command: 'context', disabled: true },
]

const SETTINGS: CatalogEntry = {
  id: 'settings',
  kind: 'pane',
  title: 'settings',
  titles: { ru: '⚙ настройки', en: '⚙ settings' },
  disabled: false,
}

test('normalizeCatalog keeps valid entries and drops broken ones', () => {
  const cat = normalizeCatalog([
    { id: 'da', title: 'yes' },
    { title: 'no id' },
    { id: 'no-title' },
    'garbage',
    null,
    { id: 'x', title: 'X', titles: { ru: 'икс' }, text: 'X!' },
  ])
  expect(cat.map(b => b.id)).toEqual(['da', 'x'])
  expect(cat[1]).toEqual({
    id: 'x',
    kind: 'prompt',
    title: 'X',
    titles: { ru: 'икс' },
    submit: 'X!',
    command: undefined,
    disabled: false,
  })
})

test('buttonsFor resolves labels per language and submit per text/command/label', () => {
  const cat = normalizeCatalog(JSON_CATALOG)
  expect(buttonsFor(cat, 'ru', {})).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
  ])
  expect(buttonsFor(cat, 'en', {})).toEqual([
    { id: 'da', kind: 'prompt', label: 'yes', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'commit', submit: 'commit' },
  ])
})

test('buttonsFor: unknown language falls back to title', () => {
  const cat = normalizeCatalog(JSON_CATALOG)
  expect(buttonsFor(cat, 'de', {})[0]).toEqual({ id: 'da', kind: 'prompt', label: 'yes', submit: 'yes' })
})

test('buttonsFor hides disabled entries and honours show toggles', () => {
  const cat = normalizeCatalog(JSON_CATALOG).concat([SETTINGS])
  expect(buttonsFor(cat, 'ru', { settings: false })).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
  ])
  expect(buttonsFor(cat, 'ru', {})).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
    { id: 'settings', kind: 'pane', label: '⚙ настройки', submit: '⚙ настройки' },
  ])
  const disabled = normalizeCatalog([{ id: 'da', title: 'yes', disabled: true }])
  expect(buttonsFor(disabled, 'ru', {})).toEqual([])
})
