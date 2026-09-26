# VetMedCalc visual style

CRI Calculator is the reference for typography, spacing, surfaces and result
hierarchy. Drug in Bag supplies the pill-switch treatment. Tools may have different
layouts, but equivalent controls and content should use the same shared roles.

## Shared roles

Use `src/app.css` before adding local presentation styles.

| Role | Shared class or component | Treatment |
| --- | --- | --- |
| Tool spacing | `ui-tool-stack` | 8px gaps, 12px from 640px; columns remain local. |
| Card padding | `ui-card-padding` | 10px, 12px from 640px. |
| Card / inset | `ui-card`, `ui-inset` | Theme-aware surface, border and 8px corners; insets have no shadow. |
| Field | `ui-field`, `ui-field-heading` | 6px label-to-control gap; align adjacent controls when labels wrap. |
| Label / heading | `ui-label`, `ui-label-strong`, `ui-section-title` | 12px, heavy, uppercase, restrained tracking. |
| Input / select | `field-control`, `field-select` | 34px minimum height and 14px type on desktop; 44px and 16px below 768px, with compact 40px CRI and medication inputs. |
| Two-option toggle | `SegmentedToggle.svelte`, `ui-segmented` | Shared segmented pill with both options visible; clicking anywhere switches state. 34px desktop / 36px phone. Theme toggle retains its icon design. |
| Action | `ui-button`, optional `ui-action-quiet` | Quiet actions for adding/removing medications and copying notes. |
| Instruction | `ui-instruction` | 14px / 15px prose with relaxed leading. |
| Inline key value | `ui-statement-value` | 18px / 22px, emphasized within a sentence. |
| Primary result | `ui-result-value` | 18px / 26px, heavy tabular numbers. |
| Compact row result | `ui-row-value` | 14px bold; useful in dense tables. |
| Supporting text | `ui-meta`, `ui-meta-compact` | 12px with normal or compact leading. |
| Units | `ui-unit` | 12px semibold, normal case and tracking. |
| Formula | `ui-formula` | 12px monospace, wrapping within its container. |
| Disclosure | `ToolDisclosure.svelte` | CRI padding, chevron, divider, keyboard focus and at least a 44px summary. |

The patient-weight input retains its own emphasis. Use normal-case spans for units
inside uppercase labels; never uppercase case-sensitive units such as mL or mEq/L.

## Layout contract

- At 1920x1080, representative populated states with disclosures expanded fit
  without vertical scrolling. Shorter desktop windows may scroll vertically.
- Phones must not require horizontal scrolling, including inside result tables.
  Review 320px through 430px widths, both themes, long names and alternate modes.
- Mobile navigation uses 40px buttons and the weight label shares its input row.
  CRI calculations use a flat divided list; delivery has stronger emphasis than
  runtime and final concentration.
- Larger fields and touch targets are intentional on phones. Do not shrink text
  or hide clinical values just to force desktop density onto a narrow screen.
- Desktop input groups use capped widths instead of stretching across each card:
  roughly 12rem per numeric field, with extra room for names and medication lists.
  Match the overall work area to the tool's content. Center compact form groups
  when results need a wider card, align supporting text with those groups, and
  keep units next to their inputs. Drug in Bag settings and medication cards
  share one column width. Expanding calculations must not move the input column.
- Drug in Bag uses medication result rows followed by pump rate and duration.
  Its labeled Add medication action sits below the medication list.
  Rate is the default calculation mode; Duration/Rate and pump precision use
  matching segmented toggles. Each medication result and calculation step
  has its own inset card. Removal rounds up to a whole mL independently of pump
  precision; dose and runtime calculations retain the entered nominal bag volume.
  On phones, bag settings start collapsed, medication cards are added explicitly,
  and results appear after Calculate. Editing inputs hides the previous results
  until Calculate is pressed again.
- Ins/Outs uses the same label/control spacing as CRI, with the mode switch in a
  separate field rather than changing the Fluid in label height.
- KPhos orders inputs as preparation mode, electrolyte targets with calculation
  modes, main fluid, then CRI duration/rate/diluent. Phosphate and potassium use
  matching Added to Bag / Total in Bag toggles. Phosphate defaults to Total and
  potassium to Added. Instructions and total delivery precede composition details.
  Phones omit the composition diagram and place CRI diluent on its own line.
- Tube Feeding places administration and quick-reference results side by side
  on desktop and stacks them on phones.
- Blood Transfusion keeps a desktop table and stacks labeled values by interval
  on phones. CPR batch entry gives patient names a full row on phones.
- Food Calc remains a compact table, including space for touch-sized note actions
  and a selectable note when clipboard access is unavailable.

## Boundaries

Keep calculation logic, numerical precision, clinical warnings, accessible names
and dedicated print layouts separate from screen styling. Reuse shared components
for repeated UI; keep only task-specific columns and responsive stacking local.
Meaningful differences in table density and result hierarchy are intentional.

## Validation

Run `npm run check`, `npm run build`, `git diff --check` and `npm run test:layout`
from the WSL checkout. The existing Playwright suite covers workflows, calculations,
responsive geometry, theme contrast and print-label fitting. Reinspect populated
screenshots after style changes; screenshots are review evidence, not pixel baselines.
Do not add brittle tests for each spacing or markup choice during design iteration.
