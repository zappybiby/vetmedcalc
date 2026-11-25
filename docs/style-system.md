# VetMedCalc visual style

CRI Calculator is the reference for typography, spacing, surfaces and result
hierarchy. Multi-Drug CRI supplies the pill-switch treatment. Tools may have different
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
  keep units next to their inputs. Expanding calculations must not move the inputs.
- Multi-Drug CRI places bag settings above a list that starts with one medication
  row. Add medication appends a row, and custom name and concentration fields share
  a line with the medication selector. Rate is the default calculation mode.
  Duration/Rate and pump precision use matching segmented toggles.
- Multi-Drug CRI groups the removal instruction, pump rate and duration above
  alternating medication result rows. Each row shows the bag concentration,
  delivered dose and volume to add. Removal rounds up to a whole mL independently
  of pump precision. Concentration, dose and duration use the entered bag volume.
  On phones, results appear after Calculate, and editing inputs clears them until
  Calculate is pressed again.
- Ins/Outs uses the same label/control spacing as CRI, with the mode switch in a
  separate field rather than changing the Fluid in label height.
- KPhos orders inputs as preparation mode, electrolyte targets with calculation
  modes, main fluid, then CRI duration/rate/diluent. Phosphate and potassium use
  matching Added to Bag / Total in Bag toggles. Phosphate defaults to Total and
  potassium to Added. Instructions and total delivery precede composition details.
  Phones omit the composition diagram and place CRI diluent on its own line.
- Tube Feeding shows the interval and per-feeding volume in Intermittent mode.
  Continuous mode shows a prominent rate rounded to one decimal place.
  The selected feeding result sits beside Quick reference on desktop and above it
  on phones.
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

Run `npm run check:commit` and `git diff --check` from the WSL checkout.
Reinspect populated screenshots after style changes. Use the screenshots as review evidence.
Do not add brittle tests for each spacing or markup choice during design iteration.
