import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'quick-buttons-settings'

// ---- Catalog (buttons.json) ----

export interface CatalogEntry {
  id: string
  kind: 'prompt' | 'pane'
  title: string
  titles: Record<string, string>
  text?: string
  texts?: Record<string, string>
  command?: string
}

export interface HudButton {
  id: string
  kind: CatalogEntry['kind']
  label: string
  submit: string
}

// Fallback when buttons.json is missing or broken.
const BUILTIN_BUTTONS: unknown = [
  { id: 'da', title: 'yes', text: 'yes' },
  { id: 'commit', title: 'commit' },
]

// Strict normalization: invalid entries are dropped, unknown fields are stripped.
export function normalizeCatalog(raw: unknown): CatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const out: CatalogEntry[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id !== '' ? o.id : undefined
    const title = typeof o.title === 'string' && o.title !== '' ? o.title : undefined
    if (!id || !title) continue
    const titles: Record<string, string> = {}
    if (typeof o.titles === 'object' && o.titles !== null) {
      for (const [lg, v] of Object.entries(o.titles as Record<string, unknown>)) {
        if (typeof v === 'string') titles[lg] = v
      }
    }
    out.push({
      id,
      kind: 'prompt',
      title,
      titles,
      text: typeof o.text === 'string' ? o.text : undefined,
      texts:
        typeof o.texts === 'object' && o.texts !== null
          ? (Object.fromEntries(
              Object.entries(o.texts as Record<string, unknown>).filter(
                ([, v]) => typeof v === 'string',
              ),
            ) as Record<string, string>)
          : undefined,
      command: typeof o.command === 'string' && o.command !== '' ? o.command : undefined,
    })
  }
  return out
}

// show toggles: show[id] === false hides the button; undefined/true and
// unknown keys keep it. Order follows the catalog.
// Submit text: texts[lang] -> text -> label in the active language; command beats all.
export function buttonsFor(
  catalog: CatalogEntry[],
  lang: string | undefined,
  show: Record<string, boolean | undefined> | undefined,
): HudButton[] {
  const langKey = lang ?? 'ru'
  const result: HudButton[] = []
  for (const b of catalog) {
    if (show?.[b.id] === false) continue
    const label = b.titles[langKey] ?? b.title
    const submit = b.command ? '/' + b.command : (b.texts?.[langKey] ?? b.text ?? label)
    result.push({ id: b.id, kind: b.kind, label, submit })
  }
  return result
}

// Catalog layers: built-in (fallback) -> shipped buttons.json -> global
// (~/.claude) -> project (.claude). Later layers override entries by id
// and append new ids; order = first occurrence.
export function mergeCatalogs(layers: CatalogEntry[][]): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>()
  for (const layer of layers) {
    for (const b of layer) byId.set(b.id, b)
  }
  return [...byId.values()]
}

async function readCatalog($: EngineInterface, path: string): Promise<CatalogEntry[]> {
  try {
    const raw = await $.fs.read(path)
    const parsed = JSON.parse(raw) as { buttons?: unknown }
    return normalizeCatalog(parsed.buttons)
  } catch {
    return []
  }
}

async function homeDir($: EngineInterface): Promise<string | undefined> {
  const win = await $.env.get("USERPROFILE")
  if (win) return win.replace(/\\/g, '/')
  const unix = await $.env.get("HOME")
  return unix ?? undefined
}

async function loadButtons($: EngineInterface): Promise<CatalogEntry[]> {
  const layers: CatalogEntry[][] = [normalizeCatalog(BUILTIN_BUTTONS)]

  const shipped = await readCatalog($, `${$.plugin.root}/buttons.json`)
  layers.push(shipped.length > 0 ? shipped : normalizeCatalog(BUILTIN_BUTTONS))

  const home = await homeDir($)
  if (home) {
    layers.push(await readCatalog($, `${home}/.claude/quick-buttons.buttons.json`))
  }
  layers.push(await readCatalog($, '.claude/quick-buttons.json'))

  return mergeCatalogs(layers)
}

// The settings button is built in, it does not live in buttons.json.
function withSettings(catalog: CatalogEntry[]): CatalogEntry[] {
  const filtered = catalog.filter(b => b.id !== 'settings')
  return [
    ...filtered,
    {
      id: 'settings',
      kind: 'pane' as const,
      title: 'settings',
      titles: { ru: '⚙', en: '⚙' },
    },
  ]
}

// ---- Locales (locales.json) ----

export interface UiStrings {
  on: string
  off: string
  language: string
  close: string
  settings: string
  hint: string
  buttons: string
  label: string
}

// Built-in strings are the fallback; locales.json overrides any field
// per language. The ru entry is localization data, not code.
const BUILTIN_UI: Record<string, UiStrings> = {
  ru: {
    on: 'вкл',
    off: 'выкл',
    language: 'язык',
    close: 'закрыть',
    settings: 'настройки',
    hint: 'Esc — закрыть · Tab/клик — переключить',
    buttons: 'кнопки',
    label: 'Русский',
  },
  en: {
    on: 'on',
    off: 'off',
    language: 'language',
    close: 'close',
    settings: 'settings',
    hint: 'Esc — close · Tab/click — toggle',
    buttons: 'buttons',
    label: 'English',
  },
}

export function uiStringsFor(
  loaded: Record<string, Partial<UiStrings>> | undefined,
  lang: string | undefined,
): UiStrings {
  const key = lang ?? 'ru'
  const base = BUILTIN_UI[key] ?? { ...BUILTIN_UI.ru!, label: key }
  const over = (loaded?.[key] ?? {}) as Partial<UiStrings>
  return { ...base, ...over, label: over.label ?? base.label }
}

async function loadLocales($: EngineInterface): Promise<Record<string, Partial<UiStrings>>> {
  try {
    const raw = await $.fs.read(`${$.plugin.root}/locales.json`)
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, Partial<UiStrings>> = {}
    for (const [lg, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (lg.startsWith('$') || typeof v !== 'object' || v === null) continue
      const rec: Partial<UiStrings> = {}
      for (const [f, s] of Object.entries(v as Record<string, unknown>)) {
        if (typeof s === 'string') rec[f as keyof UiStrings] = s
      }
      out[lg] = rec
    }
    return out
  } catch {
    return {}
  }
}

// ---- Visibility state ----

// Renders reading the atom are subscribed and redraw on writes by themselves.
const disabledAtom = atom({ plugin: 'quick-buttons', key: 'disabled' } as const, {})

// $.store persists across sessions and plugin updates (a JSON file outside
// the plugin folder); state is the live subscribed copy for renders.
async function seedDisabledFromStore($: EngineInterface): Promise<void> {
  try {
    const stored = await $.store.get('disabled')
    if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
      const map: Record<string, boolean> = {}
      for (const [k, b] of Object.entries(stored as Record<string, unknown>)) {
        if (typeof b === 'boolean') map[k] = b
      }
      await update($, disabledAtom, () => map)
    }
  } catch {
    // store unavailable -> start with an empty state
  }
}

async function setDisabled($: EngineInterface, id: string, disabled: boolean): Promise<void> {
  const next = { ...((await read($, disabledAtom)) ?? {}), [id]: disabled }
  await update($, disabledAtom, () => next)
  await $.store.set('disabled', next)
}

// ---- Top-level helpers ($ is traced only through these) ----

async function openSettings($: EngineInterface, ui: UiStrings): Promise<void> {
  const opened = await $.ui.open({
    id: PANE,
    title: `quick-buttons · ${ui.settings}`,
    focus: true,
    closeOnEscape: true,
  })
  if (!opened.isPlaced) {
    $.ui.toast(`quick-buttons: failed to open the pane (${String(opened.reason)})`)
  }
}

async function setConfig($: EngineInterface, rowKey: string, value: string | boolean): Promise<void> {
  await $.config.set({ key: rowKey, value })
  $.ui.invalidate('ui.render')
}

// ---- Registration ----

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as Record<string, unknown>
  const lang = typeof opts.language === 'string' ? opts.language : 'ru'

  const show: Record<string, boolean | undefined> = {}
  for (const [k, v] of Object.entries(opts)) {
    if (k.startsWith('show_')) {
      show[k.slice(5)] = typeof v === 'boolean' ? v : undefined
    }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'buttons-config',
      description: 'Open the quick-buttons settings pane',
    })
    await seedDisabledFromStore($)
    return next(e)
  })

  on('command.run', { command: 'buttons-config' }, async $ => {
    const locales = await loadLocales($)
    await openSettings($, uiStringsFor(locales, lang))
    return { text: 'quick-buttons: settings pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const locales = await loadLocales($)
    const ui = uiStringsFor(locales, lang)
    const catalog = withSettings(await loadButtons($))
    const disabled = (await read($, disabledAtom)) ?? {}
    const visible = catalog.filter(b => disabled[b.id] !== true)
    const buttons = buttonsFor(visible, lang, show)
    if (buttons.length === 0) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)

    const send = (text: string) => async () => {
      await $.prompt.submit({ text, asUser: true })
    }

    // Prompt buttons on the left, the ⚙ settings button pressed to the right edge.
    const width = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : undefined
    const left = buttons.filter(b => b.kind !== 'pane')
    const right = buttons.filter(b => b.kind === 'pane')

    return (
      <Box width={width} justifyContent="space-between">
        <Box columnGap={1}>
          {left.map(b => (
            <Button key={b.id} label={b.label} onPress={send(b.submit)} />
          ))}
        </Box>
        <Box columnGap={1}>
          {right.map(b => (
            <Button
              key={b.id}
              label={b.label}
              onPress={() => {
                void openSettings($, ui)
              }}
            />
          ))}
        </Box>
      </Box>
    )
  })

  // Settings pane submenu: language picker and catalog button toggles.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    const rows = await $.config.list()
    const rowFor = (field: string) => rows.find(r => r.key.endsWith('.' + field))
    const rowValue = (field: string): unknown => rowFor(field)?.value
    const rowKey = (field: string): string => rowFor(field)?.key ?? `quick-buttons.${field}`

    const rawLang = rowValue('language')
    const paneLang = typeof rawLang === 'string' ? rawLang : 'ru'
    const disabled = (await read($, disabledAtom)) ?? {}
    const catalog = await loadButtons($)
    const locales = await loadLocales($)
    const ui = uiStringsFor(locales, paneLang)

    const combined = { ...BUILTIN_UI, ...locales }
    const langOptions = Object.keys(combined).map(code => ({
      value: code,
      label: uiStringsFor(locales, code).label,
    }))

    const toggles = catalog.filter(b => b.kind === 'prompt')

    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="#4a9eff"
        paddingX={1}
        paddingTop={1}
        paddingBottom={1}
        rowGap={1}
      >
        <Text bold>⚙ quick-buttons · {ui.settings}</Text>

        <Box flexDirection="column">
          <Text dimColor bold>🌐 {ui.language.toUpperCase()}</Text>
          <Select
            key="lang"
            label={ui.language}
            value={paneLang}
            options={langOptions}
            onSelect={value => {
              void (async () => {
                await setConfig($, rowKey('language'), value)
                // Re-title the open pane for the new language.
                await openSettings($, uiStringsFor(locales, value))
              })()
            }}
          />
        </Box>

        <Box flexDirection="column">
          <Text dimColor bold>🔘 {ui.buttons.toUpperCase()}</Text>
          {toggles.map(b => {
            const isOn = disabled[b.id] !== true
            const name = b.titles[paneLang] ?? b.title
            return (
              <Box key={b.id} paddingLeft={1}>
                <Button
                  key={`${b.id}-toggle`}
                  plain
                  onPress={() => {
                    void setDisabled($, b.id, isOn)
                  }}
                >
                  <Text color={isOn ? '#22c55e' : '#6b7280'}>{isOn ? '●' : '○'}</Text>
                  {' '}
                  {name}
                  <Text dimColor> · {isOn ? ui.on : ui.off}</Text>
                </Button>
              </Box>
            )
          })}
        </Box>

        <Button key="close" variant="primary" label={ui.close} onPress={() => { void $.ui.close({ id: PANE }) }} />
        <Text dimColor>{ui.hint}</Text>
      </Box>
    )
  })
}
