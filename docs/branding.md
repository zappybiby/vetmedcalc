# Desktop logo

The desktop wordmark uses the free left margin beside independently centered
tool tabs. From 1360px it scales with the available margin: roughly 140px wide
(about 41px tall) at a 1440px viewport, up to a maximum of 160px. Equal flexible
columns on either side of the tabs keep the navigation centered regardless of
the logo's width.

The header can use up to 1600px, while the calculator content keeps its existing
width. Compact desktop tab padding leaves a clear gap between the logo and tabs.

Between 1024px and 1359px, the 160px logo sits on its own row above the tabs with
an 8px gap. It is hidden on smaller screens and in print.

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

To adjust the desktop size, change `.brand-logo` and the wide-screen
`.desktop-brand .brand-logo` maximum width in `src/app.css`. Keep `height: auto` and the intrinsic
image dimensions so the logo scales proportionally. Recheck clearance at 1360px
if the tab labels or their padding change.
