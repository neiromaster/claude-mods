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

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as { language?: string }
  const labels = labelsFor(opts.language)

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)

    const send = (text: string) => async () => {
      await $.prompt.submit({ text, asUser: true })
    }

    return (
      <Box columnGap={1}>
        <Button key="da" label={labels.da} onPress={send(labels.da)} />
        <Button key="commit" label={labels.commit} onPress={send(labels.commit)} />
      </Box>
    )
  })
}
