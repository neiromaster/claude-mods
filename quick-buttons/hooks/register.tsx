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
async function openSettings($: EngineInterface): Promise<void> {
  const opened = await $.ui.open({
    id: PANE,
    title: 'quick-buttons · настройки',
    focus: true,
    closeOnEscape: true,
  })
  if (!opened.isPlaced) {
    $.ui.toast(`quick-buttons: панель не открылась (${String(opened.reason)})`)
  }
}

async function setConfig($: EngineInterface, key: string, value: string | boolean): Promise<void> {
  await $.config.set({ key: `quick-buttons.${key}`, value })
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as {
    language?: string
    show?: Record<string, boolean | undefined>
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'buttons-config',
      description: 'Open the quick-buttons settings pane',
    })
    return next(e)
  })

  on('command.run', { command: 'buttons-config' }, async $ => {
    await openSettings($)
    return { text: 'quick-buttons: панель настроек открыта.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const buttons = buttonsFor(opts.language, opts.show)
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
                    void openSettings($)
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
    const rowValue = (key: string): string | number | boolean | undefined =>
      rows.find(r => r.key === key)?.value

    const rawLang = rowValue('quick-buttons.language')
    const lang = typeof rawLang === 'string' ? rawLang : 'ru'
    const labels = labelsFor(lang)

    const toggles = CATALOG.filter(b => b.kind === 'prompt')

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>quick-buttons · настройки</Text>
        <Select
          key="lang"
          label="язык"
          value={lang}
          options={[
            { value: 'ru', label: 'русский' },
            { value: 'en', label: 'english' },
          ]}
          onSelect={value => {
            void setConfig($, 'language', value)
          }}
        />
        {toggles.map(b => {
          const key = `show_${b.id}`
          const isOn = rowValue(`quick-buttons.${key}`) !== false
          return (
            <Button
              key={b.id}
              label={`${labels[b.id as keyof ButtonLabels] ?? b.id}: ${isOn ? 'вкл' : 'выкл'}`}
              onPress={() => {
                void setConfig($, key, !isOn)
              }}
            />
          )
        })}
        <Button key="close" label="закрыть" onPress={() => { void $.ui.close({ id: PANE }) }} />
        <Text dimColor>Esc — закрыть, Tab — переход между строками</Text>
      </Box>
    )
  })
}
