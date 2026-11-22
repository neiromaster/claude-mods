# quick-buttons

A Claude Code mod that draws quick prompt buttons in the band directly above
the prompt input. Pressing a button submits its text as the user's own words
(`$.prompt.submit` with `asUser: true`); if a turn is running, the message is
queued and sent once the session is idle. A ⚙ button opens a settings pane,
and a completion chime plays when a turn finishes.

## Install

From a Claude Code session:

```
/plugin install quick-buttons --marketplace neiromaster/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope. Or from a shell:

```
claude plugin install quick-buttons --marketplace neiromaster/claude-mods
```

## Usage

- Click a button, or focus the band with `Ctrl+X Tab` and press `Enter`/`Space`
  (`Tab`/arrows move between buttons).
- `Ctrl+X Ctrl+A` collapses or expands the band.
- The ⚙ button (or the `/buttons-config` command) opens a settings pane.
- 🔔/🔕 toggles the completion sound.

## Buttons (three catalog layers)

The visible catalog is merged from three `buttons` arrays, in order:

1. **Shipped defaults** — `buttons.json` in the plugin folder;
2. **Global** — `~/.claude/quick-buttons.buttons.json` (your buttons in every
   project);
3. **Project** — `.claude/quick-buttons.json` in the project root (buttons for
   this project only, shareable with the repo).

Later layers override entries with the same `id` (in place, order preserved)
and append new ids. Missing files are skipped; if no layer provides anything,
no buttons are drawn at all. `buttons.schema.json` gives editors validation
and autocomplete — point `$schema` at it from any of the files.

Each entry: `id`, `title` (fallback label), `titles` (per-language labels,
e.g. `{ "ru": "да", "es": "sí" }`), and how pressing submits:

- `texts` — per-language prompt, e.g.
  `{ "ru": "Покажи подсказку", "en": "Show the hint" }`;
- `text` — a single prompt for every language;
- `command` — slash command name, submitted as `/<command>`.

Precedence: `texts[active language]` → `text` → the label in the active
language; `command` overrides all of them. With none of them, pressing
submits the label itself.

Example — a project file adding a code-review button:

```json
{
  "buttons": [
    {
      "id": "review",
      "title": "review",
      "titles": { "ru": "ревью", "es": "revisión" },
      "command": "review"
    }
  ]
}
```

## Settings pane

The ⚙ button (or the `/buttons-config` command) opens a settings pane:

- 🌐 language — every pane string is localized;
- 🔘 buttons — per-button visibility toggles (stored in `$.store`, survive
  plugin updates);
- 🔊 sound — completion chime on/off.

Changes apply instantly; Esc or the close button dismisses the pane.

## Locales (locales.json)

Pane strings live in `locales.json` — per language, overridable without
touching code (`locales.schema.json` gives editors validation). Built-in
`ru`/`en` strings are the fallback; a locale overrides any field per language,
and **adding a key adds a language to the picker** in the settings pane.

```json
{
  "$schema": "./locales.schema.json",
  "ru": { "label": "Русский" },
  "en": { "label": "English" },
  "es": {
    "label": "Español",
    "on": "activado",
    "off": "desactivado",
    "language": "idioma",
    "close": "cerrar",
    "settings": "ajustes",
    "hint": "Esc — cerrar · Tab/clic — alternar",
    "buttons": "botones",
    "sound": "sonido"
  },
  "fr": {
    "label": "Français",
    "on": "activé",
    "off": "désactivé",
    "language": "langue",
    "close": "fermer",
    "settings": "réglages",
    "hint": "Échap — fermer · Tab/clic — basculer",
    "buttons": "boutons",
    "sound": "son"
  }
}
```

Shipped languages: **ru**, **en**, **es**, **fr** — the picker lists every
language that has an entry here or in the built-in fallback.

Fields: `label` (picker name), `on`/`off` (toggle state words), `language`,
`close`, `settings`, `buttons` (section/labels), `hint` (bottom line).

**Adding a language — three places:**

1. `locales.json` — the strings block (this also adds the language to the
   pane's picker);
2. `plugin.json` → `userConfig.language.options` — so `/config` accepts it;
3. `buttons.json` — optional `titles`/`texts` keys for translated buttons.

## Completion sound

When a main-loop turn finishes (5s or longer, not interrupted, no subagents),
a short notification chime plays — the 🔔/🔕 button in the band or the 🔊 row
in the settings pane toggles it (persisted in `$.store`).

On Windows, `$.audio.play` has no player, so the mod plays the wav by
spawning a PowerShell `MediaPlayer`. On macOS the built-in `$.audio.play`
(afplay) is used. On Linux a detached cascade of `paplay` → `aplay` →
`pw-play` is spawned. In WSL the cascade is skipped: `powershell.exe` is
invoked through WSL interop and plays the Windows system sound.

## Setup

Options: `language` and `show_settings` (both in `/config`). Everything else
works out of the box. Requires Claude Code 2.1.287+ (mods). Draw on the
`terminal` and `desktop` surfaces; nothing draws under `claude -p`, the Agent
SDK, or cloud sessions — that is platform behavior, not a bug.
