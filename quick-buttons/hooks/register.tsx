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

// Каталог кнопок: новая кнопка = одна запись здесь + id в настройке buttons.
const CATALOG: { id: string; labels: Record<string, string> }[] = [
  { id: 'da', labels: { ru: 'да', en: 'yes' } },
  { id: 'commit', labels: { ru: 'коммить', en: 'commit' } },
]

const DEFAULT_IDS = CATALOG.map(b => b.id)

export interface HudButton {
  id: string
  label: string
}

// enabled — строка из настроек: id через запятую; пустая/незаполненная = весь каталог.
// Неизвестные id отбрасываются, порядок следует каталогу.
export function buttonsFor(lang: string | undefined, enabled: string | undefined): HudButton[] {
  const ids = (enabled ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const wanted = ids.length > 0 ? ids : DEFAULT_IDS
  const langKey = lang ?? 'ru'
  return CATALOG.filter(b => wanted.includes(b.id)).map(b => ({
    id: b.id,
    label: b.labels[langKey] ?? b.labels.ru!,
  }))
}

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as { language?: string; buttons?: string }

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const buttons = buttonsFor(opts.language, opts.buttons)
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
