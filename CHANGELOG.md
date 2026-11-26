# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-26

First public release.

### Added

- Whole-window zoom for the DeepSeek Harness desktop app: nine steps from `100%` to `200%`, default `120%`.
- Fixed shortcuts `Cmd/Ctrl + Option/Alt + =` (zoom in), `-` (zoom out) and `0` (reset), registered with the shortcut service so they appear in **Settings → Shortcuts**.
- A short toast above the window shows the level and hides itself after 1.2 s; it also greets with the current level once after a reload when the level is not `100%`.
- The level persists in `localStorage` under `dsh-desktop-ui-zoom.level`.
- Layout metric shim: the layout frame's `getBoundingClientRect()` is divided by the zoom factor so `viewportWidth` matches its real layout width.

### Fixed

- The right panel no longer opens at ~54% of the window and its divider is draggable again — caused by DSH measuring a zoomed frame in visual pixels.
- Full-screen portals mounted on `document.body` (Settings, plugin manager) now scale with the level instead of staying at `100%`.
- Nested modal portals are detected structurally (`role="presentation"` containing `role="dialog"`) and re-checked after mount, so a panel that animates in is still picked up.

### Known limitations

- `100vh` / `100vw` based `max-height` constraints do not scale with `zoom`; dock-style floating panels may overflow slightly.
- Effective viewport width drops as the level rises, so at **130% or more** (on a 1280 px-wide window) DSH's own responsive breakpoint auto-collapses the left sidebar into its icon rail.

[0.1.0]: https://github.com/BGMer7/dsh-desktop-ui-zoom/releases/tag/v0.1.0
