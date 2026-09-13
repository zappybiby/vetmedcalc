# Desktop logo

The 160px wordmark floats in the existing blank space to the left of the patient
weight panel, just below the tool tabs. It uses absolute positioning within a
relative wrapper around the weight panel, so it contributes no width or height
to the page layout. Its left edge follows the centered 1040px calculator content
area, aligning with the medication and result cards. The offset becomes zero
when the available width is smaller than 1040px.

The tabs retain their original size, spacing and centering;
the patient field and calculators keep their original positions.

The logo appears from 1024px and is hidden in print and on smaller screens. It
also hides with the patient panel in CPR batch mode, keeping the label-entry
area clear.

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
The `.desktop-brand` absolute positioning must be retained so image sizing never
moves the surrounding interface.
