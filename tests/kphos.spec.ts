import { setToggle } from './toggle';
import { expect, test } from '@playwright/test';
import { getKPhosBaseFluid } from '../src/lib/definitions/kphos';
import {
  KPHOS_EXCESS_WARNING_FRACTION,
  calculateKPhosPlan,
  getKPhosExcessFraction,
  type KPhosPlanInput,
} from '../src/lib/helpers/kphos';

const normR = getKPhosBaseFluid('norm-r');
const isolyte = getKPhosBaseFluid('isolyte-s');
const saline = getKPhosBaseFluid('normal-saline');

function input(overrides: Partial<KPhosPlanInput> = {}): KPhosPlanInput {
  return {
    mode: 'bag',
    mainFluid: normR,
    criDiluentFluid: saline,
    weightKg: 10,
    mainBagVolumeMl: 1000,
    mainFluidRateMlHr: 25,
    phosTargetMmolKgHr: 0.01,
    kTargetBasis: 'added',
    kTargetMeqPerL: 30,
    criDurationHr: 12,
    criRateMlHr: null,
    ...overrides,
  };
}

test.describe('KPhos calculations', () => {
  test('phosphate mode counts native fluid only for Total and keeps all sources in reported delivery', () => {
    for (const mode of ['bag', 'cri'] as const) {
      const settings = input({ mode, mainFluid: isolyte, criDiluentFluid: isolyte, mainFluidRateMlHr: 100, criRateMlHr: 1 });
      const added = calculateKPhosPlan({ ...settings, phosTargetBasis: 'added' });
      const total = calculateKPhosPlan({ ...settings, phosTargetBasis: 'total' });
      // 0.01 mmol/kg/hr x 10 kg / 3 mmol/mL, over a 10-hour bag or 12-hour CRI.
      expect(added.kPhosRawStockMl).toBeCloseTo(mode === 'bag' ? 1 / 3 : 0.4, 10);
      expect(added.kPhosRawStockMl!).toBeGreaterThan(total.kPhosRawStockMl!);
      expect(added.selectedPhosDeliveryMmolKgHr).toBe(added.kPhosPhosDeliveryMmolKgHr);
      expect(total.selectedPhosDeliveryMmolKgHr).toBe(total.totalPhosDeliveryMmolKgHr);
      expect(added.totalPhosDeliveryMmolKgHr).toBeCloseTo(
        added.kPhosPhosDeliveryMmolKgHr! + 0.005 + added.criDiluentPhosDeliveryMmolKgHr!, 10,
      );
      expect(calculateKPhosPlan(settings)).toEqual(total);

      const zeroAdded = calculateKPhosPlan({ ...settings, phosTargetMmolKgHr: 0, phosTargetBasis: 'added' });
      const zeroTotal = calculateKPhosPlan({ ...settings, phosTargetMmolKgHr: 0, phosTargetBasis: 'total' });
      expect(zeroAdded.kPhosStockMl).toBe(0);
      expect(zeroAdded.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.005, 10);
      expect(zeroAdded.phosTargetExcessMmolKgHr).toBeNull();
      expect(zeroAdded.fluidsMeetPhosTarget).toBe(false);
      expect(zeroTotal.phosTargetExcessMmolKgHr).toBeCloseTo(0.005, 10);
      expect(zeroTotal.fluidsMeetPhosTarget).toBe(true);
    }
  });

  test('warns only when Phos exceeds its target by at least 15%', () => {
    expect(KPHOS_EXCESS_WARNING_FRACTION).toBe(0.15);
    expect(getKPhosExcessFraction(0.03, 0.034)).toBeCloseTo(0.1333333333, 9);
    expect((getKPhosExcessFraction(0.03, 0.034) ?? 0) >= KPHOS_EXCESS_WARNING_FRACTION).toBe(false);
    expect((getKPhosExcessFraction(0.03, 0.035) ?? 0) >= KPHOS_EXCESS_WARNING_FRACTION).toBe(true);
  });

  test('snaps KCl-only supplementation to the selected syringe ticks', () => {
    const plan = calculateKPhosPlan(input({
      weightKg: null,
      mainBagVolumeMl: 250,
      mainFluidRateMlHr: null,
      phosTargetMmolKgHr: null,
    }));

    expect(plan.kClRawStockMl).toBeCloseTo(3.75, 10);
    expect(plan.kClStockMl).toBeCloseTo(3.8, 10);
    expect(plan.kClDraw?.syringeId).toBe('6cc-0-2');
    expect(plan.kClDraw?.incrementMl).toBeCloseTo(0.2, 10);
    expect(plan.kClTotalMeq).toBeCloseTo(7.6, 10);
    expect(plan.addedKActualMeqPerL).toBeCloseTo(30.4, 10);
    expect(plan.finalMainBagKMeqPerL).toBeCloseTo(35.4, 10);
    expect(plan.totalKDeliveryMeqKgHr).toBeNull();
  });

  test('prepares a KPhos and KCl fluid bag', () => {
    const plan = calculateKPhosPlan(input());

    expect(plan.kPhosRawStockMl).toBeCloseTo(1.3333333333, 9);
    expect(plan.kPhosStockMl).toBeCloseTo(1.3, 10);
    expect(plan.kPhosDraw?.syringeId).toBe('3cc-0-1');
    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(5.72, 10);
    expect(plan.kClRequiredMeqPerL).toBeCloseTo(24.28, 10);
    expect(plan.kClRawStockMl).toBeCloseTo(12.14, 10);
    expect(plan.kClStockMl).toBeCloseTo(12, 10);
    expect(plan.kClDraw?.syringeId).toBe('35cc-1');
    expect(plan.kClAddedMeqPerL).toBeCloseTo(24, 10);
    expect(plan.addedKActualMeqPerL).toBeCloseTo(29.72, 10);
    expect(plan.selectedKDeltaMeqPerL).toBeCloseTo(-0.28, 10);
    expect(plan.finalMainBagKMeqPerL).toBeCloseTo(34.72, 10);
    expect(plan.finalMainBagPhosMmolPerL).toBeCloseTo(3.9, 10);
    expect(plan.totalKDeliveryMeqKgHr).toBeCloseTo(0.0868, 10);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.00975, 10);
  });

  test('builds a separate diluted CRI and keeps its K out of the physical bag', () => {
    const plan = calculateKPhosPlan(input({ mode: 'cri', criRateMlHr: 1 }));

    expect(plan.kPhosStockMl).toBeCloseTo(0.4, 10);
    expect(plan.criDiluentVolumeMl).toBeCloseTo(11.6, 10);
    expect(plan.kPhosDraw?.syringeId).toBe('1cc-0-01');
    expect(plan.criDiluentDraw?.syringeId).toBe('12cc-0-2');
    expect(plan.criPumpRateMlHr).toBeCloseTo(1, 10);
    expect(plan.criActualRuntimeHr).toBeCloseTo(12, 10);
    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(5.8666666667, 9);
    expect(plan.kClStockMl).toBeCloseTo(12, 10);
    expect(plan.kClAddedMeqPerL).toBeCloseTo(24, 10);
    expect(plan.addedKActualMeqPerL).toBeCloseTo(29.8666666667, 9);
    expect(plan.finalMainBagKMeqPerL).toBeCloseTo(29, 10);
    expect(plan.combinedEquivalentKMeqPerL).toBeCloseTo(34.8666666667, 9);
    expect(plan.totalKDeliveryMeqKgHr).toBeCloseTo(0.0871666667, 9);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.01, 10);
  });

  test('uses syringe-snapped CRI volumes in the delivered dose and runtime', () => {
    const plan = calculateKPhosPlan(input({ mode: 'cri', criDurationHr: 13, criRateMlHr: 1 }));

    expect(plan.kPhosDraw).not.toBeNull();
    expect(plan.criDiluentDraw).not.toBeNull();
    expect((plan.kPhosStockMl ?? 0) / (plan.kPhosDraw?.incrementMl ?? 1)).toBeCloseTo(
      Math.round((plan.kPhosStockMl ?? 0) / (plan.kPhosDraw?.incrementMl ?? 1)),
      10,
    );
    expect((plan.criDiluentVolumeMl ?? 0) / (plan.criDiluentDraw?.incrementMl ?? 1)).toBeCloseTo(
      Math.round((plan.criDiluentVolumeMl ?? 0) / (plan.criDiluentDraw?.incrementMl ?? 1)),
      10,
    );
    expect(
      Math.abs((plan.kPhosStockMl ?? 0) - (plan.kPhosRawStockMl ?? 0)) +
      Math.abs((plan.criDiluentVolumeMl ?? 0) - (plan.criRawDiluentVolumeMl ?? 0)),
    ).toBeGreaterThan(0);
    expect(plan.criActualRuntimeHr).toBeCloseTo(
      (plan.criTotalVolumeMl ?? 0) / (plan.criPumpRateMlHr ?? 1),
      10,
    );
    const snappedStockRate = (plan.criPumpRateMlHr ?? 0) * (plan.kPhosStockMl ?? 0) / (plan.criTotalVolumeMl ?? 1);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(
      (snappedStockRate * 3) / 10,
      10,
    );
  });

  test('does not add KCl when no added-K target is entered', () => {
    const plan = calculateKPhosPlan(input({ mode: 'cri', kTargetMeqPerL: null }));

    expect(plan.kClStockMl).toBeNull();
    expect(plan.totalKDeliveryMeqKgHr).toBeCloseTo(0.0271666667, 9);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.01, 10);
  });

  test('treats a zero K value as no supplementation target', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      phosTargetMmolKgHr: 0.06,
      kTargetMeqPerL: 0,
    }));

    expect(plan.hasKTarget).toBe(false);
    expect(plan.kClStockMl).toBeNull();
    expect(plan.kTargetExcessMeqPerL).toBeNull();
  });

  test('prepares a CRI without a fluid bag volume or K target', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      mainFluid: isolyte,
      mainBagVolumeMl: null,
      mainFluidRateMlHr: 100,
      kTargetMeqPerL: null,
    }));

    expect(plan.hasKTarget).toBe(false);
    expect(plan.kPhosStockMl).not.toBeNull();
    expect(plan.mainNativePhosDeliveryMmolKgHr).toBeCloseTo(0.005, 10);
    expect(plan.mainNativeKDeliveryMeqKgHr).toBeCloseTo(0.05, 10);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.01, 10);
  });

  test('keeps native CRI diluent K out of the KCl subtraction', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      criDiluentFluid: normR,
      criRateMlHr: 1,
    }));

    expect(plan.criDiluentKDeliveryMeqKgHr).toBeCloseTo(0.0004833333, 9);
    expect(plan.criDiluentKEquivalentMeqPerL).toBeCloseTo(0.1933333333, 9);
    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(5.8666666667, 9);
    expect(plan.kClStockMl).toBeCloseTo(12, 10);
    expect(plan.totalKDeliveryMeqKgHr).toBeCloseTo(0.08765, 9);
    expect(plan.combinedEquivalentKMeqPerL).toBeCloseTo(35.06, 9);
  });

  test('lets CRI diluent Phos reduce KPhos but not CRI diluent K reduce KCl', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      criDiluentFluid: isolyte,
      criRateMlHr: 1,
    }));

    expect(plan.criDiluentPhosDeliveryMmolKgHr).toBeGreaterThan(0);
    expect(plan.kPhosRawStockMl).toBeCloseTo(0.3980663444, 9);
    expect(plan.kPhosStockMl).toBeCloseTo(0.4, 10);
    expect(plan.criRawDiluentVolumeMl).toBeCloseTo(11.6019336556, 9);
    expect(plan.criDiluentVolumeMl).toBeCloseTo(11.6, 10);
    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(5.8666666667, 9);
    expect(plan.kClStockMl).toBeCloseTo(12, 10);
    expect(plan.addedKActualMeqPerL).toBeCloseTo(29.8666666667, 9);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.0100483333, 9);
  });

  test('does not let native main-fluid K reduce KCl', () => {
    const normPlan = calculateKPhosPlan(input());
    const salinePlan = calculateKPhosPlan(input({ mainFluid: saline }));

    expect(normPlan.kClStockMl).toBeCloseTo(salinePlan.kClStockMl ?? 0, 10);
    expect(normPlan.finalMainBagKMeqPerL).toBeCloseTo(34.72, 10);
    expect(salinePlan.finalMainBagKMeqPerL).toBeCloseTo(29.72, 10);
  });

  test('counts native fluid K only when the target basis is Total', () => {
    const addedPlan = calculateKPhosPlan(input());
    const totalPlan = calculateKPhosPlan(input({ kTargetBasis: 'total' }));

    expect(addedPlan.kClStockMl).toBeCloseTo(12, 10);
    expect(totalPlan.kClStockMl).toBeCloseTo(9.6, 10);
    expect(totalPlan.selectedKActualMeqPerL).toBeCloseTo(29.92, 10);
  });

  test('does not clamp a small KCl remainder because the CRI diluent has K', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      criDiluentFluid: normR,
      criRateMlHr: 1,
      kTargetMeqPerL: 5.9,
    }));

    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(5.8666666667, 9);
    expect(plan.kClRequiredMeqPerL).toBeCloseTo(0.0333333333, 9);
    expect(plan.kClRawStockMl).toBeCloseTo(0.0166666667, 9);
    expect(plan.kClStockMl).toBeCloseTo(0.02, 10);
    expect(plan.kClAddedMeqPerL).toBeCloseTo(0.04, 10);
  });

  test('rejects a dilute-to rate below the required KPhos stock rate', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      criRateMlHr: 0.01,
    }));

    expect(plan.criRequestedRateFeasible).toBe(false);
    expect(plan.criRateIssue).toBe('below-stock-rate');
    expect(plan.criDiluentVolumeMl).toBeCloseTo(0, 10);
    expect(plan.criPumpRateMlHr).toBeCloseTo(0.0333333333, 9);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.01, 10);
  });

  test('rejects a rate where phosphate-containing diluent exceeds the target', () => {
    const plan = calculateKPhosPlan(input({
      mode: 'cri',
      criDiluentFluid: isolyte,
      criRateMlHr: 250,
    }));

    expect(plan.criRequestedRateFeasible).toBe(false);
    expect(plan.criRateIssue).toBe('diluent-exceeds-phos-target');
    expect(plan.criDiluentVolumeMl).toBeCloseTo(0, 10);
    expect(plan.criPumpRateMlHr).toBeCloseTo(0.0333333333, 9);
    expect(plan.totalPhosDeliveryMmolKgHr).toBeCloseTo(0.01, 10);
  });

  test('subtracts intrinsic Isolyte Phos from the KPhos requirement', () => {
    const plan = calculateKPhosPlan(input({
      mainFluid: isolyte,
      mainBagVolumeMl: 500,
    }));

    expect(plan.mainNativePhosDeliveryMmolKgHr).toBeCloseTo(0.00125, 10);
    expect(plan.kPhosPhosDeliveryMmolKgHr).toBeCloseTo(0.0087, 10);
    expect(plan.kPhosRawStockMl).toBeCloseTo(0.5833333333, 9);
    expect(plan.kPhosStockMl).toBeCloseTo(0.58, 10);
    expect(plan.kClRawStockMl).toBeCloseTo(6.224, 10);
    expect(plan.kClStockMl).toBeCloseTo(6.2, 10);
    expect(plan.finalMainBagKMeqPerL).toBeCloseTo(34.904, 10);
    expect(plan.finalMainBagPhosMmolPerL).toBeCloseTo(3.98, 10);
  });

  test('clamps KCl at zero when KPhos already exceeds the added-K target', () => {
    const plan = calculateKPhosPlan(input({ phosTargetMmolKgHr: 0.06 }));

    expect(plan.kPhosKCreditMeqPerL).toBeCloseTo(35.2, 10);
    expect(plan.kClStockMl).toBeCloseTo(0, 10);
    expect(plan.kTargetExcessMeqPerL).toBeCloseTo(5.2, 10);
    expect(plan.finalMainBagKMeqPerL).toBeCloseTo(40.2, 10);
    expect(plan.totalKDeliveryMeqKgHr).toBeCloseTo(0.1005, 10);
  });
});

test.describe('KPhos workflow', () => {
  async function openKPhos(
    page: import('@playwright/test').Page,
    viewport = { width: 1280, height: 800 },
  ) {
    await page.setViewportSize(viewport);
    await page.goto('/vetmedcalc/');
    await page.getByRole('tab', { name: 'KPhos/KCl' }).click();
    return page.locator('[role="tabpanel"] > div:not([hidden])');
  }

  async function fillCommonPlan(page: import('@playwright/test').Page, panel: import('@playwright/test').Locator) {
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await panel.getByLabel('Bag volume (mL)', { exact: true }).fill('1000');
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('25');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.01');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('30');
  }

  test('keeps the empty form free of explainer copy', async ({ page }) => {
    const panel = await openKPhos(page);
    const inputCard = panel.getByTestId('kphos-input-card');

    for (const text of [
      'Add KPhos to a fluid bag or prepare it as a CRI.',
      'Enter either or both',
      'Bag and delivery details',
      'Enter a phosphate or potassium target.',
      'Preparation',
      'Fluid bag',
      'CRI setup',
    ]) {
      await expect(panel.getByText(text, { exact: true })).toHaveCount(0);
    }

    await expect(inputCard.getByText('Mode:', { exact: true })).toBeVisible();
    await expect(inputCard.getByRole('heading', { name: 'Targets', exact: true })).toHaveCount(0);
    await expect(inputCard.getByLabel('Fluid Type', { exact: true })).toBeVisible();
    await expect(panel.getByTestId('kphos-results')).toHaveCount(0);

    await setToggle(inputCard, 'Add KPhos to', true);
    await expect(inputCard.getByText('Preparation and main fluid', { exact: true })).toHaveCount(0);
    await expect(inputCard.getByLabel('Fluid Type', { exact: true })).toBeVisible();
  });

  test('centers the mode selector on desktop and mobile', async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 384, height: 854 }]) {
      const panel = await openKPhos(page, viewport);
      const card = await panel.getByTestId('kphos-input-card').boundingBox();
      const control = await panel.getByRole('switch', { name: 'Add KPhos to' }).boundingBox();
      expect(Math.abs(control!.x + control!.width / 2 - card!.x - card!.width / 2)).toBeLessThanOrEqual(1);
      const modeSize = await panel.getByText('Mode:', { exact: true }).evaluate((label) => Number.parseFloat(getComputedStyle(label).fontSize));
      expect(modeSize).toBe(12);
    }
  });

  test('supports a KCl-only 250 mL bag with no patient data', async ({ page }) => {
    const panel = await openKPhos(page);

    await panel.getByLabel('Bag volume (mL)', { exact: true }).fill('250');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('30');

    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('3.8 mL');
    await expect(panel.getByText(/ticks/i)).toHaveCount(0);
    await expect(panel.getByTestId('final-main-bag-k')).toContainText('35.4 mEq/L');
    await expect(panel.getByTestId('total-k-delivery')).toHaveText('—');
  });

  test('matches optional placeholder formatting to suggested inputs', async ({ page }) => {
    await page.goto('/vetmedcalc/');

    const placeholderStyle = async (selector: string) => page.locator(selector).evaluate((element) => {
      const inputStyle = getComputedStyle(element);
      const placeholder = getComputedStyle(element, '::placeholder');
      return {
        color: placeholder.color,
        fontStyle: placeholder.fontStyle,
        fontWeight: placeholder.fontWeight,
        textAlign: inputStyle.textAlign,
      };
    });

    expect(await placeholderStyle('#kphos-phos-target')).toEqual(await placeholderStyle('#cri-dose'));
  });

  test('shows the amount added to the whole bag and delivery from each source', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await panel.getByLabel('Fluid Type', { exact: true }).selectOption('isolyte-s');
    await panel.getByLabel('Bag volume (mL)', { exact: true }).fill('500');
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('50');
    await panel.getByTestId('phos-target-basis').click();
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.075');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('82');

    const results = panel.getByTestId('kphos-results');
    await expect(results.getByTestId('kcl-stock-volume')).toHaveText('15 mL KCl');
    await expect(results.getByTestId('kphos-stock-volume')).toHaveText('2.5 mL KPhos');
    await expect(results).toContainText(/15\s+mL KCl\s*Adds 30\s+mEq K/i);
    await expect(results).toContainText(/2\.5\s+mL KPhos\s*Adds 11\s+mEq K and 7\.5\s+mmol Phos/i);

    const table = results.getByRole('table');
    await expect(table.getByTestId('starting-fluid-component')).toContainText('0.025 mEq/kg/hr');
    await expect(table.getByTestId('starting-fluid-component')).toContainText('0.0025 mmol/kg/hr');
    await expect(table.getByTestId('kphos-component')).toContainText('0.11 mEq/kg/hr');
    await expect(table.getByTestId('kphos-component')).toContainText('0.075 mmol/kg/hr');
    await expect(table.getByTestId('kcl-component')).toContainText('0.3 mEq/kg/hr');
    await expect(table.getByTestId('kcl-component')).toContainText('0 mmol/kg/hr');
    await expect(table.getByTestId('final-bag-component')).toContainText('87 mEq/L');
    await expect(table.getByTestId('final-bag-component')).toContainText('15.5 mmol/L');
    await expect(table.getByTestId('final-bag-component')).toContainText('0.435 mEq/kg/hr');
    await expect(table.getByTestId('final-bag-component')).toContainText('0.0775 mmol/kg/hr');
  });

  test('accepts equivalent direct, hourly and daily fluid rates and responds to weight changes', async ({ page }) => {
    const panel = await openKPhos(page);
    await fillCommonPlan(page, panel);

    const units = panel.getByLabel('Fluid rate unit', { exact: true });
    const rate = panel.locator('#kphos-main-fluid-rate');
    const summary = panel.getByTestId('kphos-source-summary');
    const directResults = await summary.innerText();

    await units.selectOption('mL/kg/hr');
    await expect(rate).toHaveValue('2.5');
    await expect(summary).toHaveText(directResults, { useInnerText: true });

    await units.selectOption('mL/kg/day');
    await expect(rate).toHaveValue('60');
    await rate.fill('48');
    const dailyResults = await summary.innerText();
    expect(dailyResults).not.toBe(directResults);

    await units.selectOption('mL/kg/hr');
    await expect(rate).toHaveValue('2');
    await expect(summary).toHaveText(dailyResults, { useInnerText: true });

    await page.getByLabel('Weight (kg)', { exact: true }).fill('20');
    await expect(rate).toHaveValue('2');
    await units.selectOption('mL/hr');
    await expect(rate).toHaveValue('40');
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await rate.fill('20');
    await expect(summary).toHaveText(dailyResults, { useInnerText: true });
  });

  test('reports the running fluid separately from a phosphate-only CRI', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await setToggle(panel, 'Add KPhos to', true);
    await panel.getByLabel('Fluid Type', { exact: true }).selectOption('isolyte-s');
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('100');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.01');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('0');

    const results = panel.getByTestId('kphos-results');
    const summary = panel.getByTestId('kphos-source-summary');
    await expect(panel.getByLabel('Bag volume (mL)', { exact: true })).toHaveCount(0);
    await expect(results.getByText(/Needed:/)).toHaveCount(0);
    await expect(results.getByText(/K already exceeds/)).toHaveCount(0);
    await expect(results.getByTestId('kcl-stock-volume')).toHaveText('No KCl requested');
    await expect(results.getByTestId('native-fluid-delivery')).toHaveCount(0);
    await expect(summary.getByText('How each preparation is built')).toHaveCount(0);
    const criRegion = summary.getByRole('table', { name: 'KPhos CRI composition' });
    await expect(criRegion).toBeVisible();
    const runningFluid = summary.getByTestId('starting-fluid-component');
    await expect(runningFluid).toContainText('Isolyte S pH 7.4');
    await expect(runningFluid).toContainText('0.05 mEq/kg/hr');
    await expect(runningFluid).toContainText('0.005 mmol/kg/hr');
    await expect(summary.getByTestId('final-bag-component')).toHaveCount(0);
    const preparedCri = criRegion.getByTestId('final-cri-component');
    await expect(preparedCri).toContainText('0.005 mmol/kg/hr');
    const combinedDelivery = summary.getByRole('region', { name: 'Total delivery from all sources' });
    await expect(combinedDelivery.getByTestId('total-phos-delivery')).toHaveText('0.01 mmol/kg/hr');
    await expect(criRegion.getByTestId('total-phos-delivery')).toHaveCount(0);
  });

  test('preserves a syringe draw at the rounding boundary when switching rate units', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('3');
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('8');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.001');
    const draw = panel.getByTestId('kphos-stock-volume');
    await expect(draw).toHaveText('0.13 mL KPhos');

    for (const unit of ['mL/kg/hr', 'mL/kg/day', 'mL/hr']) {
      await panel.getByLabel('Fluid rate unit', { exact: true }).selectOption(unit);
      await expect(draw).toHaveText('0.13 mL KPhos');
    }
  });

  test('waits for weight to convert a weighted rate to pump delivery', async ({ page }) => {
    const panel = await openKPhos(page);
    const units = panel.getByLabel('Fluid rate unit', { exact: true });
    await units.selectOption('mL/kg/day');
    await panel.getByLabel('Fluid rate (mL/kg/day)', { exact: true }).fill('60');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.01');
    await expect(panel.getByTestId('kphos-results')).toContainText('Enter patient weight');
    await expect(panel.getByTestId('kphos-stock-volume')).toHaveCount(0);

    await units.selectOption('mL/kg/hr');
    await expect(panel.getByLabel('Fluid rate (mL/kg/hr)', { exact: true })).toHaveValue('2.5');
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await expect(panel.getByTestId('kphos-stock-volume')).toHaveText('1.3 mL KPhos');
    await units.selectOption('mL/hr');
    await expect(panel.getByLabel('Fluid rate (mL/hr)', { exact: true })).toHaveValue('25');
  });

  test('switches the potassium target between Added and Total without moving results', async ({ page }) => {
    const panel = await openKPhos(page);
    await fillCommonPlan(page, panel);

    const resultTop = await panel.getByTestId('kphos-results').evaluate((element) => element.getBoundingClientRect().top);
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('12 mL');

    await panel.getByTestId('k-target-basis').click();

    await expect(panel.getByTestId('k-target-basis')).toBeChecked();
    const basisStyle = await panel.getByTestId('k-target-basis').evaluate((button) => ({
      height: button.getBoundingClientRect().height,
      fontSize: Number.parseFloat(getComputedStyle(button).fontSize),
    }));
    expect(basisStyle.height).toBe(34);
    expect(basisStyle.fontSize).toBe(12);
    await expect(panel.getByLabel('Total potassium target (mEq/L)', { exact: true })).toHaveValue('30');
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('9.6 mL');
    const totalResultTop = await panel.getByTestId('kphos-results').evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(totalResultTop - resultTop)).toBeLessThanOrEqual(1);
  });

  test('switches between CRI and bag preparation without losing shared inputs', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');

    await setToggle(panel, 'Add KPhos to', true);
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('25');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.01');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('30');
    await panel.getByLabel('Bag volume (mL)', { exact: true }).fill('1000');
    await panel.getByLabel('Duration (hr)', { exact: true }).fill('12');
    await panel.getByLabel('CRI rate (mL/hr)', { exact: true }).fill('1');

    expect(await panel.locator('#kphos-main-fluid option').allTextContents()).toEqual([
      'Norm-R',
      'Plasma-Lyte 148',
      'Isolyte S pH 7.4',
      '0.9% NaCl',
    ]);
    expect(await panel.locator('#kphos-cri-diluent option').allTextContents()).toEqual([
      'Norm-R',
      'Plasma-Lyte 148',
      'Isolyte S pH 7.4',
      '0.9% NaCl',
    ]);

    await expect(panel.getByTestId('kphos-stock-volume')).toContainText('0.4 mL');
    await expect(panel.getByTestId('cri-diluent-volume')).toContainText('11.6 mL');
    await expect(panel.getByTestId('cri-pump-rate')).toContainText('1 mL/hr');
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('12 mL');
    await expect(panel.getByText(/ticks/i)).toHaveCount(0);
    await expect(panel.getByTestId('total-k-delivery')).toContainText('0.087');
    await expect(panel.getByTestId('total-phos-delivery')).toContainText('0.01');
    await expect(panel.getByTestId('final-main-bag-k')).toContainText('29 mEq/L');
    await expect(panel.getByTestId('final-bag-component')).toContainText('0.0725 mEq/kg/hr');
    await expect(panel.getByTestId('final-bag-component')).toContainText('0 mmol/kg/hr');
    await expect(panel.getByTestId('final-cri-component')).toContainText('0.01 mmol/kg/hr');

    await setToggle(panel, 'Add KPhos to', false);

    await expect(panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true })).toHaveValue('0.01');
    await expect(panel.getByLabel('Added potassium target (mEq/L)', { exact: true })).toHaveValue('30');
    await expect(panel.getByTestId('kphos-stock-volume')).toContainText('1.3 mL');
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('12 mL');
    await expect(panel.getByTestId('final-main-bag-k')).toContainText('34.72 mEq/L');
  });

  test('keeps the input and result cards aligned when switching Bag and CRI modes', async ({ page }) => {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 384, height: 854 }]) {
      const panel = await openKPhos(page, viewport);
      await fillCommonPlan(page, panel);

      const inputCard = panel.getByTestId('kphos-input-card');
      const results = panel.getByTestId('kphos-results');
      const bagGeometry = await inputCard.evaluate((element) => {
        const input = element.getBoundingClientRect();
        const result = document.querySelector<HTMLElement>('[data-testid="kphos-results"]')?.getBoundingClientRect();
        return { inputBottom: input.bottom + window.scrollY, inputLeft: input.left, inputRight: input.right, resultTop: result ? result.top + window.scrollY : 0, resultLeft: result?.left ?? 0, resultRight: result?.right ?? 0 };
      });

      await setToggle(panel, 'Add KPhos to', true);
      await panel.getByLabel('Duration (hr)', { exact: true }).fill('12');
      await panel.getByLabel('CRI rate (mL/hr)', { exact: true }).fill('1');

      const criGeometry = await inputCard.evaluate((element) => {
        const input = element.getBoundingClientRect();
        const result = document.querySelector<HTMLElement>('[data-testid="kphos-results"]')?.getBoundingClientRect();
        return { inputBottom: input.bottom + window.scrollY, inputLeft: input.left, inputRight: input.right, resultTop: result ? result.top + window.scrollY : 0, resultLeft: result?.left ?? 0, resultRight: result?.right ?? 0 };
      });

      const referenceGap = await page.getByRole('region', { name: 'CRI calculator', exact: true, includeHidden: true }).evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).rowGap),
      );
      expect(Math.abs(bagGeometry.resultTop - bagGeometry.inputBottom - referenceGap), `${viewport.width}px Bag card gap matches CRI`).toBeLessThanOrEqual(1);
      expect(Math.abs(criGeometry.resultTop - criGeometry.inputBottom - referenceGap), `${viewport.width}px CRI card gap matches CRI`).toBeLessThanOrEqual(1);
      expect(Math.abs(bagGeometry.resultLeft - bagGeometry.inputLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(bagGeometry.resultRight - bagGeometry.inputRight)).toBeLessThanOrEqual(1);
      expect(Math.abs(criGeometry.resultLeft - criGeometry.inputLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(criGeometry.resultRight - criGeometry.inputRight)).toBeLessThanOrEqual(1);
      await expect(results).toBeVisible();
    }
  });

  test('keeps the filled mobile field grids inside the input card', async ({ page }) => {
    const panel = await openKPhos(page, { width: 384, height: 854 });
    await fillCommonPlan(page, panel);
    const inputCard = panel.getByTestId('kphos-input-card');

    const geometry = await inputCard.evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const controls = [...card.querySelectorAll<HTMLElement>('input, select')].map((control) => control.getBoundingClientRect());
      const targetGrid = card.querySelector<HTMLElement>('.kphos-target-fields');
      const bagGrid = card.querySelector<HTMLElement>('.kphos-bag-fields');
      return {
        targetColumns: targetGrid ? getComputedStyle(targetGrid).gridTemplateColumns.split(' ').length : 0,
        bagColumns: bagGrid ? getComputedStyle(bagGrid).gridTemplateColumns.split(' ').length : 0,
        leftOverflow: Math.max(...controls.map((control) => cardRect.left - control.left)),
        rightOverflow: Math.max(...controls.map((control) => control.right - cardRect.right)),
      };
    });

    expect(geometry.targetColumns).toBe(1);
    expect(geometry.bagColumns).toBe(2);
    expect(geometry.leftOverflow).toBeLessThanOrEqual(0);
    expect(geometry.rightOverflow).toBeLessThanOrEqual(0);
    await expect(inputCard.getByRole('heading', { name: 'Targets', exact: true })).toHaveCount(0);
    await expect(inputCard.getByRole('heading', { name: 'Fluid bag', exact: true })).toHaveCount(0);
  });

  test('groups the desktop Bag targets into two balanced fields without a header gutter', async ({ page }) => {
    const panel = await openKPhos(page, { width: 1103, height: 900 });
    const targetSection = panel.locator('.kphos-target-section');

    await expect(targetSection.getByRole('group', { name: 'Phosphate target' })).toBeVisible();
    await expect(targetSection.getByRole('group', { name: 'Potassium target' })).toBeVisible();

    const geometry = await targetSection.locator('.kphos-target-fields').evaluate((grid) => {
      const gridRect = grid.getBoundingClientRect();
      const fields = [...grid.querySelectorAll<HTMLElement>(':scope > .kphos-target-column')].map((field) => field.getBoundingClientRect());
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        fieldCount: fields.length,
        leftInset: fields[0].left - gridRect.left,
        rightInset: gridRect.right - fields[1].right,
        spaceBetween: fields[1].left - fields[0].right,
        topDifference: Math.abs(fields[1].top - fields[0].top),
      };
    });

    expect(geometry.columns).toBe(2);
    expect(geometry.fieldCount).toBe(2);
    expect(geometry.leftInset).toBeLessThanOrEqual(1);
    expect(geometry.rightInset).toBeLessThanOrEqual(1);
    expect(geometry.spaceBetween).toBeGreaterThanOrEqual(16);
    expect(geometry.topDifference).toBeLessThanOrEqual(1);
  });

  test('distributes the desktop Bag details across three equal columns', async ({ page }) => {
    const panel = await openKPhos(page, { width: 1103, height: 900 });
    const detailsGrid = panel.locator('.kphos-bag-fields');

    const geometry = await detailsGrid.evaluate((grid) => {
      const gridRect = grid.getBoundingClientRect();
      const fields = [...grid.querySelectorAll<HTMLElement>(':scope > .kphos-field')].map((field) =>
        field.getBoundingClientRect(),
      );
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        fieldCount: fields.length,
        leftInset: fields[0].left - gridRect.left,
        rightInset: gridRect.right - fields[fields.length - 1].right,
        firstGap: fields[1].left - fields[0].right,
        secondGap: fields[2].left - fields[1].right,
      };
    });

    expect(geometry.columns).toBe(3);
    expect(geometry.fieldCount).toBe(3);
    expect(geometry.leftInset).toBeLessThanOrEqual(1);
    expect(geometry.rightInset).toBeLessThanOrEqual(1);
    expect(geometry.firstGap).toBeGreaterThanOrEqual(10);
    expect(geometry.secondGap).toBeGreaterThanOrEqual(10);
    const targets = await panel.locator('.kphos-target-fields').boundingBox();
    const details = await detailsGrid.boundingBox();
    expect(Math.abs(targets!.x - details!.x), 'No setup-heading gutter').toBeLessThanOrEqual(1);
    expect(Math.abs(targets!.width - details!.width), 'Settings use the full target width').toBeLessThanOrEqual(1);
  });

  test('fits fully filled Bag and CRI modes within 1920x1080', async ({ page }) => {
    for (const mode of ['Bag', 'CRI'] as const) {
      const panel = await openKPhos(page, { width: 1920, height: 1080 });
      await fillCommonPlan(page, panel);

      if (mode === 'CRI') {
        await setToggle(panel, 'Add KPhos to', true);
        await panel.getByLabel('Duration (hr)', { exact: true }).fill('12');
        await panel.getByLabel('CRI rate (mL/hr)', { exact: true }).fill('1');
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      const documentHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      expect(documentHeight, `${mode} document height`).toBeLessThanOrEqual(1080);
    }
  });
});
