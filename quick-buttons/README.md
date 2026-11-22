# quick-buttons

A Claude Code mod (plugin subtype) that draws two buttons — `да` and `коммить` —
in the band directly above the prompt input. Pressing a button submits its label
as the user's own words (`$.prompt.submit` with `asUser: true`); if a turn is
running, the message is queued and sent once the session is idle.

## Usage

- Click a button, or focus the band with `Ctrl+X Tab` and press `Enter`/`Space`
  (`Tab`/arrows move between buttons).
- `Ctrl+X Ctrl+A` collapses or expands the band.
- Digit hotkeys were intentionally removed: typing `1` or `2` in an empty prompt
  types text as usual.

## Language

Button labels are configurable: `ru` (default — «да», «коммить») or `en`
("yes", "commit"). A press submits the label text of the chosen language as
the user's own words. Switch it in the `/config` menu
(`quick-buttons.language`) or in settings:

```json
{
  "pluginConfigs": {
    "quick-buttons": { "language": "en" }
  }
}
```

## Buttons (three catalog layers)

The visible catalog is merged from three `buttons` arrays, in order:

1. **Shipped defaults** — `buttons.json` in the plugin folder;
2. **Global** — `~/.claude/quick-buttons.buttons.json` (your buttons in every
   project);
3. **Project** — `.claude/quick-buttons.json` in the project root (buttons for
   this project only, shareable with the repo).

Later layers override entries with the same `id` (in place, order preserved)
and append new ids. Missing files are skipped; if no layer provides anything,
the built-in two-button fallback is used. `buttons.schema.json` in the plugin
folder gives editors validation and autocomplete — point `$schema` at it from
any of the files.

Each entry: `id`, `title` (fallback label), `titles` (per-language labels,
e.g. `{ "ru": "да" }`), and how pressing submits:

- `texts` — per-language prompt, e.g.
  `{ "ru": "Покажи подсказку", "en": "Show the hint" }`;
- `text` — a single prompt for every language;
- `command` — slash command name, submitted as `/<command>`.

Precedence: `texts[active language]` → `text` → the label in the active
language; `command` overrides all of them. With none of them, pressing
submits the label itself.

Visibility: the settings pane stores per-button toggles in `$.store` (outside
the plugin folder, survives plugin updates); a hidden button stays hidden
regardless of the catalog layers. The ⚙ settings button is built in; its
visibility is the `show_settings` option in `/config`. If no layer provides
anything, the built-in two-button fallback is used.

```json
{
  "$schema": "./buttons.schema.json",
  "buttons": [
    { "id": "da", "title": "yes", "titles": { "ru": "да" }, "text": "yes" },
    { "id": "commit", "title": "commit", "titles": { "ru": "коммить" } },
    { "id": "review", "title": "review", "titles": { "ru": "ревью" }, "command": "review" }
  ]
}
```

```json
{
  "$schema": "./buttons.schema.json",
  "buttons": [
    { "id": "da", "title": "yes", "titles": { "ru": "да" }, "text": "yes" },
    { "id": "commit", "title": "commit", "titles": { "ru": "коммить" } },
    { "id": "review", "title": "review", "titles": { "ru": "ревью" }, "command": "review" }
  ]
}
```

## Settings pane

The band's ⚙ button (or the `/buttons-config` command) opens a settings pane:
a language picker and a per-button toggle for every catalog button. Changes
apply instantly — the pane writes the same config rows the `/config` menu
shows (via `$.config.set`), and the band redraws on the spot. Esc or the
«закрыть» button closes the pane.

## Locales (locales.json)

All pane strings live in `locales.json` — per language, overridable without
touching code (`locales.schema.json` alongside gives editors validation).
Built-in `ru`/`en` strings are the fallback; a locale file overrides any
field per language, and **adding a key adds a language to the picker** in the
settings pane.

```json
{
  "$schema": "./locales.schema.json",
  "ru": { "label": "Русский" },
  "en": { "label": "English" },
  "es": {
    "label": "Español",
    "on": "sí",
    "off": "no",
    "settings": "ajustes",
    "buttons": "botones"
  }
}
```

Fields: `label` (picker name), `on`/`off` (toggle state words), `language`,
`close`, `settings`, `buttons` (section/labels), `hint` (bottom line).

## Setup

Two options (language, visible buttons) — everything else works out of the
box. Requires Claude Code 2.1.287+ (mods). Draw on the `terminal` and
`desktop` surfaces; nothing draws under `claude -p`, the Agent SDK, or cloud
sessions — that is platform behavior, not a bug.
