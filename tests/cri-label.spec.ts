import { expect, test } from '@playwright/test';
import { MEDICATIONS, getDefaultMedicationDoseUnit } from '../src/lib/definitions';
import type { DoseUnit, MedicationDef } from '../src/lib/definitions/types';
import { buildCriLabel, CRI_LABEL_PRINT_STYLES, renderCriLabelMarkup } from '../src/lib/labels/criLabel';
import { buildCRIViewModel } from '../src/lib/viewmodels/criViewModel';

const LABEL_TEST_DATE = new Date(2026, 5, 14, 2, 0);

type LabelScenario = {
  id: string;
  enableDilution: boolean;
  weightKg: number;
  durationHr: number;
  rateMlHr: number | '';
  desiredDose?: number;
  doseUnit?: DoseUnit;
};

const LABEL_SCENARIOS: readonly LabelScenario[] = [
  {
    id: 'standard-dilution',
    enableDilution: true,
    weightKg: 22.5,
    durationHr: 12,
    rateMlHr: 8,
  },
  {
    id: 'low-rate-small-patient-dilution',
    enableDilution: true,
    weightKg: 4.2,
    durationHr: 8,
    rateMlHr: 1.5,
  },
  {
    id: 'high-volume-large-patient-dilution',
    enableDilution: true,
    weightKg: 38,
    durationHr: 18,
    rateMlHr: 12,
  },
  {
    id: 'stock-only',
    enableDilution: false,
    weightKg: 22.5,
    durationHr: 12,
    rateMlHr: '',
  },
] as const;

const METOCLOPRAMIDE_STRESS_SCENARIOS: readonly LabelScenario[] = [
  0.5,
  0.75,
  1,
].flatMap((desiredDose) =>
  [12, 18, 24].flatMap((durationHr) =>
    [
      { weightKg: 3.5, rateMlHr: 1.5 },
      { weightKg: 12, rateMlHr: 4 },
      { weightKg: 25, rateMlHr: 8 },
      { weightKg: 45, rateMlHr: 12 },
    ].map(({ weightKg, rateMlHr }) => ({
      id: `metoclopramide-${desiredDose}-mg-kg-day-${durationHr}h-${weightKg}kg`,
      enableDilution: true,
      weightKg,
      durationHr,
      rateMlHr,
      desiredDose,
      doseUnit: 'mg/kg/day' as const,
    })),
  ),
);

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function doseFromMgPerKgHr(valueMgPerKgHr: number, unit: DoseUnit): number {
  switch (unit) {
    case 'mg/kg/day':
      return valueMgPerKgHr * 24;
    case 'mcg/kg/hr':
      return valueMgPerKgHr * 1000;
    case 'mcg/kg/min':
      return (valueMgPerKgHr * 1000) / 60;
    case 'mg/kg/min':
      return valueMgPerKgHr / 60;
    case 'mg/kg/hr':
    default:
      return valueMgPerKgHr;
  }
}

function fallbackDoseForUnit(unit: DoseUnit): number {
  switch (unit) {
    case 'mcg/kg/min':
      return 0.1;
    case 'mcg/kg/hr':
      return 3;
    case 'mg/kg/min':
      return 0.1;
    case 'mg/kg/day':
      return 12;
    case 'mg/kg/hr':
    default:
      return 0.5;
  }
}

function representativeDose(medication: MedicationDef, unit: DoseUnit): number {
  if (!medication.criDoseRange) {
    return fallbackDoseForUnit(unit);
  }

  const { minMgPerKgHr, maxMgPerKgHr } = medication.criDoseRange;
  const midpointMgPerKgHr = (minMgPerKgHr + maxMgPerKgHr) / 2;
  return Number(doseFromMgPerKgHr(midpointMgPerKgHr, unit).toFixed(4));
}

function renderPresetLabel(medication: MedicationDef, scenario: LabelScenario): string {
  const doseUnit = scenario.doseUnit ?? getDefaultMedicationDoseUnit(medication.id);
  const viewModel = buildCRIViewModel({
    enableDilution: scenario.enableDilution,
    p: { weightKg: scenario.weightKg, species: 'dog', name: '' },
    med: medication,
    desiredDose: scenario.desiredDose ?? representativeDose(medication, doseUnit),
    doseUnit,
    durationHr: scenario.durationHr,
    desiredRateMlPerHr: scenario.rateMlHr,
  });

  if (!viewModel) {
    throw new Error(`Unable to build CRI label scenario for ${medication.name}.`);
  }

  const label = buildCriLabel({ medication, viewModel, patientWeightKg: scenario.weightKg, generatedAt: LABEL_TEST_DATE });
  return `
    <div
      class="cri-label-sheet"
      data-scenario="${escapeAttr(scenario.id)}"
      data-med-id="${escapeAttr(medication.id)}"
      data-med-name="${escapeAttr(medication.name)}"
    >
      ${renderCriLabelMarkup(label)}
    </div>
  `;
}

function renderPresetLabelGrid(): string {
  const presetLabels = MEDICATIONS.flatMap((medication) =>
    LABEL_SCENARIOS.map((scenario) => renderPresetLabel(medication, scenario)),
  );
  const metoclopramide = MEDICATIONS.find((medication) => medication.id === 'metoclopramide-5');
  if (!metoclopramide) {
    throw new Error('Metoclopramide preset is required for CRI label stress tests.');
  }

  const stressLabels = METOCLOPRAMIDE_STRESS_SCENARIOS.map((scenario) => renderPresetLabel(metoclopramide, scenario));
  const labels = [...presetLabels, ...stressLabels].join('');

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${CRI_LABEL_PRINT_STYLES}

          body {
            display: block;
            min-height: 0;
            padding: 16px;
          }

          .cri-label-grid {
            display: grid;
            grid-template-columns: repeat(4, 2.13in);
            gap: 16px;
            align-items: start;
          }
        </style>
      </head>
      <body>
        <main class="cri-label-grid">${labels}</main>
      </body>
    </html>`;
}

test.describe('CRI label print guardrails', () => {
  test('preset medication labels fit within the 2.13in by 2in print area', async ({ page }) => {
    await page.setViewportSize({ width: 1120, height: 4600 });
    await page.setContent(renderPresetLabelGrid());

    await expect(page.locator('.cri-label-sheet')).toHaveCount(
      MEDICATIONS.length * LABEL_SCENARIOS.length + METOCLOPRAMIDE_STRESS_SCENARIOS.length,
    );

    const violations = await page.evaluate(() => {
      const tolerance = 1.25;
      const textTolerance = 2;
      const minReadableGap = 2;
      const issues: string[] = [];

      const rectLabel = (rect: DOMRect) =>
        `left=${rect.left.toFixed(1)}, top=${rect.top.toFixed(1)}, right=${rect.right.toFixed(1)}, bottom=${rect.bottom.toFixed(1)}`;

      const verticalOverlap = (first: DOMRect, second: DOMRect) =>
        Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      const verticalGap = (first: DOMRect, second: DOMRect) => second.top - first.bottom;
      const horizontalGap = (first: DOMRect, second: DOMRect) => second.left - first.right;

      for (const sheet of [...document.querySelectorAll<HTMLElement>('.cri-label-sheet')]) {
        const medName = sheet.dataset.medName ?? 'unknown medication';
        const scenario = sheet.dataset.scenario ?? 'unknown scenario';
        const prefix = `${medName} ${scenario}`;
        const sheetRect = sheet.getBoundingClientRect();

        if (sheet.scrollWidth > sheet.clientWidth + textTolerance) {
          issues.push(`${prefix}: sheet has horizontal overflow (${sheet.scrollWidth} > ${sheet.clientWidth}).`);
        }
        if (sheet.scrollHeight > sheet.clientHeight + textTolerance) {
          issues.push(`${prefix}: sheet has vertical overflow (${sheet.scrollHeight} > ${sheet.clientHeight}).`);
        }

        const containedElements = sheet.querySelectorAll<HTMLElement>([
          '.cri-label-outer',
          '.cri-patient-block',
          '.cri-handwritten-row',
          '.cri-weight-row',
          '.cri-weight-label',
          '.cri-weight-value',
          '.cri-meta-row',
          '.cri-initials-row',
          '.cri-drug-heading',
          '.cri-heading-label',
          '.cri-drug-name',
          '.cri-clinical-boxes',
          '.cri-final-box',
          '.cri-final-value',
          '.cri-delivers-box',
          '.cri-box-label',
          '.cri-prep-section',
          '.cri-prep-row',
          '.cri-diluent-options',
          '.cri-prep-volume',
          '.cri-prep-concentration',
          '.cri-num',
          '.cri-row-label',
          '.cri-row-value',
          '.cri-date',
          '.cri-initials',
          '.cri-initials-space',
          '.cri-name-space',
        ].join(','));

        for (const element of [...containedElements]) {
          const rect = element.getBoundingClientRect();
          if (
            rect.left < sheetRect.left - tolerance ||
            rect.top < sheetRect.top - tolerance ||
            rect.right > sheetRect.right + tolerance ||
            rect.bottom > sheetRect.bottom + tolerance
          ) {
            issues.push(`${prefix}: ${element.className} escapes label bounds (${rectLabel(rect)}).`);
          }
        }

        for (const parent of [...sheet.querySelectorAll<HTMLElement>('.cri-final-box, .cri-delivers-box, .cri-prep-row')]) {
          const parentRect = parent.getBoundingClientRect();
          const children = [...parent.children] as HTMLElement[];
          for (const child of children) {
            const childRect = child.getBoundingClientRect();
            if (
              childRect.left < parentRect.left - tolerance ||
              childRect.top < parentRect.top - tolerance ||
              childRect.right > parentRect.right + tolerance ||
              childRect.bottom > parentRect.bottom + tolerance
            ) {
              issues.push(`${prefix}: ${child.className} escapes ${parent.className} (${rectLabel(childRect)}).`);
            }
          }

          for (let index = 1; index < children.length; index += 1) {
            const previous = children[index - 1].getBoundingClientRect();
            const current = children[index].getBoundingClientRect();
            if (verticalOverlap(previous, current) > tolerance && current.left < previous.right - tolerance) {
              issues.push(`${prefix}: ${children[index - 1].className} overlaps ${children[index].className}.`);
            }
            if (verticalOverlap(previous, current) > tolerance && horizontalGap(previous, current) < minReadableGap) {
              issues.push(`${prefix}: ${children[index - 1].className} is cramped against ${children[index].className}.`);
            }
          }
        }

        const textElements = sheet.querySelectorAll<HTMLElement>([
          '.cri-handwritten-label',
          '.cri-weight-label',
          '.cri-weight-value',
          '.cri-date',
          '.cri-initials',
          '.cri-heading-label',
          '.cri-drug-name',
          '.cri-box-label',
          '.cri-final-value',
          '.cri-delivers-box',
          '.cri-diluent-options',
          '.cri-prep-volume',
          '.cri-prep-concentration',
          '.cri-row-label',
          '.cri-row-value',
        ].join(','));

        for (const element of [...textElements]) {
          if (element.scrollWidth > element.clientWidth + textTolerance) {
            issues.push(`${prefix}: "${element.textContent?.trim() ?? ''}" is clipped horizontally.`);
          }
          if (element.scrollHeight > element.clientHeight + textTolerance) {
            issues.push(`${prefix}: "${element.textContent?.trim() ?? ''}" is clipped vertically.`);
          }
        }

        const blocks = [...sheet.querySelectorAll<HTMLElement>([
          '.cri-handwritten-row',
          '.cri-meta-row',
          '.cri-initials-row',
          '.cri-drug-heading',
          '.cri-clinical-boxes',
          '.cri-prep-section',
        ].join(','))];

        for (let index = 1; index < blocks.length; index += 1) {
          const previous = blocks[index - 1].getBoundingClientRect();
          const current = blocks[index].getBoundingClientRect();
          if (current.top < previous.bottom - tolerance) {
            issues.push(`${prefix}: row ${index} overlaps the previous row.`);
          }
        }

        const labelOuter = sheet.querySelector<HTMLElement>('.cri-label-outer');
        const patientRow = sheet.querySelector<HTMLElement>('.cri-handwritten-row');
        const metaRow = sheet.querySelector<HTMLElement>('.cri-meta-row');
        const initialsRow = sheet.querySelector<HTMLElement>('.cri-initials-row');
        if (labelOuter && patientRow) {
          const topEdgeGap = patientRow.getBoundingClientRect().top - labelOuter.getBoundingClientRect().top;
          if (topEdgeGap < 8) {
            issues.push(`${prefix}: patient name row is too close to the top edge.`);
          }
        }
        if (patientRow && metaRow && verticalGap(patientRow.getBoundingClientRect(), metaRow.getBoundingClientRect()) < minReadableGap) {
          issues.push(`${prefix}: patient name row is cramped against weight/date row.`);
        }
        if (metaRow && initialsRow && verticalGap(metaRow.getBoundingClientRect(), initialsRow.getBoundingClientRect()) < minReadableGap) {
          issues.push(`${prefix}: weight/date row is cramped against initials row.`);
        }

        const sheetText = sheet.textContent ?? '';
        if (/\bstock\b/i.test(sheetText)) {
          issues.push(`${prefix}: visible Stock wording detected.`);
        }
        if (/CRI syringe/i.test(sheetText)) {
          issues.push(`${prefix}: visible CRI syringe wording detected.`);
        }
        if (/\bBy:/i.test(sheetText)) {
          issues.push(`${prefix}: visible By wording detected.`);
        }
        if (/\bdose\b/i.test(sheetText)) {
          issues.push(`${prefix}: visible dose wording detected.`);
        }
        if (sheet.querySelector('.cri-by-line, .cri-line')) {
          issues.push(`${prefix}: handwritten/initials line element should not be rendered.`);
        }

        const patientSpace = sheet.querySelector<HTMLElement>('.cri-name-space');
        const initialsSpace = sheet.querySelector<HTMLElement>('.cri-initials-space');
        for (const element of [patientSpace, initialsSpace]) {
          if (!element) continue;

          const styles = getComputedStyle(element);
          if (Number.parseFloat(styles.borderBottomWidth) > 0) {
            issues.push(`${prefix}: writable header space renders an underline.`);
          }
        }

        const drugHeading = sheet.querySelector<HTMLElement>('.cri-drug-heading');
        if (!drugHeading || Number.parseFloat(getComputedStyle(drugHeading).borderTopWidth) <= 0) {
          issues.push(`${prefix}: missing separator line above CRI drug heading.`);
        }

        if (!metaRow || !initialsRow) {
          issues.push(`${prefix}: missing separate initials row.`);
        } else if (initialsRow.getBoundingClientRect().top < metaRow.getBoundingClientRect().bottom - tolerance) {
          issues.push(`${prefix}: Initials is not on its own row below weight/date.`);
        }

        if (initialsRow && sheet.querySelector<HTMLElement>('.cri-label-outer')) {
          const contentLeft = sheet.querySelector<HTMLElement>('.cri-handwritten-row')?.getBoundingClientRect().left;
          const initialsLeft = sheet.querySelector<HTMLElement>('.cri-initials')?.getBoundingClientRect().left;
          if (contentLeft == null || initialsLeft == null || Math.abs(initialsLeft - contentLeft) > tolerance) {
            issues.push(`${prefix}: Initials row is not left aligned.`);
          }
        }

        for (const row of [...sheet.querySelectorAll<HTMLElement>('.cri-prep-row')]) {
          const label = row.querySelector<HTMLElement>('.cri-row-label');
          const value = row.querySelector<HTMLElement>('.cri-row-value');
          if (!label || !value) continue;

          const labelRect = label.getBoundingClientRect();
          const valueRect = value.getBoundingClientRect();
          if (verticalOverlap(labelRect, valueRect) > tolerance && labelRect.right > valueRect.left + tolerance) {
            issues.push(`${prefix}: "${label.textContent?.trim() ?? ''}" overlaps "${value.textContent?.trim() ?? ''}".`);
          }
        }

        const drugLabel = sheet.querySelector<HTMLElement>('.cri-prep-row:not(.cri-total-row) .cri-row-label');
        const diluentLabel = sheet.querySelector<HTMLElement>('.cri-diluent-row .cri-row-label');
        if (drugLabel && diluentLabel) {
          const drugLeft = drugLabel.getBoundingClientRect().left;
          const diluentLeft = diluentLabel.getBoundingClientRect().left;
          if (Math.abs(drugLeft - diluentLeft) > tolerance) {
            issues.push(`${prefix}: Drug and Diluent labels are not aligned.`);
          }
        }

        const prepRows = [...sheet.querySelectorAll<HTMLElement>('.cri-prep-row')];
        const stockPrepRow = prepRows.find((row) => !row.classList.contains('cri-total-row') && !row.classList.contains('cri-diluent-row'));
        const totalPrepRow = sheet.querySelector<HTMLElement>('.cri-total-row');
        const diluentPrepRow = sheet.querySelector<HTMLElement>('.cri-diluent-row');
        if (
          stockPrepRow &&
          totalPrepRow &&
          verticalGap(stockPrepRow.getBoundingClientRect(), totalPrepRow.getBoundingClientRect()) < minReadableGap
        ) {
          issues.push(`${prefix}: drug volume and drug total rows are too tightly spaced.`);
        }
        if (
          totalPrepRow &&
          diluentPrepRow &&
          verticalGap(totalPrepRow.getBoundingClientRect(), diluentPrepRow.getBoundingClientRect()) < 4
        ) {
          issues.push(`${prefix}: drug total and diluent rows are too tightly spaced.`);
        }

        const prepValueRects = prepRows
          .map((row) => row.querySelector<HTMLElement>('.cri-row-value')?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => !!rect);
        if (prepValueRects.length > 1) {
          const [firstRect] = prepValueRects;
          if (prepValueRects.some((rect) => Math.abs(rect.left - firstRect.left) > tolerance)) {
            issues.push(`${prefix}: prep values are not aligned.`);
          }
        }

        const prepValueSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-prep-row .cri-row-value')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        if (prepValueSizes.length > 1) {
          const [firstSize] = prepValueSizes;
          if (prepValueSizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: prep row value font sizes are inconsistent.`);
          }
        }

        const prepVolumeSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-prep-volume')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        if (prepVolumeSizes.length > 0 && prepValueSizes.length > 0) {
          const [firstVolumeSize] = prepVolumeSizes;
          const [basePrepValueSize] = prepValueSizes;
          if (prepVolumeSizes.some((size) => Math.abs(size - firstVolumeSize) > 0.25)) {
            issues.push(`${prefix}: prep volume font sizes are inconsistent.`);
          }
          if (firstVolumeSize <= basePrepValueSize + 0.25) {
            issues.push(`${prefix}: prep volume font size is not larger than the surrounding prep text.`);
          }
        }

        const concentrationSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-prep-concentration')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        if (concentrationSizes.length > 0 && prepValueSizes.length > 0) {
          const [firstConcentrationSize] = concentrationSizes;
          const [basePrepValueSize] = prepValueSizes;
          if (concentrationSizes.some((size) => Math.abs(size - firstConcentrationSize) > 0.25)) {
            issues.push(`${prefix}: stock concentration font sizes are inconsistent.`);
          }
          if (firstConcentrationSize >= basePrepValueSize - 0.25) {
            issues.push(`${prefix}: stock concentration font size is not smaller than the surrounding prep text.`);
          }
        }

        const prepLabelSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-prep-row .cri-row-label')]
          .map((label) => Number.parseFloat(getComputedStyle(label).fontSize));
        if (prepLabelSizes.length > 1) {
          const [firstSize] = prepLabelSizes;
          if (prepLabelSizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: prep row label font sizes are inconsistent.`);
          }
        }

        const deliveryValueSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-delivers-box strong')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        if (deliveryValueSizes.length > 1) {
          const [firstSize] = deliveryValueSizes;
          if (deliveryValueSizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: delivery value font sizes are inconsistent.`);
          }
        }

        const headerSecondarySizes = [metaRow, initialsRow]
          .filter((row): row is HTMLElement => !!row)
          .map((row) => Number.parseFloat(getComputedStyle(row).fontSize));
        if (headerSecondarySizes.length > 1) {
          const [firstSize] = headerSecondarySizes;
          if (headerSecondarySizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: weight/date and initials font sizes are inconsistent.`);
          }
        }

        const boxLabelSizes = [...sheet.querySelectorAll<HTMLElement>('.cri-box-label')]
          .map((label) => Number.parseFloat(getComputedStyle(label).fontSize));
        if (boxLabelSizes.length > 1) {
          const [firstSize] = boxLabelSizes;
          if (boxLabelSizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: final concentration and delivery label font sizes are inconsistent.`);
          }
        }

        for (const decimal of [...sheet.querySelectorAll<HTMLElement>('.cri-num-decimal')]) {
          const parent = decimal.closest<HTMLElement>('.cri-num');
          if (!parent) continue;

          const decimalSize = Number.parseFloat(getComputedStyle(decimal).fontSize);
          const parentSize = Number.parseFloat(getComputedStyle(parent).fontSize);
          if (Math.abs((parentSize - decimalSize) - 1) > 0.25) {
            issues.push(`${prefix}: decimal font size is not 1px below value size.`);
          }
        }
      }

      return issues;
    });

    expect(violations).toEqual([]);
  });
});
