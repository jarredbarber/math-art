# math-art

Small collection of single-file, browser-based generative-art experiments.

## Spiral Knights

A turn-based pattern generator. Each color takes turns placing a "knight" (configurable K×K attack mask) on the lowest-numbered empty square of a counter-clockwise spiral-numbered N×N grid that is not attacked by a different color. Continues until no more pieces can be placed.

**▶ [Run it in your browser](https://jarredbarber.github.io/math-art/spiral-knights.html)**

Features:
- Configurable colors, board size, and move mask
- Preset masks (knight, king, plus, X, camel, space invader, …) or paint your own
- Progressive rendering with progress bar and stop button
- Pan / zoom (drag + scroll)
- Export to PNG (transparent background)
- State persisted in localStorage

Inspired by [this video](https://www.youtube.com/watch?v=UiX4CFIiegM).
