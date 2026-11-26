# dsh-desktop-ui-zoom

Restore **whole-interface zoom** in the DeepSeek Harness desktop window: scale `#root` with CSS `zoom` so text, icons, spacing, sidebar, and buttons scale together instead of changing font sizes alone.

[English](README.md) | [中文](README.zh.md)

## Why

Starting from `0.2.2`, the DSH desktop runtime binds `Cmd/Ctrl + =` and `Cmd/Ctrl + -` as fixed shortcuts that only adjust **text / code / terminal** font sizes, while the new desktop shell has no `View -> Zoom In` menu item and never calls `setZoomFactor`. Window-level zoom lost its built-in entry point — this plugin brings it back.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Zoom in one step | `Cmd/Ctrl` + `Option/Alt` + `=` |
| Zoom out one step | `Cmd/Ctrl` + `Option/Alt` + `-` |
| Reset to 100% | `Cmd/Ctrl` + `Option/Alt` + `0` |

- Steps: `100% / 110% / 120% / 130% / 140% / 150% / 160% / 175% / 200%` (default `120%`).
- Persisted in `localStorage` under `dsh-desktop-ui-zoom.level`.
- Registered as fixed shortcuts in **Settings -> Shortcuts**.
- A centered top toast (`Interface zoom 130%`) appears for 1.2s on each change (and on startup when not at 100%).
- Built-in `Cmd + =` / `Cmd + -` font-size shortcuts keep working and can be combined with interface zoom.

## Install

In DeepSeek Harness: open **Plugins -> Add**, then enter one of:

- npm package (after publishing): `dsh-desktop-ui-zoom`
- GitHub repository: `github:BGMer7/dsh-desktop-ui-zoom`

Reload (`Cmd+R`) or restart the app after installing.

## How it works

- `#root { zoom: var(--dsh-desktop-ui-zoom, 1) }`: reflows the layout to the zoomed viewport so edge-aligned and `position: fixed` elements stay anchored.
- **Frame metric shim**: `getBoundingClientRect()` on the `ui-layout` frame element is divided by the zoom factor so `viewportWidth` matches its layout width, keeping the right panel width and resize handle aligned.
- **Portals stay unscaled**: menus and dialogs mounted on `document.body` stay at 100% and use visual coordinates directly so they align with zoomed anchors.
- **Known limitation**: `100vh` / `100vw` max-height constraints inside zoomed elements do not scale with `zoom`; at `>= 130%`, effective viewport width may drop below `1024px` and auto-collapse the left sidebar to its rail (standard responsive behavior).

## License

[MIT](LICENSE)
