import type { EngineInterface, Register } from 'claude-code'

const PANE = 'quick-buttons-settings'

export interface ButtonLabels {
  da: string
  commit: string
}

const LABELS: Record<string, ButtonLabels> = {
  ru: { da: 'да', commit: 'коммить' },
  en: { da: 'yes', commit: 'commit' },
}

export function labelsFor(lang?: string): ButtonLabels {
  return (lang && LABELS[lang]) || LABELS.ru!
}

const UI_STRINGS: Record<string, { on: string; off: string; language: string; close: string; settings: string }> = {
  ru: { on: 'вкл', off: 'выкл', language: 'язык', close: 'закрыть', settings: 'настройки' },
  en: { on: 'on', off: 'off', language: 'language', close: 'close', settings: 'settings' },
}

type CatalogButton = {
  id: string
  kind: 'prompt' | 'pane'
  labels: Record<string, string>
}

// Каталог: prompt-кнопка отправляет свой текст, pane-кнопка открывает панель настроек.
// Новая кнопка = запись здесь + булево поле show_<id> в манифесте.
const CATALOG: CatalogButton[] = [
  { id: 'da', kind: 'prompt', labels: { ru: 'да', en: 'yes' } },
  { id: 'commit', kind: 'prompt', labels: { ru: 'коммить', en: 'commit' } },
  { id: 'settings', kind: 'pane', labels: { ru: '⚙ настройки', en: '⚙ settings' } },
]

export interface HudButton {
  id: string
  kind: CatalogButton['kind']
  label: string
}

// show — toggle-поля из настроек: show[id] === false прячет кнопку,
// undefined/true и неизвестные ключи ничего не меняют. Порядок следует каталогу.
export function buttonsFor(
  lang: string | undefined,
  show: Record<string, boolean | undefined> | undefined,
): HudButton[] {
  const langKey = lang ?? 'ru'
  return CATALOG.filter(b => show?.[b.id] !== false).map(b => ({
    id: b.id,
    kind: b.kind,
    label: b.labels[langKey] ?? b.labels.ru!,
  }))
}

// Топ-уровневые функции: движок отслеживает $ только через них или импорты.
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

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as Record<string, unknown>
  const lang = typeof opts.language === 'string' ? opts.language : 'ru'

  // userConfig приходит плоско: { language, show_da, show_commit, ... } —
  // собираем map видимости из полей show_<id>.
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

    // Перезагрузка мода (смена userConfig) оставляет открытую панель без
    // title — новый экземпляр возвращает его на месте.
    try {
      const panes = await $.ui.panes()
      if (panes.some(p => p.id === PANE)) {
        const ui = UI_STRINGS[lang] ?? UI_STRINGS.ru!
        await $.ui.open({
          id: PANE,
          title: `quick-buttons · ${ui.settings}`,
          focus: true,
          closeOnEscape: true,
        })
      }
    } catch {
      // panes() недоступен — не критично
    }

    return next(e)
  })

  on('command.run', { command: 'buttons-config' }, async $ => {
    await openSettings($, lang)
    return { text: 'quick-buttons: панель настроек открыта.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const buttons = buttonsFor(
      typeof opts.language === 'string' ? opts.language : undefined,
      show,
    )
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
                : send(b.label)
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
    // Ключ строки может быть квалифицирован именем маркетплейса — берём как есть.
    const rowFor = (field: string) => rows.find(r => r.key.endsWith('.' + field))
    const rowValue = (field: string): unknown => rowFor(field)?.value
    const rowKey = (field: string): string => rowFor(field)?.key ?? `quick-buttons.${field}`

    const rawLang = rowValue('language')
    const paneLang = typeof rawLang === 'string' ? rawLang : 'ru'
    const labels = labelsFor(paneLang)
    const ui = UI_STRINGS[paneLang] ?? UI_STRINGS.ru!

    const toggles = CATALOG.filter(b => b.kind === 'prompt')

    return (
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
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
        {toggles.map(b => {
          const field = `show_${b.id}`
          const isOn = rowValue(field) !== false
          const name = labels[b.id as keyof ButtonLabels] ?? b.id
          return (
            <Box key={b.id}>
              <Text>{name}: </Text>
              <Button
                key={`${b.id}-toggle`}
                label={isOn ? ui.on : ui.off}
                onPress={() => {
                  void setConfig($, rowKey(field), !isOn)
                }}
              />
            </Box>
          )
        })}
        <Button key="close" label={ui.close} onPress={() => { void $.ui.close({ id: PANE }) }} />
        <Text dimColor>Esc — закрыть, Tab — переход между строками</Text>
      </Box>
    )
  })
}
