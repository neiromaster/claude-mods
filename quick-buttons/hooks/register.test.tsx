import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'quick-buttons',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

// Band рисуется только на terminal и desktop (типы: "Raised on the terminal
// and desktop surfaces only").
test('the band shows two buttons, on both surfaces', async ($, _on) => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'da' })).toBeDefined()
    expect(await ui.find({ key: 'commit' })).toBeDefined()
    await ui.unmount()
  }
})

test('pressing a button submits its text as the user', async ($, on) => {
  const submitted: { text: string; asUser?: true }[] = []
  // Под стендом в тестах ничего нет: он сам отвечает за движок —
  // возвращает событие prompt.submit с тем же текстом.
  on('prompt.submit', ($, e) => {
    const asUser = 'asUser' in e.origin && e.origin.asUser === true ? true : undefined
    submitted.push({ text: e.text, asUser })
    return { text: e.text }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'da' })
  await ui.press({ key: 'commit' })

  expect(submitted.map(p => p.text)).toEqual(['да', 'коммить'])
  expect(submitted.every(p => p.asUser === true)).toBe(true)
  await ui.unmount()
})
