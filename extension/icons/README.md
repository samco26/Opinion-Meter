# Extension icons

The owner supplied the gauge icon on 17 September 2026 (`Opinion Meter Extension Icons.zip`, with store tiles and screenshots). `gauge.svg` keeps its geometry and colours — umber `#5C4433` ground, eucalypt `#7FB069`, bone `#DCD2BF` and rust `#C45A2C` arcs, a cream `#F3E7D3` needle — with the 28 px rounded corners the owner asked for (the supplied file had 23). `render.ps1` draws that geometry with GDI+ at 16, 32, 48 and 128 pixels (no image tooling needed on the machine), and the PNGs are committed so builds need no image dependency.

Both sets are this one icon now: `icon*.png` and `grey*.png` are identical. The build still declares the two sets (Safari's `icon_variants`, Firefox's `theme_icons`), so a toolbar-specific variant can return by rendering a second colouring into `grey*.png`.

Palette (from the owner's store pack): umber `#5C4433`, espresso `#2B1B12`, oat `#E8DCC4`, eucalypt `#7FB069`, bone `#DCD2BF`, rust `#C45A2C`, cream `#F3E7D3`. The menu (`popup.html`) uses it too.
