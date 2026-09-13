# Desktop logo

The desktop wordmark is 200px wide (about 59px tall). From 1360px it sits to the
left of the tool tabs in a shared header band. The header can use up to 1600px,
while the calculator content keeps its existing width. Slightly tighter desktop
tab padding and a compact header inset preserve room for the densest tools.

Between 1024px and 1359px, the logo sits on its own row above the tabs with an
8px gap. It is hidden on smaller screens and in print.

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
