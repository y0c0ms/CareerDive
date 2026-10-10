# Profile README snippet

Paste this into the `y0c0ms/y0c0ms` profile README:

```markdown
[![Deep Diver](https://y0c0ms.github.io/CareerDive/preview.gif)](https://y0c0ms.github.io/CareerDive/)
```

Notes:

* The image is a linked preview: clicking it opens the game. GitHub profile Markdown cannot force a new tab (no `target="_blank"`), so a plain link opens in the same tab. Use middle-click or Ctrl/Cmd-click to open it in a new one.
* `preview.gif` and `preview.png` are served from GitHub Pages, so the repo's Pages site must be enabled for the image to show up.
* Regenerate both with `node tools/make-preview.cjs` after art changes.
