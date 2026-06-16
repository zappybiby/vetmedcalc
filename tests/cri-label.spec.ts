import { expect, type Page, test } from '@playwright/test';
import { MEDICATIONS, getDefaultMedicationDoseUnit } from '../src/lib/definitions';
import type { DoseUnit, MedicationDef } from '../src/lib/definitions/types';
import { computeCprLabel, CPR_LABEL_PRINT_STYLES, renderCprLabelMarkup } from '../src/lib/labels/cprLabel';
import { buildCriLabel, CRI_LABEL_PRINT_STYLES, renderCriLabelMarkup } from '../src/lib/labels/criLabel';
import { LABEL_PRINT_GEOMETRY } from '../src/lib/labels/geometry';
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

const CPR_LABEL_SCENARIOS = [
  { id: 'dog-standard', name: 'Bailey', species: 'dog', weightKg: 22.5 },
  { id: 'dog-small', name: 'Roo', species: 'dog', weightKg: 3.5 },
  { id: 'dog-large', name: 'Moose', species: 'dog', weightKg: 45 },
  { id: 'cat-standard', name: 'Mittens', species: 'cat', weightKg: 4.2 },
  { id: 'cat-large', name: 'Oliver', species: 'cat', weightKg: 8.8 },
] as const;

type CssVars = Record<string, number>;

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
            grid-template-columns: repeat(3, var(--label-safe-width));
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

function renderCprPresetLabelGrid(): string {
  const labels = CPR_LABEL_SCENARIOS.map((patient) => {
    const markup = renderCprLabelMarkup(computeCprLabel(patient));
    return `
      <div
        class="label-sheet"
        data-scenario="${escapeAttr(patient.id)}"
        data-patient-name="${escapeAttr(patient.name)}"
      >
        ${markup}
      </div>
    `;
  }).join('');

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${CPR_LABEL_PRINT_STYLES}

          body {
            display: block;
            min-height: 0;
            padding: 16px;
          }

          .label-grid {
            display: grid;
            grid-template-columns: repeat(2, var(--label-safe-width));
            gap: 16px;
            align-items: start;
          }
        </style>
      </head>
      <body>
        <main class="label-grid">${labels}</main>
      </body>
    </html>`;
}

async function applyCandidateVars(page: Page, vars: CssVars): Promise<void> {
  await page.evaluate((entries) => {
    let style = document.getElementById('label-fit-candidate-vars') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'label-fit-candidate-vars';
      document.head.append(style);
    }

    style.textContent = `:root { ${entries.map(([name, value]) => `${name}: ${value};`).join(' ')} }`;
  }, Object.entries(vars));
}

async function measureGenericLabelFit(page: Page, sheetSelector: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const tolerance = 1.25;
    const textTolerance = 2;
    const minGap = 1.5;
    const issues: string[] = [];
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const overlapArea = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };

    for (const sheet of [...document.querySelectorAll<HTMLElement>(selector)]) {
      const label = sheet.dataset.scenario ?? sheet.dataset.medName ?? 'label';
      const sheetRect = sheet.getBoundingClientRect();

      if (sheet.scrollWidth > sheet.clientWidth + textTolerance) {
        issues.push(`${label}: sheet horizontal overflow (${sheet.scrollWidth} > ${sheet.clientWidth}).`);
      }
      if (sheet.scrollHeight > sheet.clientHeight + textTolerance) {
        issues.push(`${label}: sheet vertical overflow (${sheet.scrollHeight} > ${sheet.clientHeight}).`);
      }

      for (const element of [...sheet.querySelectorAll<HTMLElement>('*')].filter(visible)) {
        const rect = element.getBoundingClientRect();
        if (
          rect.left < sheetRect.left - tolerance ||
          rect.top < sheetRect.top - tolerance ||
          rect.right > sheetRect.right + tolerance ||
          rect.bottom > sheetRect.bottom + tolerance
        ) {
          issues.push(`${label}: ${element.className || element.tagName} escapes sheet bounds.`);
        }

        const style = getComputedStyle(element);
        const allowsHorizontalClip = style.overflowX === 'hidden' && style.textOverflow === 'ellipsis';
        const hasDirectText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
        const isTextElement = hasDirectText || element.matches([
          '.cri-drug-name',
          '.cri-final-value',
          '.cri-delivers-box strong',
          '.cri-diluent-options',
          '.cri-prep-volume',
          '.cri-prep-concentration',
          '.cri-row-label',
          '.cri-row-value',
          '.label-name',
          '.label-weight',
          '.drug',
          '.perkg',
          '.dose-value',
          '.dose-unit',
          '.et-label',
          '.et-small',
          '.et-big',
          '.dash',
        ].join(','));
        if (isTextElement && !allowsHorizontalClip && element.scrollWidth > element.clientWidth + textTolerance) {
          issues.push(`${label}: "${element.textContent?.trim() ?? ''}" clips horizontally.`);
        }
        if (isTextElement && element.scrollHeight > element.clientHeight + textTolerance) {
          issues.push(`${label}: "${element.textContent?.trim() ?? ''}" clips vertically.`);
        }
      }

      const parents = [...sheet.querySelectorAll<HTMLElement>([
        '.cri-label-outer',
        '.cri-final-box',
        '.cri-delivers-box',
        '.cri-prep-row',
        '.label-hdr',
        '.dose',
        '.bolus-box',
        '.et-row',
      ].join(','))].filter(visible);

      for (const parent of parents) {
        const children = [...parent.children].filter((child): child is HTMLElement => child instanceof HTMLElement && visible(child));
        const enforceReadableGap = !parent.classList.contains('label-row');
        for (let index = 0; index < children.length; index += 1) {
          const current = children[index].getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          if (
            current.left < parentRect.left - tolerance ||
            current.top < parentRect.top - tolerance ||
            current.right > parentRect.right + tolerance ||
            current.bottom > parentRect.bottom + tolerance
          ) {
            issues.push(`${label}: child escapes ${parent.className || parent.tagName}.`);
          }

          for (let next = index + 1; next < children.length; next += 1) {
            const other = children[next].getBoundingClientRect();
            if (overlapArea(current, other) > tolerance) {
              issues.push(`${label}: children overlap in ${parent.className || parent.tagName}.`);
            }
            const sameLine = Math.max(0, Math.min(current.bottom, other.bottom) - Math.max(current.top, other.top)) > tolerance;
            if (enforceReadableGap && sameLine && other.left >= current.right && other.left - current.right < minGap) {
              issues.push(`${label}: children are cramped in ${parent.className || parent.tagName}.`);
            }
          }
        }
      }

      for (const blockSelector of [
        '.cri-handwritten-row, .cri-meta-row, .cri-initials-row, .cri-drug-heading, .cri-clinical-boxes, .cri-prep-section',
        '.label-hdr, .label-table, .label-bolus',
      ]) {
        const blocks = [...sheet.querySelectorAll<HTMLElement>(blockSelector)].filter(visible);
        for (let index = 1; index < blocks.length; index += 1) {
          const previous = blocks[index - 1].getBoundingClientRect();
          const current = blocks[index].getBoundingClientRect();
          if (current.top < previous.bottom - tolerance) {
            issues.push(`${label}: block ${index} overlaps the previous block.`);
          }
        }
      }
    }

    return issues;
  }, sheetSelector);
}

type TokenSearchConfig = {
  html: string;
  selector: string;
  scaleVar: string;
  minScale: number;
  maxScale: number;
  spacingVar: string;
  spacingValues: readonly number[];
  emphasisVar: string;
  emphasisValues: readonly number[];
};

type TokenSearchResult = {
  vars: CssVars;
  scale: number;
  spacing: number;
  emphasis: number;
  issues: string[];
};

function roundToken(value: number): number {
  return Number(value.toFixed(3));
}

function candidateIsBetter(candidate: TokenSearchResult, best: TokenSearchResult | null): boolean {
  if (!best) return true;
  if (candidate.scale > best.scale + 0.001) return true;
  if (best.scale > candidate.scale + 0.001) return false;
  if (candidate.emphasis > best.emphasis + 0.001) return true;
  if (best.emphasis > candidate.emphasis + 0.001) return false;
  return candidate.spacing > best.spacing + 0.001;
}

async function optimizeLabelTokens(page: Page, config: TokenSearchConfig): Promise<TokenSearchResult> {
  await page.setContent(config.html);

  let best: TokenSearchResult | null = null;
  for (const spacing of config.spacingValues) {
    for (const emphasis of config.emphasisValues) {
      let low = config.minScale;
      let high = config.maxScale;
      let currentBest: TokenSearchResult | null = null;

      for (let step = 0; step < 9; step += 1) {
        const scale = roundToken((low + high) / 2);
        const vars = {
          [config.scaleVar]: scale,
          [config.spacingVar]: spacing,
          [config.emphasisVar]: emphasis,
        };

        await applyCandidateVars(page, vars);
        const issues = await measureGenericLabelFit(page, config.selector);
        if (issues.length === 0) {
          low = scale;
          currentBest = { vars, scale, spacing, emphasis, issues };
        } else {
          high = scale;
        }
      }

      if (currentBest && candidateIsBetter(currentBest, best)) {
        best = currentBest;
      }
    }
  }

  if (!best) {
    await applyCandidateVars(page, {
      [config.scaleVar]: config.minScale,
      [config.spacingVar]: config.spacingValues[0],
      [config.emphasisVar]: config.emphasisValues[0],
    });
    const issues = await measureGenericLabelFit(page, config.selector);
    throw new Error(`No safe label token set found:\n${issues.slice(0, 10).join('\n')}`);
  }

  return best;
}

test.describe('CRI label print guardrails', () => {
  test('preset medication labels fit within the shared landscape safe print area', async ({ page }) => {
    await page.setViewportSize({ width: 1320, height: 5200 });
    await page.setContent(renderPresetLabelGrid());

    await expect(page.locator('.cri-label-sheet')).toHaveCount(
      MEDICATIONS.length * LABEL_SCENARIOS.length + METOCLOPRAMIDE_STRESS_SCENARIOS.length,
    );

    const sheetSize = await page.locator('.cri-label-sheet').first().evaluate((sheet) => {
      const rect = sheet.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(sheetSize.width).toBeCloseTo(LABEL_PRINT_GEOMETRY.safeWidthIn * 96, 1);
    expect(sheetSize.height).toBeCloseTo(LABEL_PRINT_GEOMETRY.safeHeightIn * 96, 1);

    const violations = await page.evaluate(() => {
      const tolerance = 1.25;
      const textTolerance = 2;
      const minReadableGap = 2;
      const minInitialsAreaGap = 22.5;
      const minWeightDateTopGap = 18;
      const maxWeightDateTopGap = 31;
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
        if (labelOuter && metaRow) {
          const weightDateTopGap = metaRow.getBoundingClientRect().top - labelOuter.getBoundingClientRect().top;
          if (weightDateTopGap < minWeightDateTopGap || weightDateTopGap > maxWeightDateTopGap) {
            issues.push(`${prefix}: weight/date row starts ${weightDateTopGap.toFixed(1)}px from the usable label top.`);
          }
        }
        if (patientRow && metaRow && verticalGap(patientRow.getBoundingClientRect(), metaRow.getBoundingClientRect()) < minReadableGap) {
          issues.push(`${prefix}: patient name row is cramped against weight/date row.`);
        }
        if (metaRow && initialsRow && verticalGap(metaRow.getBoundingClientRect(), initialsRow.getBoundingClientRect()) < minReadableGap) {
          issues.push(`${prefix}: weight/date row is cramped against initials row.`);
        }

        const sheetText = sheet.textContent ?? '';
        if (!sheetText.includes('Patient Name:')) {
          issues.push(`${prefix}: patient header should read "Patient Name:".`);
        }
        if (sheetText.includes('Patient name:')) {
          issues.push(`${prefix}: patient header uses old lowercase wording.`);
        }
        if (/\bstock\b/i.test(sheetText)) {
          issues.push(`${prefix}: visible Stock wording detected.`);
        }
        if (/CRI syringe/i.test(sheetText)) {
          issues.push(`${prefix}: visible CRI syringe wording detected.`);
        }
        if (/\bBy:/i.test(sheetText)) {
          issues.push(`${prefix}: visible By wording detected.`);
        }
        if (/\bCRI\b/i.test(sheetText)) {
          issues.push(`${prefix}: visible CRI wording detected.`);
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
        if (metaRow && drugHeading) {
          const initialsAreaGap = drugHeading.getBoundingClientRect().top - metaRow.getBoundingClientRect().bottom;
          if (initialsAreaGap < minInitialsAreaGap) {
            issues.push(`${prefix}: initials area is less than 6mm between weight/date and the drug separator.`);
          }
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
          if (prepValueSizes.some((size) => size < 8.5)) {
            issues.push(`${prefix}: prep row value font size is too small to read confidently.`);
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
          if (firstVolumeSize < 9) {
            issues.push(`${prefix}: prep volume font size is too small to read confidently.`);
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
          if (deliveryValueSizes.some((size) => size < 8.5)) {
            issues.push(`${prefix}: delivery value font size is too small to read confidently.`);
          }
        }

        const finalBox = sheet.querySelector<HTMLElement>('.cri-final-box');
        const deliversBox = sheet.querySelector<HTMLElement>('.cri-delivers-box');
        if (finalBox && deliversBox) {
          const finalRect = finalBox.getBoundingClientRect();
          const deliversRect = deliversBox.getBoundingClientRect();
          if (deliversRect.top < finalRect.bottom - tolerance) {
            issues.push(`${prefix}: clinical boxes overlap vertically.`);
          }
          if (Math.abs(finalRect.left - deliversRect.left) > tolerance || Math.abs(finalRect.right - deliversRect.right) > tolerance) {
            issues.push(`${prefix}: clinical boxes should stay stacked at the same width.`);
          }
        }

        if (diluentPrepRow) {
          const bottomGap = sheetRect.bottom - diluentPrepRow.getBoundingClientRect().bottom;
          if (bottomGap > 38) {
            issues.push(`${prefix}: dilution label leaves too much unused vertical space below the prep rows.`);
          }

          const diluentOptions = [...diluentPrepRow.querySelectorAll<HTMLElement>('.cri-diluent-options > span')];
          if (diluentOptions.length !== 3) {
            issues.push(`${prefix}: diluent choices should be independently spaced option spans.`);
          }
          const diluentVolume = diluentPrepRow.querySelector<HTMLElement>('.cri-prep-volume');
          if (diluentVolume && diluentOptions[0]) {
            const volumeRect = diluentVolume.getBoundingClientRect();
            const firstOptionRect = diluentOptions[0].getBoundingClientRect();
            if (firstOptionRect.left - volumeRect.right < 10) {
              issues.push(`${prefix}: NaCl is not spaced far enough away from the diluent volume.`);
            }
          }
          for (let index = 1; index < diluentOptions.length; index += 1) {
            const previous = diluentOptions[index - 1].getBoundingClientRect();
            const current = diluentOptions[index].getBoundingClientRect();
            if (current.left - previous.right < 10) {
              issues.push(`${prefix}: diluent choices are not spaced far enough apart for circling.`);
            }
          }
        }

        const deliveryDose = sheet.querySelector<HTMLElement>('.cri-delivers-box strong:first-of-type');
        const deliveryDoseText = deliveryDose?.textContent?.trim() ?? '';
        if (!/^-?\d+\.\d\s+/.test(deliveryDoseText)) {
          issues.push(`${prefix}: delivery dose is not rounded to the nearest tenth.`);
        }

        const finalConcentration = sheet.querySelector<HTMLElement>('.cri-final-value');
        const finalConcentrationText = finalConcentration?.textContent?.trim() ?? '';
        if (!/^-?\d+\.\d{2}\s+mg\/mL$/.test(finalConcentrationText)) {
          issues.push(`${prefix}: final concentration is not rounded to the nearest hundredth.`);
        }
        const finalValueSize = finalConcentration
          ? Number.parseFloat(getComputedStyle(finalConcentration).fontSize)
          : 0;
        if (finalValueSize < 13) {
          issues.push(`${prefix}: final concentration value is not visually dominant enough.`);
        }
        if (deliveryDose && finalConcentration) {
          const deliveryValueLeft = deliveryDose.getBoundingClientRect().left;
          const finalValueLeft = finalConcentration.getBoundingClientRect().left;
          if (Math.abs(deliveryValueLeft - finalValueLeft) > tolerance) {
            issues.push(`${prefix}: delivery dose is not aligned with final concentration value.`);
          }
        }
        if (deliveryValueSizes.some((size) => Math.abs(size - finalValueSize) > 0.25)) {
          issues.push(`${prefix}: delivery values should match final concentration value size.`);
        }

        const headerSecondarySizes = [metaRow, initialsRow]
          .filter((row): row is HTMLElement => !!row)
          .map((row) => Number.parseFloat(getComputedStyle(row).fontSize));
        const diluentLabelSize = diluentLabel
          ? Number.parseFloat(getComputedStyle(diluentLabel).fontSize)
          : 0;
        if (headerSecondarySizes.length > 1) {
          const [firstSize] = headerSecondarySizes;
          if (headerSecondarySizes.some((size) => Math.abs(size - firstSize) > 0.25)) {
            issues.push(`${prefix}: weight/date and initials font sizes are inconsistent.`);
          }
        }
        if (diluentLabelSize > 0 && headerSecondarySizes.some((size) => Math.abs(size - diluentLabelSize) > 0.25)) {
          issues.push(`${prefix}: weight/date/initials should match Diluent label font size.`);
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

test.describe('CPR label print guardrails', () => {
  test('preset CPR labels fit within the shared landscape safe print area', async ({ page }) => {
    await page.setViewportSize({ width: 1320, height: 900 });
    await page.setContent(renderCprPresetLabelGrid());

    await expect(page.locator('.label-sheet')).toHaveCount(CPR_LABEL_SCENARIOS.length);

    const sheetSize = await page.locator('.label-sheet').first().evaluate((sheet) => {
      const rect = sheet.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(sheetSize.width).toBeCloseTo(LABEL_PRINT_GEOMETRY.safeWidthIn * 96, 1);
    expect(sheetSize.height).toBeCloseTo(LABEL_PRINT_GEOMETRY.safeHeightIn * 96, 1);

    const violations = await page.evaluate(() => {
      const tolerance = 1.25;
      const textTolerance = 2;
      const minReadableGap = 2;
      const issues: string[] = [];
      const rectLabel = (rect: DOMRect) =>
        `left=${rect.left.toFixed(1)}, top=${rect.top.toFixed(1)}, right=${rect.right.toFixed(1)}, bottom=${rect.bottom.toFixed(1)}`;
      const verticalOverlap = (first: DOMRect, second: DOMRect) =>
        Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      const horizontalGap = (first: DOMRect, second: DOMRect) => second.left - first.right;

      for (const sheet of [...document.querySelectorAll<HTMLElement>('.label-sheet')]) {
        const scenario = sheet.dataset.scenario ?? 'unknown scenario';
        const sheetRect = sheet.getBoundingClientRect();

        if (sheet.scrollWidth > sheet.clientWidth + textTolerance) {
          issues.push(`${scenario}: sheet has horizontal overflow (${sheet.scrollWidth} > ${sheet.clientWidth}).`);
        }
        if (sheet.scrollHeight > sheet.clientHeight + textTolerance) {
          issues.push(`${scenario}: sheet has vertical overflow (${sheet.scrollHeight} > ${sheet.clientHeight}).`);
        }

        const containedElements = sheet.querySelectorAll<HTMLElement>([
          '.label-outer',
          '.label-hdr',
          '.label-name',
          '.label-weight',
          '.label-table',
          '.label-row',
          '.med',
          '.drug',
          '.perkg',
          '.dose',
          '.dose-value',
          '.dose-unit',
          '.label-bolus',
          '.bolus-box',
          '.et-box',
          '.et-label',
          '.et-row',
          '.et-small',
          '.et-big',
          '.dash',
        ].join(','));

        for (const element of [...containedElements]) {
          const rect = element.getBoundingClientRect();
          if (
            rect.left < sheetRect.left - tolerance ||
            rect.top < sheetRect.top - tolerance ||
            rect.right > sheetRect.right + tolerance ||
            rect.bottom > sheetRect.bottom + tolerance
          ) {
            issues.push(`${scenario}: ${element.className} escapes label bounds (${rectLabel(rect)}).`);
          }
        }

        for (const parent of [...sheet.querySelectorAll<HTMLElement>('.label-hdr, .label-row, .dose, .bolus-box, .et-row')]) {
          const parentRect = parent.getBoundingClientRect();
          const children = [...parent.children] as HTMLElement[];
          const enforceReadableGap = !parent.classList.contains('label-row');
          for (const child of children) {
            const childRect = child.getBoundingClientRect();
            if (
              childRect.left < parentRect.left - tolerance ||
              childRect.top < parentRect.top - tolerance ||
              childRect.right > parentRect.right + tolerance ||
              childRect.bottom > parentRect.bottom + tolerance
            ) {
              issues.push(`${scenario}: ${child.className} escapes ${parent.className} (${rectLabel(childRect)}).`);
            }
          }

          for (let index = 1; index < children.length; index += 1) {
            const previous = children[index - 1].getBoundingClientRect();
            const current = children[index].getBoundingClientRect();
            if (verticalOverlap(previous, current) > tolerance && current.left < previous.right - tolerance) {
              issues.push(`${scenario}: ${children[index - 1].className} overlaps ${children[index].className}.`);
            }
            if (enforceReadableGap && verticalOverlap(previous, current) > tolerance && horizontalGap(previous, current) < minReadableGap) {
              issues.push(`${scenario}: ${children[index - 1].className} is cramped against ${children[index].className}.`);
            }
          }
        }

        const textElements = sheet.querySelectorAll<HTMLElement>([
          '.label-weight',
          '.drug',
          '.perkg',
          '.dose',
          '.dose-value',
          '.dose-unit',
          '.et-label',
          '.et-row',
          '.et-small',
          '.et-big',
          '.dash',
        ].join(','));

        for (const element of [...textElements]) {
          if (element.scrollWidth > element.clientWidth + textTolerance) {
            issues.push(`${scenario}: "${element.textContent?.trim() ?? ''}" is clipped horizontally.`);
          }
          if (element.scrollHeight > element.clientHeight + textTolerance) {
            issues.push(`${scenario}: "${element.textContent?.trim() ?? ''}" is clipped vertically.`);
          }
        }

        const blocks = [...sheet.querySelectorAll<HTMLElement>('.label-hdr, .label-table, .label-bolus')];
        for (let index = 1; index < blocks.length; index += 1) {
          const previous = blocks[index - 1].getBoundingClientRect();
          const current = blocks[index].getBoundingClientRect();
          if (current.top < previous.bottom - tolerance) {
            issues.push(`${scenario}: label block ${index} overlaps the previous block.`);
          }
        }

        const doseValueSizes = [...sheet.querySelectorAll<HTMLElement>('.dose-value')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        const doseUnitSizes = [...sheet.querySelectorAll<HTMLElement>('.dose-unit')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        const perKgSizes = [...sheet.querySelectorAll<HTMLElement>('.perkg')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));
        const drugSizes = [...sheet.querySelectorAll<HTMLElement>('.drug')]
          .map((value) => Number.parseFloat(getComputedStyle(value).fontSize));

        if (doseValueSizes.some((size) => size <= (doseUnitSizes[0] ?? 0) + 0.5)) {
          issues.push(`${scenario}: dose values are not visually dominant over dose units.`);
        }
        if (doseValueSizes.some((size) => size <= (perKgSizes[0] ?? 0) + 1.5)) {
          issues.push(`${scenario}: dose values are not visually dominant over per-kg details.`);
        }
        if (drugSizes.some((size) => size <= (perKgSizes[0] ?? 0))) {
          issues.push(`${scenario}: drug names are not larger than dose detail labels.`);
        }

        const etBig = sheet.querySelector<HTMLElement>('.et-big');
        const etSmall = sheet.querySelector<HTMLElement>('.et-small');
        if (etBig && etSmall) {
          const bigSize = Number.parseFloat(getComputedStyle(etBig).fontSize);
          const smallSize = Number.parseFloat(getComputedStyle(etSmall).fontSize);
          if (bigSize <= smallSize + 1) {
            issues.push(`${scenario}: estimated ET tube value is not visually dominant.`);
          }
        }
      }

      return issues;
    });

    expect(violations).toEqual([]);
  });
});

test.describe('browser-measured label fit optimizer', () => {
  test.skip(process.env.LABEL_FIT_OPTIMIZER !== '1', 'Set LABEL_FIT_OPTIMIZER=1 to run the label token search.');

  test('finds the largest safe shared-area token sets for CRI and CPR labels', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1320, height: 5600 });

    const cri = await optimizeLabelTokens(page, {
      html: renderPresetLabelGrid(),
      selector: '.cri-label-sheet',
      scaleVar: '--cri-label-scale',
      minScale: 0.95,
      maxScale: 1.42,
      spacingVar: '--cri-space-scale',
      spacingValues: [0.82, 0.88, 0.94, 1, 1.06],
      emphasisVar: '--cri-clinical-scale',
      emphasisValues: [1, 1.04, 1.08, 1.12],
    });

    await page.setViewportSize({ width: 1320, height: 1200 });
    const cpr = await optimizeLabelTokens(page, {
      html: renderCprPresetLabelGrid(),
      selector: '.label-sheet',
      scaleVar: '--cpr-label-scale',
      minScale: 0.95,
      maxScale: 1.32,
      spacingVar: '--cpr-space-scale',
      spacingValues: [0.78, 0.84, 0.88, 0.92, 0.96],
      emphasisVar: '--cpr-dose-scale',
      emphasisValues: [1, 1.05, 1.1, 1.15],
    });

    console.info(JSON.stringify({ cri: cri.vars, cpr: cpr.vars }, null, 2));
    expect(cri.issues).toEqual([]);
    expect(cpr.issues).toEqual([]);
  });
});
