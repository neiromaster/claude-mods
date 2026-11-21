import { expect, test } from 'claude-code/testing'

import { buttonsFor, normalizeCatalog, uiStringsFor, type CatalogEntry, type UiStrings } from './register'

const JSON_CATALOG = [
  { id: 'da', title: 'yes', titles: { ru: 'да' }, text: 'yes' },
  { id: 'commit', title: 'commit', titles: { ru: 'коммить' } },
]

const SETTINGS: CatalogEntry = {
  id: 'settings',
  kind: 'pane',
  title: 'settings',
  titles: { ru: '⚙ настройки', en: '⚙ settings' },
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

test('buttonsFor honours show toggles; hidden entries are filtered by the caller', () => {
  const cat = normalizeCatalog(JSON_CATALOG).concat([SETTINGS])
  expect(buttonsFor(cat, 'ru', { settings: false })).toEqual([
    { id: 'da', kind: 'prompt', label: 'да', submit: 'yes' },
    { id: 'commit', kind: 'prompt', label: 'коммить', submit: 'коммить' },
  ])
  // Выключенные через $.store кнопки вызывающий код фильтрует до buttonsFor:
  expect(buttonsFor(cat.filter(b => b.id !== 'settings'), 'ru', {}).map(b => b.id)).toEqual([
    'da',
    'commit',
  ])
})

test('uiStringsFor: built-in ru/en without a locale file', () => {
  expect(uiStringsFor(undefined, 'ru')).toMatchObject({ on: 'вкл', off: 'выкл', label: 'Русский' })
  expect(uiStringsFor(undefined, 'en')).toMatchObject({ on: 'on', off: 'off', label: 'English' })
})

test('uiStringsFor: locale file overrides fields and adds languages', () => {
  const loaded = {
    en: { on: 'ON', label: 'English (UK)' },
    es: { on: 'sí', off: 'no', label: 'Español', settings: 'ajustes' },
  }
  const en = uiStringsFor(loaded as Record<string, Partial<UiStrings>>, 'en')
  expect(en.on).toBe('ON')
  expect(en.off).toBe('off')
  expect(en.label).toBe('English (UK)')

  const es = uiStringsFor(loaded as Record<string, Partial<UiStrings>>, 'es')
  expect(es.on).toBe('sí')
  expect(es.close).toBe('закрыть')
  expect(es.label).toBe('Español')
})

test('uiStringsFor: unknown language with no locale file falls back gracefully', () => {
  const de = uiStringsFor(undefined, 'de')
  expect(de.label).toBe('de')
  expect(de.on).toBe('вкл')
})
