import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'quick-buttons-settings'
const SOUND_MIN_MS = 5000

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

// Strict normalization: invalid entries are dropped, unknown fields are stripped.
export function normalizeCatalog(raw: unknown): CatalogEntry[] {
  if (!Array.isArray(raw)) return []
  const out: CatalogEntry[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const o = item as Record<string, unknown>
    // title is optional: an id-only entry inherits the rest from lower layers
    // at merge time (label falls back to the id while nothing provides one).
    const id = typeof o.id === 'string' && o.id !== '' ? o.id : undefined
    if (!id) continue
    const title = typeof o.title === 'string' ? o.title : ''
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
  const langKey = lang ?? 'en'
  const result: HudButton[] = []
  for (const b of catalog) {
    if (show?.[b.id] === false) continue
    const label = b.titles[langKey] ?? (b.title || b.id)
    const submit = b.command ? '/' + b.command : (b.texts?.[langKey] ?? b.text ?? label)
    result.push({ id: b.id, kind: b.kind, label, submit })
  }
  return result
}

// Catalog layers: built-in (fallback) -> shipped buttons.json -> global
// (~/.claude) -> project (.claude). Later layers override scalar fields by
// id, deep-merge the per-language maps (titles/texts) by language key, and
// append new ids. The topmost non-empty layer defines the button order; ids
// found only in lower layers are appended after it, in their own order.
export function mergeCatalogs(layers: CatalogEntry[][]): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>()
  for (const layer of layers) {
    for (const b of layer) {
      const prev = byId.get(b.id)
      if (!prev) {
        byId.set(b.id, b)
        continue
      }
      byId.set(b.id, {
        id: prev.id,
        kind: b.kind,
        title: b.title || prev.title,
        titles: { ...prev.titles, ...b.titles },
        text: b.text ?? prev.text,
        texts: b.texts ? { ...(prev.texts ?? {}), ...b.texts } : prev.texts,
        command: b.command ?? prev.command,
      })
    }
  }
  // The topmost non-empty layer defines the button order; ids found only in
  // lower layers are appended after it, in their own order.
  let orderRef: CatalogEntry[] | undefined
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i]!.length > 0) {
      orderRef = layers[i]!
      break
    }
  }
  if (!orderRef) return []

  const orderIds = new Set(orderRef.map(b => b.id))
  const result: CatalogEntry[] = []
  for (const b of orderRef) {
    const entry = byId.get(b.id)
    if (entry) result.push(entry)
  }
  for (const [id, entry] of byId) {
    if (!orderIds.has(id)) result.push(entry)
  }
  return result
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
  const paths = [`${$.plugin.root}/buttons.json`]
  const home = await homeDir($)
  if (home) paths.push(`${home}/.claude/quick-buttons.buttons.json`)
  paths.push('.claude/quick-buttons.json')

  const layers: CatalogEntry[][] = []
  for (const path of paths) {
    const entries = await readCatalog($, path)
    if (entries.length > 0) layers.push(entries)
  }
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
  sound: string
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
    sound: 'звук',
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
    sound: 'sound',
  },
}

export function uiStringsFor(
  loaded: Record<string, Partial<UiStrings>> | undefined,
  lang: string | undefined,
): UiStrings {
  const key = lang ?? 'en'
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
const soundAtom = atom({ plugin: 'quick-buttons', key: 'sound' } as const, true)

// $.store persists across sessions and plugin updates (a JSON file outside
// the plugin folder); state is the live subscribed copy for renders.
async function seedStateFromStore($: EngineInterface): Promise<void> {
  try {
    const stored = await $.store.get('disabled')
    if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
      const map: Record<string, boolean> = {}
      for (const [k, b] of Object.entries(stored as Record<string, unknown>)) {
        if (typeof b === 'boolean') map[k] = b
      }
      await update($, disabledAtom, () => map)
    }
    const storedSound = await $.store.get('sound')
    if (typeof storedSound === 'boolean') {
      await update($, soundAtom, () => storedSound)
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

async function setSound($: EngineInterface, on: boolean): Promise<void> {
  await update($, soundAtom, () => on)
  await $.store.set('sound', on)
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
  // A userConfig change reloads the module, which re-renders every site;
  // no explicit invalidation needed.
  await $.config.set({ key: rowKey, value })
}

// $.audio.play has no player on Windows terminals (it resolves as "skipped"),
// so the chime is played by a spawned PowerShell MediaPlayer instead. The
// caller must await this: the engine reaps children still running when the
// hook's dispatch completes.
function toPsBase64(script: string): string {
  const bytes = new Uint8Array(script.length * 2)
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i)
    bytes[i * 2] = code & 0xff
    bytes[i * 2 + 1] = code >> 8
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function playWindowsChime($: EngineInterface): Promise<void> {
  const wav = `${$.plugin.root.replace(/\\/g, '/')}/assets/notification.wav`
  const script =
    `Add-Type -AssemblyName PresentationCore; ` +
    `$m = New-Object System.Windows.Media.MediaPlayer; ` +
    `$m.Open([uri]'${wav}'); ` +
    `$m.Play(); Start-Sleep -Milliseconds 1800`
  // The spawn returns a stream; iterating it to the end waits for the child
  // process to exit. Fire-and-forget spawns get reaped by the engine when the
  // hook's dispatch completes, which kills the player before it plays.
  const stream = $.process.spawn({
    argv: ['powershell', '-NoProfile', '-NonInteractive', '-EncodedCommand', toPsBase64(script)],
  })
  for await (const chunk of stream) {
    void chunk
  }
}

// ---- Registration ----

export const register: Register = (on, options) => {
  const opts = (options ?? {}) as Record<string, unknown>
  const lang = typeof opts.language === 'string' ? opts.language : 'en'

  const show: Record<string, boolean | undefined> = {}
  for (const [k, v] of Object.entries(opts)) {
    if (k.startsWith('show_')) {
      show[k.slice(5)] = typeof v === 'boolean' ? v : undefined
    }
  }

  // Ring for the main loop's turn only (e.agentId is absent there): subagent
  // and nested-loop ends also raise this event. Skipped: aborted turns (the
  // person interrupted, so they are present) and turns under the threshold.
  on('turn.complete', async ($, e, next) => {
    const soundOn = (await read($, soundAtom)) ?? true
    if (!soundOn || e.agentId || e.isAborted || e.durationMs < SOUND_MIN_MS) {
      return next(e)
    }
    const os = (await $.env.get("OS")) ?? ''
    if (os === 'Windows_NT') {
      await playWindowsChime($).catch(err => {
        $.ui.toast(`quick-buttons: chime failed (${String(err)})`)
      })
    } else {
      // macOS: $.audio.play uses afplay. WSL: $.audio.play has no player,
      // but powershell.exe is reachable through WSL interop -> the Windows
      // system sound plays on the Windows side. Native Linux: a detached
      // cascade of standard players (paplay, aplay, pw-play).
      const wsl = await $.env.get("WSL_DISTRO_NAME")
      if (wsl) {
        void (async () => {
          try {
            await $.process.spawn({
              argv: [
                'powershell.exe',
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                '[System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 700',
              ],
            })
          } catch {
            // best-effort
          }
        })()
      } else {
        void (async () => {
          try {
            const wav = `${$.plugin.root.replace(/\\/g, '/')}/assets/notification.wav`
            await $.process.spawn({
              argv: [
                'sh',
                '-c',
                'nohup paplay "$1" >/dev/null 2>&1 || nohup aplay "$1" >/dev/null 2>&1 || nohup pw-play "$1" >/dev/null 2>&1 || true',
                'sh',
                wav,
              ],
            })
          } catch {
            // best-effort
          }
        })()
        try {
          await $.audio.play({ asset: 'assets/notification.wav' })
        } catch {
          // macOS path; Linux plays via the cascade above
        }
      }
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'buttons-config',
      description: 'Open the quick-buttons settings pane',
    })
    await seedStateFromStore($)
    return next(e)
  })

  on('command.run', { command: 'buttons-config' }, async $ => {
    const locales = await loadLocales($)
    await openSettings($, uiStringsFor(locales, lang))
    return { text: 'quick-buttons: settings pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const soundOn = (await read($, soundAtom)) ?? true
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
    const left = buttons.filter(b => b.kind !== 'pane')
    const right = buttons.filter(b => b.kind === 'pane')

    return (
      <Box width={e.props.bodyColumns} justifyContent="space-between">
        <Box columnGap={1}>
          {left.map(b => (
            <Button key={b.id} label={b.label} onPress={send(b.submit)} />
          ))}
        </Box>
        <Box columnGap={1}>
          <Button
            key="sound"
            label={soundOn ? '🔔' : '🔕'}
            onPress={() => {
              void setSound($, !soundOn)
            }}
          />
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
    const paneLang = typeof rawLang === 'string' ? rawLang : 'en'
    const disabled = (await read($, disabledAtom)) ?? {}
    const soundOn = (await read($, soundAtom)) ?? true
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
            const name = b.titles[paneLang] ?? (b.title || b.id)
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

        <Box>
          <Text>🔊 {ui.sound}: </Text>
          <Button
            key="sound-toggle"
            plain
            onPress={() => {
              void setSound($, !soundOn)
            }}
          >
            <Text color={soundOn ? '#22c55e' : '#6b7280'}>{soundOn ? '●' : '○'}</Text>
            {' '}
            <Text dimColor>{soundOn ? ui.on : ui.off}</Text>
          </Button>
        </Box>

        <Button key="close" variant="primary" label={ui.close} onPress={() => { void $.ui.close({ id: PANE }) }} />
        <Text dimColor>{ui.hint}</Text>
      </Box>
    )
  })
}
