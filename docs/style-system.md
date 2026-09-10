# VetMedCalc visual style

CRI is the reference for visual language: typography, emphasis, surfaces, borders,
controls, and spacing. Each tool keeps the layout that suits its task.

## Audit and decisions

Reviewed the eight live tabs and their Svelte components against master
`fbb9a46aa6a82bc4f864721d1a06cd9f729106b8`. The site already shares a sans-serif
font family and most color tokens. The perceived font/theme drift comes primarily
from local weight, size, tracking, capitalization, padding, and emphasis choices.

| Tab | Keep because it serves the task | Normalize to the CRI visual language |
| --- | --- | --- |
| CRI calculator | Instruction sentence, emphasized volumes/rate, three summary metrics, calculation disclosure | Extract its active styles into shared roles so later tabs can reuse them. Keep its composition and numeric precision. |
| Drug in bag | Separate draw volume/mass, bag reference, delivered dose, rounding explanation | One primary-result scale; compact reference values; consistent label gaps; normal-case units and concentration chip. |
| Ins / outs | Three input/output/balance groups, aligned dense rows, signed balance, rate/total choice | Shared headings and choice controls; preserve case-sensitive units independently of uppercase labels. |
| Tube Feeding | Interval target, calorie and daily references, continuous rate, formulas | Shared headings and primary value; CRI card padding/gaps; neutral continuous-rate divider; consistent supporting text. |
| Food calc | Dense comparison grid, food names/can sizes, practical portions plus exact values, species and custom input | Remove blue boxes around ordinary results; use shared choice/button styles; readable compact metadata; theme-aware row separators. |
| KPhos/KCl | Bag/CRI modes, optional targets, added/total switch, separate fluid sources, additive composition with +/= and highlighted total | Shared labels, headings and normal-weight controls; CRI instruction typography; shared inset cards and warning treatment; remove duplicated local theme rules. |
| Blood transfusion | Interval schedule table, aligned numeric columns, cumulative volume, expandable summary | Shared headings/labels/meta, case-sensitive units, theme-aware table rules. |
| CPR labels | Species choices, drug concentration/dose/volume relationships, ET estimate/range; batch entry and keyboard flow | Shared choice controls, headings and notes; consistent card padding and gaps; ordinary button casing. |

The largest drift was in KPhos/KCl, Food calc, and Tube Feeding. Ins / outs was
already close and needs only restrained adjustments. Different column counts,
table structures, compact result rows, and disclosure content are intentional.

## Shared roles

Use the classes in [app.css](../src/app.css) before inventing a local visual style.

| Role | Class | Intended use |
| --- | --- | --- |
| Tool spacing | `ui-tool-stack` | Grid container with 8px gaps, 12px from `sm`; define columns locally. |
| Card padding | `ui-card-padding` | 10px, 12px from `sm`; does not set layout or surface. |
| Card / inset | `ui-card`, `ui-inset` | Shared theme-aware surface, border, 8px corners and shadow. |
| Field label | `ui-label` | 12px, semibold, uppercase, restrained tracking. |
| Strong label / section heading | `ui-label-strong`, `ui-section-title` | 12px, heavy weight, uppercase. |
| Instruction prose | `ui-instruction` | 14px, 15px from `sm`, relaxed leading. |
| Inline instruction value | `ui-statement-value` | CRI's prominent values within a sentence. |
| Primary result | `ui-result-value` | CRI summary scale: 1.12rem, 1.6rem from `sm`; heavy, tightly tracked, tabular numbers. |
| Comparison-row result | `ui-row-value` | Compact 14px bold value; avoid enlarging every table/list result. |
| Supporting text | `ui-meta`, `ui-meta-compact` | 12px; relaxed or compact line height according to density. |
| Unit suffix | `ui-unit` | 12px semibold, normal case and tracking. |
| Divider | `ui-rule`, `ui-table-rows` | CRI result-divider color for both themes; border placement stays local. |
| Choice | `ui-choice` | Shared selectable control; `aria-pressed="true"` or `is-selected` styles the active state. |
| Action | `ui-button` | Actions such as printing or focusing an input. |
| Alert geometry | `ui-alert` | CRI padding, border, radius and typography; retain the appropriate severity colors. |

The older `ui-metric` helpers are not the current CRI summary scale. Use
`ui-result-value` for that role. Use `normal-case` spans for units embedded in an
uppercase caption; do not turn `mL`, `mg/mL`, `mEq/L`, `hr`, or `kg` into capitals.

## Boundaries that prevent future drift

- Keep layout CSS local: columns, responsive stacking, intrinsic widths and
  composition operators can differ between tools.
- Reuse role classes for typography, surfaces, fields and actions. Change a shared
  role centrally when all equivalent elements should change together.
- Keep prominent values, row values and supporting figures distinct. Do not apply
  the primary-result size to every number in Food calc or Ins / outs.
- Use accent color for selection or a meaningful total, such as KPhos's final
  mixture. Routine food portions do not need selection-colored boxes.
- Preserve clinical warnings, exact values, rounding explanations and units.
  A style pass does not change doses, formulas, precision or workflow.
- Keep the dedicated CRI/CPR print renderers and label geometry separate from
  screen styling.

## Validation and remaining review

The existing production website was inspected in the browser across all eight
tabs, including populated results and CPR batch mode, with light-theme spot
checks. Responsive rules were reviewed in source. Svelte diagnostics, TypeScript
configuration checks, and the production build passed for the patch. The diff
also received an independent source review.

The local preview service was unavailable, so the revised UI has **not** received
browser verification, and the Playwright suite has **not** been run. Two existing
KPhos style assertions were updated to reflect the shared instruction and label
roles rather than its former 17px prose and heavy target labels.

Before merging, run the existing `check:commit` gate and visually review the
populated tabs in both themes at desktop and narrow mobile widths. Pay particular
attention to long food names, KPhos target labels and composition cards, and batch
CPR rows. This branch is a reviewable style pass, not a production deployment.
