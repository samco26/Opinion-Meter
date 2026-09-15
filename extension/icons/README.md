# Extension icons

The owner supplied `icon-10-1-cream.svg` and `icon-10-2-grey.svg` on 15 September 2026. `cream.svg` and `grey.svg` preserve their rendered shapes and colours; export metadata is omitted. PNGs are rasterized from these vectors at 16, 32, 48 and 128 pixels, and committed so builds need no image dependency. `icon*.png` is the cream compatibility fallback; `grey*.png` is the dark variant.

All four packages use these files. Safari declares `icon_variants` at both extension and toolbar level; older Safari falls back to cream. Firefox declares `action.theme_icons` (its `light` property means light toolbar **text**, so points to grey). Chrome/Edge and their derivatives use cream: native variant support is not assumed across our supported Chromium versions. No website theme detection or extra permissions are needed.

References: [Apple support](https://developer.apple.com/documentation/safari-technology-preview-release-notes/stp-release-204), [Firefox theme icons](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/action#theme_icons), [Chromium's feature-gated variants](https://chromium.googlesource.com/chromium/src/+/HEAD/extensions/common/manifest_handlers/icon_variants_handler.cc).
