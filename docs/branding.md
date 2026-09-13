# Desktop logo

The desktop wordmark sits above the tool tabs, aligned to the left edge of the
main container. It is 200px wide (about 59px tall), with an 8px gap below it.
This leaves the eight calculator tabs their existing width. The logo appears
from 1024px, matching the navigation's desktop breakpoint, and is hidden on
smaller screens and in print.

Both assets are transparent SVGs with a `1208 356` viewBox. Lettering is outlined
and the mascot is made of pixel-aligned vector paths; neither fonts nor embedded
bitmap images are required.

| Asset in `src/assets/branding` | Intended background | Wordmark / blue |
| --- | --- | --- |
| `vetmedcalc-logo-light.svg` | Light theme | `#172B3A` / `#007DBA` |
| `vetmedcalc-logo-dark.svg` | Dark theme | `#EFF4FB` / `#38BDF8` |

The dark asset adds a subtle exterior pixel outline around the rat and calculator
to separate them from the page. Both retain the accepted short blue stethoscope
bell and the original mascot detail colors and geometry.

`App.svelte` imports both assets so Vite resolves their URLs under the deployment
base. CSS selects the visible image from the application's `data-theme` value;
both images are available immediately when the theme toggle is used. The hidden
image is excluded from layout and the accessibility tree.

To adjust the desktop size, change `.brand-logo` in `src/app.css`. Keep `height:
auto` and the intrinsic image dimensions so the logo scales proportionally.
