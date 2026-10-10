# penbind

Map an active-pen / Bluetooth pen **button** to desktop actions on Linux — works on
any desktop (KDE, GNOME, …), because it reads the pen's input device directly
instead of relying on desktop shortcuts.

Built for the **Dell Active Pen PN579X** (whose top button, over Bluetooth, sends
`Super+F20` / `Super+F19` / `Super+F18` for single / double / long-press), but it is
**model-agnostic**: `penbind learn` captures whatever keys *your* pen sends, so it
adapts to other pens that use different codes.

## Why a daemon (and not just a desktop shortcut)?

The pen's top button also emits `KEY_POWER`, which makes the laptop **sleep** before
any shortcut can fire. penbind **grabs** the input device, so those keys never reach
logind/your desktop — no more accidental sleep — and penbind runs your action itself.

## Install

```sh
git clone <this repo>   # or copy the folder
cd penbind
./install.sh
```

The installer:
- installs `python3-evdev`,
- copies `penbind` to `~/.local/bin`,
- adds a `udev` rule (`uaccess`) so you can read the pen **without** joining the
  `input` group or logging out,
- installs a `systemd --user` service.

## Use

```sh
penbind pair        # optional: pair the pen over Bluetooth
penbind learn       # press single / double / long when prompted, then pick actions
systemctl --user enable --now penbind   # run it in the background
penbind status      # see mappings + connection state
penbind configure   # change actions later (then: systemctl --user restart penbind)
```

## Preset actions

`penbind list-actions` prints them. Current set:

| name | command |
|------|---------|
| `none` | (disabled) |
| `open-rnote` | `flatpak run com.github.flxzt.rnote` |
| `screenshot` | first of `spectacle` / `gnome-screenshot` / `flameshot` / `grim` |
| `lock-screen` | `loginctl lock-session` |
| `volume-up` / `volume-down` / `mute` | `wpctl …` |
| `media-playpause` | `playerctl play-pause` |
| *custom command* | anything you type |

## How it works

- Config: `~/.config/penbind/config.json` (device matcher + per-gesture trigger key
  and action). Editable by hand.
- Device match: by USB/BT `vendor:product` (locked in during `learn`) and/or a name
  regex — so it keeps working across reconnects and ignores your other keyboards.
- The pen distinguishes single/double/long itself (different keys), so there's no
  timing logic. If a pen sends the *same* key for several gestures, `learn` warns you.

## Notes / troubleshooting

- **`penbind learn` finds nothing** → the pen idle-disconnects to save battery; press
  the top button once to wake it, then re-run.
- **Permission denied on the device** → the `uaccess` rule applies when the device is
  *added*; disconnect/reconnect the pen once after installing, or run `penbind learn`
  with `sudo` once.
- **Action doesn't launch a GUI app** → the daemon injects `WAYLAND_DISPLAY`; if your
  app still won't start, run it from `penbind run` in a terminal to see errors.
- **Different pen model** → just run `penbind learn`; set `PENBIND_NAME_GLOB` before
  `./install.sh` if the udev name match needs to differ from `*Active Pen*`.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
