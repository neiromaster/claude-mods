import type { Register } from 'claude-code'

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

// Каталог кнопок: новая кнопка = запись здесь + булево поле show_<id> в манифесте.
const CATALOG: { id: string; labels: Record<string, string> }[] = [
  { id: 'da', labels: { ru: 'да', en: 'yes' } },
  { id: 'commit', labels: { ru: 'коммить', en: 'commit' } },
]

export interface HudButton {
  id: string
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
    label: b.labels[langKey] ?? b.labels.ru!,
  }))
}

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as {
    language?: string
    show?: Record<string, boolean | undefined>
  }

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
          <Button key={b.id} label={b.label} onPress={send(b.label)} />
        ))}
      </Box>
    )
  })
}
