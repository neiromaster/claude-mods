import type { Register } from 'claude-code'

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)

    const send = (text: string) => async () => {
      await $.prompt.submit({ text, asUser: true })
    }

    return (
      <Box columnGap={1}>
        <Button key="da" label="да" onPress={send('да')} />
        <Button key="commit" label="коммить" onPress={send('коммить')} />
      </Box>
    )
  })
}
