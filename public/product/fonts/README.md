# Bundled Inter font

Downloaded 2026-11-12 from the [official Inter repository](https://github.com/rsms/inter): `docs/font-files/InterVariable.woff2` and `LICENSE.txt` (stored here as `Inter-LICENSE.txt`). Served locally; no runtime third-party font request.

SHA-256 of `InterVariable.woff2`: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.

Retain the accompanying license in client copies. The variable font supports the normal-style weight range used by the UI. Review layout and screenshot baselines when replacing it.

The face and UI type tokens live in `src/styles/typography.css`; `index.html` preloads this same-origin WOFF2. Browser controls inherit the shared font. PDF export embeds its own Roboto through pdfmake and does not load this WOFF2.
