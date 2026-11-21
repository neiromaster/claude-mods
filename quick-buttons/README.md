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

## Buttons

Each catalog button has a toggle in the `/config` menu
(`quick-buttons.show_da`, `quick-buttons.show_commit`, …). Default is on;
unchecking hides the button, and if every toggle is off the band row is not
drawn at all. A button added to the catalog ships its own toggle in the same
release.

```json
{
  "pluginConfigs": {
    "quick-buttons": { "show_commit": false }
  }
}
```

## Settings pane

The band's ⚙ button (or the `/buttons-config` command) opens a settings pane:
a language picker and a per-button toggle for every catalog button. Changes
apply instantly — the pane writes the same config rows the `/config` menu
shows (via `$.config.set`), and the band redraws on the spot. Esc or the
«закрыть» button closes the pane.

## Setup

Two options (language, visible buttons) — everything else works out of the
box. Requires Claude Code 2.1.287+ (mods). Draw on the `terminal` and
`desktop` surfaces; nothing draws under `claude -p`, the Agent SDK, or cloud
sessions — that is platform behavior, not a bug.
