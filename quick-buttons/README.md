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
(`quick-buttons.language`), via `/plugin configure quick-buttons@plugins-local`,
or in settings:

```json
{
  "pluginConfigs": {
    "quick-buttons": { "language": "en" }
  }
}
```

## Buttons

Which buttons the band shows is configurable: set `quick-buttons.buttons` to a
comma-separated list of catalog ids (`da`, `commit` — the catalog grows with
releases). Empty or unset means all buttons; unknown ids are dropped and the
order follows the catalog. If the list resolves to nothing, the band row is
not drawn at all.

```json
{
  "pluginConfigs": {
    "quick-buttons": { "buttons": "da, commit" }
  }
}
```

## Setup

Language is the only option; everything else works out of the box. Requires
Claude Code 2.1.287+ (mods). Draw on the `terminal` and `desktop` surfaces;
nothing draws under `claude -p`, the Agent SDK, or cloud sessions — that is
platform behavior, not a bug.
