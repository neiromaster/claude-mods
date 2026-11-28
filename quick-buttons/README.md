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

**Command trust.** Shipped and global buttons may point at any command. A
command set by the *project* layer (`.claude/quick-buttons.json`, shareable
with the repo) only dispatches when it resolves to a command the project
itself defines (`.claude/commands/<name>.md`, a `<name>/` directory holding
`.md` files, or `.claude/skills/<name>/SKILL.md`); otherwise the button
degrades to a plain prompt submit. Project-layer buttons that only *reorder*
shipped or global buttons — id-only entries — keep their inherited commands;
any project entry that overrides a field (label, text, command) must have its
command defined in the project itself, so a repo cannot relabel a global
command button into something misleading and keep its dispatch. A repo can
still point a button at a command it defines itself — that is the standard
project-trust boundary, the same as running any project slash command.

Each entry: `id`, optional `title` (fallback label), `titles` (per-language labels,
e.g. `{ "ru": "да", "es": "sí" }`), and how pressing submits:

- `texts` — per-language prompt, e.g.
  `{ "ru": "Покажи подсказку", "en": "Show the hint" }`;
- `text` — a single prompt for every language;
- `command` — slash command name, submitted as `/<command>`.

Precedence: `texts[active language]` → `text` → the label in the active
language; `command` overrides all of them. With none of them, pressing
submits the label itself.

**`title` is optional.** An entry with only an `id` keeps its position but
inherits `title`, `titles`, `text`, `texts` and `command` from the lower
layers that define the same id — handy for reordering shipped buttons in
your global/project file:

```json
{ "buttons": [{ "id": "quick-buttons-compact" }, { "id": "quick-buttons-yes" }] }
```

If no layer provides a title for the id, the id itself is used as the label.
Shipped ids are prefixed `quick-buttons-` (`quick-buttons-yes`,
`quick-buttons-continue`, `quick-buttons-commit`, `quick-buttons-compact`)
to keep your own ids conflict-free.

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

Common operations:

- **Add** — append an entry to the topmost layer you use (global for buttons
  in every project, project for this one);
- **Remove** — delete its entry from the layer that defines it (the shipped
  `buttons.json` for the defaults). To hide a button without deleting it,
  toggle it off in the settings pane — the flag lives in `$.store` and
  survives plugin updates;
- **Reorder** — arrange the entries in your topmost layer in the desired
  order; it defines the band order;
- **Apply** — catalog edits take effect after `/reload-plugins` or a session
  restart (the folder is read in place). Visibility toggles from the settings
  pane apply instantly.

## For agents

When the user asks you to add, remove or reorder buttons, edit the catalog
files — not the plugin:

- **Never** edit the shipped `buttons.json` inside the installed plugin
  folder (`.claude/plugins/...`) — plugin updates overwrite it. Use the
  catalog layers instead.
- Pick the file by scope: `~/.claude/quick-buttons.buttons.json` for buttons
  in every project, `.claude/quick-buttons.json` in the project root for this
  project only. Create it if missing (`{ "buttons": [ ... ] }`, with
  `$schema` pointing at `buttons.schema.json` in the plugin folder).
- To **reorder shipped buttons**, list them in the topmost layer as id-only
  entries: `{ "id": "quick-buttons-compact" }` — definitions come from the
  lower layer automatically.
- To **hide a shipped button**, make it id-only too and rely on the settings
  pane toggle (`$.store`) — a hidden flag survives plugin updates.
- Tell the user to run `/reload-plugins` (or restart the session) after you
  edit any catalog file.

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
the selected completion sound plays. The 🔔/🔕 button in the band or the 🔊
row in the settings pane toggles sound on/off (persisted in `$.store`); the
🔊 picker in the settings pane chooses *which* sound plays — selecting an
entry plays it immediately as a preview.

**Sounds are auto-discovered:** every `.wav`, `.mp3`, `.ogg`, `.flac` or
`.aiff` file in the plugin's `assets/` folder becomes a picker entry, labeled
by its base name (`chime.wav` → *Chime*). A language may override the label
with a `sound<Name>` key in `locales.json` (`chime` → `"soundChime"`).
The choice is stored by sound id, so removing a file simply falls back to
the shipped `chime.wav`.

On Windows, `$.audio.play` has no player, so the mod plays the file by
spawning a PowerShell `MediaPlayer` (decodes both wav and mp3). On macOS the
built-in `$.audio.play` (afplay) is used. On Linux a detached cascade of
standard players is spawned — mp3-capable first (`mpg123` → `ffplay` →
`mpv`) for mp3 assets, `paplay` → `aplay` → `pw-play` for the rest. In WSL
the chosen file plays through `powershell.exe` and WSL interop, falling back
to the Windows system sound if that fails.

## Setup

Options: `language` and `show_settings` (both in `/config`). Everything else
works out of the box. Requires Claude Code 2.1.287+ (mods). Draw on the
`terminal` and `desktop` surfaces; nothing draws under `claude -p`, the Agent
SDK, or cloud sessions — that is platform behavior, not a bug.
