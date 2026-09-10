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
| Ins / outs | Shared period, rate/total choice, signed net balance and a compact fluid-in/urine-out comparison table | Shared headings and choice controls; preserve case-sensitive units independently of uppercase labels. |
| Tube Feeding | Interval target, calorie and daily references, continuous rate, formulas | Remove redundant Inputs/Administration target headings and the outer result card; keep the actual target/reference cards with shared padding. |
| Food calc | Compact full-width table, food names/can sizes, practical portions plus exact values, species/custom input, copyable feeding notes | Use compact rows and shared type/borders; keep per-food note actions easy to find without adding a button row on mobile. |
| KPhos/KCl | Bag/CRI modes, optional targets, added/total switch, separate fluid sources, additive composition with +/= and highlighted total | Remove redundant setup headings and their column; center Mode controls, enlarge Added/Total, use restrained bold instruction values and readable component values, and put all-source delivery below the composition diagram. |
| Blood transfusion | Interval schedule table, aligned numeric columns, cumulative volume, expandable summary | Remove the redundant Inputs heading; use shared labels/meta, case-sensitive units and theme-aware table rules. |
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
| Field label | `ui-label` | 12px, heavy weight matching CRI result labels, uppercase, restrained tracking. |
| Strong label / section heading | `ui-label-strong`, `ui-section-title` | 12px, heavy weight, uppercase. |
| Instruction prose | `ui-instruction` | 14px, 15px from `sm`, relaxed leading. |
| Inline instruction value | `ui-statement-value` | 18px, 22px from `sm`; prominent values within a sentence. |
| Primary result | `ui-result-value` | 18px, 26px from `sm`; heavy, tightly tracked, tabular numbers. |
| Formula | `ui-formula` | 12px monospace at all widths, with wrapping and compact line height. |
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

## Validation

The original production UI and the revised UI were both reviewed across all
eight tabs. The revised browser review covers 60 full-page screenshots: light
and dark themes at 1440px desktop and 384px mobile, with populated results and
expanded calculation disclosures. Alternate states include Cat foods, KPhos Bag
mode, a phosphate warning, two CPR batch patients plus the trailing blank row,
CRI's custom-drug fields with wrapped concentration labels, Ins/Outs rate entry,
and Food Calc's selectable note fallback.
Long food names, numeric units, warning emphasis and the batch controls remain
readable. Each tool retains its own useful layout.

Visual review found and corrected uneven Drug in bag input alignment, KPhos
target input alignment, and crowded desktop KPhos composition groups. Focused
geometry assertions now cover these cases. Theme tests use the actual toggle,
keeping the page and its icon in sync during screenshot capture.

### Closer CRI typography and spacing audit

The reference tab also needs a deliberate hierarchy. Labels and supporting text
remain 12px; ordinary inputs remain 13px on mobile and 14px from `sm`; instruction
prose remains 14/15px. Prominent inline and standalone values now use whole-pixel
18/22px and 18/26px scales, replacing near-duplicate fractional sizes. The shared
patient-weight field retains its separate emphasis.

The substantive readability fix is formula text: formerly 11/11.5px, now 12px in
CRI, Drug in bag and Tube Feeding. CRI's input, instruction, result-cell and
calculation-disclosure padding now use the shared 10/12px inset, aligning their
outer heading gutters. Equivalent calculation disclosures use the same inset;
nested formula rows retain their compact local spacing.

Card borders were already consistently 1px with 8px radii. Inputs and inset cards
have distinct shared border/surface roles, so those differences remain. Ordinary
CRI label-to-input gaps remain 6px. The custom-drug grid now aligns controls when
labels wrap and gives the dose field enough desktop columns to display its value.
Tube Feeding also aligns its controls when the diet-density label wraps, avoiding
uneven input heights caused by stretched grid fields.
The blood-transfusion summary also gets a wider desktop column gap
so one value does not read as part of the next label.

Screenshot checks cover heading alignment, readable formula sizes, populated
card-shell consistency, custom-input alignment/width and summary-column separation.

The `Calculator quality checks` GitHub Actions workflow runs Svelte/TypeScript
checks, the production build and the complete Chromium Playwright suite. The
suite covers calculations, workflows, responsive layouts from 384px to 1920px,
text contrast in both themes, and CRI/CPR print-label fitting. An initial full run
passed 46 tests; the optional `LABEL_FIT_OPTIMIZER` test was intentionally skipped.
The PR links the final run for the reviewed revision. Screenshots and the HTML
test report are retained in its `vetmedcalc-quality-review` artifact for 14 days.

Run `npm run check:commit` for later changes. Reinspect screenshot artifacts when
styles change; the screenshots are human-review evidence, not pixel baselines.
Calculation formulas, rounding and dedicated print renderers are unchanged. Food
Calc adds only note formatting and clipboard/fallback interaction to its existing
calculation workflow.


## Requested workflow refinements

The follow-up is split into nine feature commits, matching the requested changes:

1. Tube Feeding: remove Inputs and Administration target headings and the extra result wrapper.
2. Food Calc: replace the card grid with a compact table and per-food Copy note actions. Notes include patient context, food/can energy, interval, practical portion, calories and the calculated amount before rounding. Clipboard denial reveals selectable text; edits clear stale copy feedback.
3. KPhos: remove Preparation, Fluid bag and CRI setup headings plus the unused heading gutter.
4. KPhos readability: separate mixing/running instructions, use 16/18px bold key values and 13px component values, and enlarge Added/Total to 36px high with 14px text.
5. KPhos delivery: show phosphate and potassium per-kg hourly rates below all composition groups, explicitly labeled as totals from all sources. They are not mislabeled as CRI-only delivery.
6. KPhos mode: center Bag/CRI and use a larger, bold Mode caption.
7. Blood Transfusion: remove Inputs and its extra heading gap.
8. Shared field labels: match CRI's Delivers/Lasts emphasis through the common ui-label role.
9. Ins/Outs: one shared-period entry area and one net-balance comparison table, retaining every original total, rate, weight rate and signed balance.

Workflow tests cover copied note contents, clipboard fallback, positive/negative/zero
fluid balances, mode changes, centered mode controls and all-source electrolyte
semantics. The PR links the current quality run and screenshot artifacts.
