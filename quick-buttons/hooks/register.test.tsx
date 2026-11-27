import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'

import {
  buttonsFor,
  listSoundChoices,
  mergeCatalogs,
  normalizeCatalog,
  type CatalogEntry,
} from './register'

function fakeEngine(listResult: unknown): EngineInterface {
  return {
    plugin: { root: '/plugins/quick-buttons' },
    fs: { list: () => Promise.resolve(listResult) },
  } as unknown as EngineInterface
}

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
    { id: 'id-only' },
    'garbage',
    null,
    { id: 'x', title: 'X', titles: { ru: 'икс' }, texts: { ru: 'икс!' } },
  ])
  expect(cat.map(b => b.id)).toEqual(['da', 'id-only', 'x'])
  expect(cat[1]).toEqual({
    id: 'id-only',
    kind: 'prompt',
    title: '',
    titles: {},
    text: undefined,
    texts: undefined,
    command: undefined,
  })
  expect(cat[2]).toEqual({
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

test('mergeCatalogs: an id-only entry inherits title, texts and command from lower layers', () => {
  const shipped = normalizeCatalog([
    { id: 'quick-buttons-yes', title: 'Yes', titles: { ru: 'Да' }, texts: { ru: 'Да' } },
    {
      id: 'quick-buttons-compact',
      title: 'Compact context',
      command: 'compact',
    },
  ])
  const global = normalizeCatalog([
    { id: 'quick-buttons-compact' },
    { id: 'quick-buttons-yes' },
  ])
  const merged = mergeCatalogs([shipped, global])
  expect(merged.map(b => b.id)).toEqual(['quick-buttons-compact', 'quick-buttons-yes'])
  expect(merged[0]).toMatchObject({ title: 'Compact context', command: 'compact' })
  expect(merged[1]).toMatchObject({ title: 'Yes', titles: { ru: 'Да' }, texts: { ru: 'Да' } })
})

test('buttonsFor: an entry with no title and no lower layer falls back to the id as the label', () => {
  const cat = normalizeCatalog([{ id: 'solo' }])
  expect(buttonsFor(cat, 'en', {})).toEqual([
    { id: 'solo', kind: 'prompt', label: 'solo', submit: 'solo' },
  ])
})

test('listSoundChoices: audio files become choices, default chime first', async () => {
  const choices = await listSoundChoices(
    fakeEngine(['chime.wav', 'stop.mp3', 'ding-dong.mp3', 'readme.txt', 'cover.png']),
  )
  expect(choices).toEqual([
    { id: 'chime', file: 'assets/chime.wav' },
    { id: 'ding-dong', file: 'assets/ding-dong.mp3' },
    { id: 'stop', file: 'assets/stop.mp3' },
  ])
})

test('listSoundChoices: uppercase extensions and entry objects are handled', async () => {
  const choices = await listSoundChoices(
    fakeEngine([{ name: 'Chime.WAV' }, { name: 'Bell.OGG' }]),
  )
  expect(choices).toEqual([
    { id: 'chime', file: 'assets/Chime.WAV' },
    { id: 'bell', file: 'assets/Bell.OGG' },
  ])
})

test('listSoundChoices: no listing at all falls back to the shipped chime', async () => {
  const choices = await listSoundChoices(
    fakeEngine(Promise.reject(new Error('no dir'))),
  )
  expect(choices).toEqual([{ id: 'chime', file: 'assets/chime.wav' }])
})

test('listSoundChoices: hostile filenames are skipped, never reaching players', async () => {
  const choices = await listSoundChoices(
    fakeEngine([
      "evil'; Calc; #.wav", // PowerShell quote escape
      'evil`id`.mp3', // PowerShell subexpression
      'evil; rm -rf .flac', // command separator
      'evil$(id).aiff', // command substitution
      'evil $(id).mp3', // substitution with a space
      'ok name.mp3',
      'ok.mp3',
    ]),
  )
  expect(choices).toEqual([
    { id: 'ok', file: 'assets/ok.mp3' },
    { id: 'ok name', file: 'assets/ok name.mp3' },
  ])
})
