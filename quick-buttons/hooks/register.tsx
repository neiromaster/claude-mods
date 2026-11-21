import type { EngineInterface, Register } from 'claude-code'

const PANE = 'quick-buttons-settings'

// ---- Каталог ----

export interface CatalogEntry {
  id: string
  kind: 'prompt' | 'pane'
  title: string
  titles: Record<string, string>
  submit?: string
  command?: string
}

export interface HudButton {
  id: string
  kind: CatalogEntry['kind']
  label: string
  submit: string
}

// Фолбэк, если buttons.json отсутствует или битый.
const BUILTIN_BUTTONS: unknown = [
  { id: 'da', title: 'yes', titles: { ru: 'да' }, text: 'yes' },
  { id: 'commit', title: 'commit', titles: { ru: 'коммить' } },
]

// Строгая нормализация: битые записи отбрасываются, лишние поля срезаются.
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
      submit: typeof o.text === 'string' ? o.text : undefined,
      command: typeof o.command === 'string' && o.command !== '' ? o.command : undefined,
    })
  }
  return out
}

// show — toggle-поля из настроек: show[id] === false прячет кнопку,
// undefined/true и неизвестные ключи ничего не меняют. Порядок следует каталогу.
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
    const submit = b.submit ?? (b.command ? '/' + b.command : label)
    result.push({ id: b.id, kind: b.kind, label, submit })
  }
  return result
}

// ---- Файловые операции (кнопочный JSON) ----

async function loadButtons($: EngineInterface): Promise<CatalogEntry[]> {
  try {
    const raw = await $.fs.read(`${$.plugin.root}/buttons.json`)
    const parsed = JSON.parse(raw) as { buttons?: unknown }
    const cat = normalizeCatalog(parsed.buttons)
    if (cat.length > 0) return cat
  } catch {
    // файла нет или битый JSON — встроенный каталог
  }
  return normalizeCatalog(BUILTIN_BUTTONS)
}

// ⚙ — встроенная кнопка панели настроек, в JSON не живёт.
function withSettings(catalog: CatalogEntry[]): CatalogEntry[] {
  const filtered = catalog.filter(b => b.id !== 'settings')
  return [
    ...filtered,
    {
      id: 'settings',
      kind: 'pane' as const,
      title: 'settings',
      titles: { ru: '⚙ настройки', en: '⚙ settings' },
    },
  ]
}

// Видимость кнопок живёт в $.store (движковый JSON вне папки плагина) —
// переживает обновления плагина и не конфликтует с shipped-каталогом.
async function loadDisabled($: EngineInterface): Promise<Record<string, boolean>> {
  try {
    const v = await $.store.get('disabled')
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const out: Record<string, boolean> = {}
      for (const [k, b] of Object.entries(v as Record<string, unknown>)) {
        if (typeof b === 'boolean') out[k] = b
      }
      return out
    }
  } catch {
    // стор недоступен — считаем всё включённым
  }
  return {}
}

async function setDisabled($: EngineInterface, id: string, disabled: boolean): Promise<void> {
  const current = await loadDisabled($)
  await $.store.set('disabled', { ...current, [id]: disabled })
  $.ui.invalidate('ui.render')
}

// ---- Локализация интерфейса панели ----

const UI_STRINGS: Record<
  string,
  { on: string; off: string; language: string; close: string; settings: string; hint: string }
> = {
  ru: {
    on: 'вкл',
    off: 'выкл',
    language: 'язык',
    close: 'закрыть',
    settings: 'настройки',
    hint: 'Esc — закрыть, Tab — переход между строками',
  },
  en: {
    on: 'on',
    off: 'off',
    language: 'language',
    close: 'close',
    settings: 'settings',
    hint: 'Esc — close, Tab — move between rows',
  },
}

export function labelsFor(lang?: string): ButtonLabels {
  return (lang && LABELS[lang]) || LABELS.ru!
}

const LABELS: Record<string, ButtonLabels> = {
  ru: { da: 'да', commit: 'коммить' },
  en: { da: 'yes', commit: 'commit' },
}

export interface ButtonLabels {
  da: string
  commit: string
}

// ---- Помощники верхнего уровня ($ трассируется только здесь) ----

async function openSettings($: EngineInterface, lang: string): Promise<void> {
  const ui = UI_STRINGS[lang] ?? UI_STRINGS.ru!
  const opened = await $.ui.open({
    id: PANE,
    title: `quick-buttons · ${ui.settings}`,
    focus: true,
    closeOnEscape: true,
  })
  if (!opened.isPlaced) {
    $.ui.toast(`quick-buttons: панель не открылась (${String(opened.reason)})`)
  }
}

async function setConfig($: EngineInterface, rowKey: string, value: string | boolean): Promise<void> {
  await $.config.set({ key: rowKey, value })
  $.ui.invalidate('ui.render')
}

// ---- Регистрация ----

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
    return next(e)
  })

  on('command.run', { command: 'buttons-config' }, async $ => {
    await openSettings($, lang)
    return { text: 'quick-buttons: панель настроек открыта.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const catalog = withSettings(await loadButtons($))
    const disabled = await loadDisabled($)
    const visible = catalog.filter(b => disabled[b.id] !== true)
    const buttons = buttonsFor(visible, lang, show)
    if (buttons.length === 0) {
      return next(e)
    }

    const { Box, Button } = $.ui.resolve(e)

    const send = (text: string) => async () => {
      await $.prompt.submit({ text, asUser: true })
    }

    return (
      <Box columnGap={1}>
        {buttons.map(b => (
          <Button
            key={b.id}
            label={b.label}
            onPress={
              b.kind === 'pane'
                ? () => {
                    void openSettings($, lang)
                  }
                : send(b.submit)
            }
          />
        ))}
      </Box>
    )
  })

  // Панель-подменю настроек: язык и тумблеры кнопок каталога.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    const rows = await $.config.list()
    const rowFor = (field: string) => rows.find(r => r.key.endsWith('.' + field))
    const rowValue = (field: string): unknown => rowFor(field)?.value
    const rowKey = (field: string): string => rowFor(field)?.key ?? `quick-buttons.${field}`

    const rawLang = rowValue('language')
    const paneLang = typeof rawLang === 'string' ? rawLang : 'ru'
    const labels = labelsFor(paneLang)
    const ui = UI_STRINGS[paneLang] ?? UI_STRINGS.ru!
    const catalog = await loadButtons($)
    const disabled = await loadDisabled($)

    return (
      <Box flexDirection="column">
        <Box paddingBottom={1}>
          <Text bold>quick-buttons · {ui.settings}</Text>
        </Box>
        <Select
          key="lang"
          label={ui.language}
          value={paneLang}
          options={[
            { value: 'ru', label: 'русский' },
            { value: 'en', label: 'english' },
          ]}
          onSelect={value => {
            void (async () => {
              await setConfig($, rowKey('language'), value)
              // Перезаголовок открытой панели под новый язык.
              await openSettings($, value)
            })()
          }}
        />
        {catalog.map(b => {
          const isOn = disabled[b.id] !== true
          const name = b.titles[paneLang] ?? b.title
          return (
            <Box key={b.id}>
              <Text>{name}: </Text>
              <Button
                key={`${b.id}-toggle`}
                label={isOn ? ui.on : ui.off}
                onPress={() => {
                  void setDisabled($, b.id, !isOn)
                }}
              />
            </Box>
          )
        })}
        <Button key="close" label={ui.close} onPress={() => { void $.ui.close({ id: PANE }) }} />
        <Text dimColor>{ui.hint}</Text>
      </Box>
    )
  })
}
