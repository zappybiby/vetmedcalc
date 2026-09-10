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
    ]) {
      await expect(panel.getByText(text, { exact: true })).toHaveCount(0);
    }

    await expect(inputCard.getByText('Mode:', { exact: true })).toBeVisible();
    await expect(inputCard.getByRole('heading', { name: 'Targets', exact: true })).toHaveCount(0);
    await expect(inputCard.getByLabel('Fluid Type', { exact: true })).toBeVisible();
    await expect(panel.getByTestId('kphos-results')).toHaveCount(0);

    await inputCard.getByRole('button', { name: 'CRI', exact: true }).click();
    await expect(inputCard.getByText('Preparation and main fluid', { exact: true })).toHaveCount(0);
    await expect(inputCard.getByLabel('Fluid Type', { exact: true })).toBeVisible();
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

    expect(await placeholderStyle('#kphos-phos-target')).toEqual(await placeholderStyle('#drugbag-dose'));
  });

  test('orders and formats the bag preparation summary', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('22');
    await panel.getByLabel('Bag volume (mL)', { exact: true }).fill('1000');
    await panel.getByLabel('Fluid rate (mL/hr)', { exact: true }).fill('86');
    await panel.getByLabel('Phosphate target (mmol/kg/hr)', { exact: true }).fill('0.02');
    await panel.getByLabel('Added potassium target (mEq/L)', { exact: true }).fill('30');

    const results = panel.getByTestId('kphos-results');
    const summary = panel.getByTestId('kphos-source-summary');
    const resultText = (await results.innerText()).replace(/\s+/g, ' ');

    await expect(results.getByTestId('kphos-stock-volume')).toHaveText('1.7 mL KPhos');
    await expect(results.getByTestId('kcl-stock-volume')).toHaveText('11.2 mL KCl');
    await expect(results.getByText('From all sources, this delivers:')).toBeVisible();
    await expect(results.getByTestId('total-phos-delivery')).toHaveText('0.02 mmol/kg/hr phosphate');
    await expect(results.getByTestId('total-k-delivery')).toHaveText('0.14 mEq/kg/hr potassium');
    await expect(summary.getByText('Composition breakdown')).toHaveCount(0);
    await expect(summary.getByText('How the fluid bag is built')).toHaveCount(0);
    await expect(summary.getByTestId('starting-fluid-component')).toHaveText(/Starting bag\s+1,000 mL Norm-R\s+K\s*5 mEq\/L\s+Phos\s*0 mmol\/L/);
    await expect(summary.getByTestId('kphos-component')).toHaveText(/KPhos additive\s+1.7 mL KPhos\s+K\s*\+7.48 mEq\/L\s+Phos\s*\+5.1 mmol\/L/);
    await expect(summary.getByTestId('kcl-component')).toHaveText(/KCl additive\s+11.2 mL KCl\s+K\s*\+22.4 mEq\/L\s+Phos\s*0 mmol\/L/);
    await expect(summary.getByTestId('final-bag-component')).toHaveText(/Final bag\s+Combined\s+K\s*34.88 mEq\/L\s+Phos\s*5.1 mmol\/L/);
    await expect(summary.getByTestId('native-fluid-delivery')).toHaveCount(0);
    await expect(panel.getByTestId('selected-k-actual')).toHaveCount(0);
    expect(await results.getByTestId('kphos-delivery-summary').evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )).toBe(15);

    const compositionFlow = await summary.locator('.kphos-mixture-flow').evaluate((flow) => ({
      columns: getComputedStyle(flow).gridTemplateColumns.split(' ').length,
      componentOrder: [...flow.querySelectorAll<HTMLElement>('[data-testid$="-component"]')]
        .map((component) => component.dataset.testid),
      operators: [...flow.querySelectorAll<HTMLElement>('[data-operator]')]
        .map((component) => component.dataset.operator),
    }));
    expect(compositionFlow).toEqual({
      columns: 4,
      componentOrder: ['starting-fluid-component', 'kphos-component', 'kcl-component', 'final-bag-component'],
      operators: ['+', '+', '='],
    });
    expect(resultText.indexOf('From all sources')).toBeLessThan(resultText.indexOf('STARTING BAG'));
  });

  test('supports a phosphate-only CRI and shows the main-fluid source in the visual flow', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
    await panel.getByRole('button', { name: 'CRI', exact: true }).click();
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
    const criRegion = summary.getByRole('region', { name: 'KPhos CRI composition' });
    await expect(criRegion).toBeVisible();
    await expect(summary.getByTestId('starting-fluid-component')).toHaveText(
      /Running fluid\s+Isolyte S pH 7.4 at 100 mL\/hr\s+K\s*0.05 mEq\/kg\/hr\s+Phos\s*0.005 mmol\/kg\/hr/,
    );
    await expect(summary.getByTestId('final-bag-component')).toHaveCount(0);
    await expect(summary.getByTestId('final-cri-component')).toContainText('Prepared CRI');

    const criFlowStyles = await criRegion.locator('.kphos-mixture-flow').evaluate((flow) => {
      const cards = [...flow.querySelectorAll<HTMLElement>('.kphos-mixture-card')];
      return {
        columns: getComputedStyle(flow).gridTemplateColumns.split(' ').length,
        cardCount: cards.length,
        totalBorder: getComputedStyle(cards[cards.length - 1]).borderColor,
        sourceBorder: getComputedStyle(cards[0]).borderColor,
      };
    });
    expect(criFlowStyles.columns).toBe(3);
    expect(criFlowStyles.cardCount).toBe(3);
    expect(criFlowStyles.totalBorder).not.toBe(criFlowStyles.sourceBorder);

    const primaryTextSizes = await results.getByRole('region', { name: 'Preparation and delivery' }).locator('p.ui-instruction').first().evaluate((row) => ({
      row: Number.parseFloat(getComputedStyle(row).fontSize),
      value: Number.parseFloat(getComputedStyle(row.querySelector('.ui-statement-value') as Element).fontSize),
    }));
    expect(primaryTextSizes.row).toBeGreaterThanOrEqual(14);
    expect(primaryTextSizes.value).toBeGreaterThan(primaryTextSizes.row);

    // Target labels use the same visual role as the reference CRI field label.
    const referenceLabelStyle = await page.locator('label[for="cri-med"]').evaluate((label) => {
      const style = getComputedStyle(label);
      return { size: style.fontSize, weight: style.fontWeight, tracking: style.letterSpacing };
    });
    for (const text of ['Phosphate target', 'Potassium target']) {
      const targetLabelStyle = await panel.getByText(text, { exact: true }).evaluate((label) => {
        const style = getComputedStyle(label);
        return { size: style.fontSize, weight: style.fontWeight, tracking: style.letterSpacing };
      });
      expect(targetLabelStyle).toEqual(referenceLabelStyle);
    }
  });

  test('switches the potassium target between Added and Total without moving results', async ({ page }) => {
    const panel = await openKPhos(page);
    await fillCommonPlan(page, panel);

    const resultTop = await panel.getByTestId('kphos-results').evaluate((element) => element.getBoundingClientRect().top);
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('12 mL');

    await panel.getByTestId('k-target-basis').click();

    await expect(panel.getByTestId('k-target-basis')).toHaveText('Total');
    await expect(panel.getByLabel('Total potassium target (mEq/L)', { exact: true })).toHaveValue('30');
    await expect(panel.getByTestId('kcl-stock-volume')).toContainText('9.6 mL');
    const totalResultTop = await panel.getByTestId('kphos-results').evaluate((element) => element.getBoundingClientRect().top);
    expect(Math.abs(totalResultTop - resultTop)).toBeLessThanOrEqual(1);
  });

  test('switches between CRI and bag preparation without losing shared inputs', async ({ page }) => {
    const panel = await openKPhos(page);
    await page.getByLabel('Weight (kg)', { exact: true }).fill('10');

    await panel.getByRole('button', { name: 'CRI', exact: true }).click();
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

    await panel.getByRole('button', { name: 'Bag', exact: true }).click();

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

      await panel.getByRole('button', { name: 'CRI', exact: true }).click();
      await panel.getByLabel('Duration (hr)', { exact: true }).fill('12');
      await panel.getByLabel('CRI rate (mL/hr)', { exact: true }).fill('1');

      const criGeometry = await inputCard.evaluate((element) => {
        const input = element.getBoundingClientRect();
        const result = document.querySelector<HTMLElement>('[data-testid="kphos-results"]')?.getBoundingClientRect();
        return { inputBottom: input.bottom + window.scrollY, inputLeft: input.left, inputRight: input.right, resultTop: result ? result.top + window.scrollY : 0, resultLeft: result?.left ?? 0, resultRight: result?.right ?? 0 };
      });

      const referenceGap = await page.getByRole('region', { name: 'CRI calculator', includeHidden: true }).evaluate(
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

    expect(geometry.targetColumns).toBe(2);
    expect(geometry.bagColumns).toBe(2);
    expect(geometry.leftOverflow).toBeLessThanOrEqual(0);
    expect(geometry.rightOverflow).toBeLessThanOrEqual(0);
    await expect(inputCard.getByRole('heading', { name: 'Targets', exact: true })).toHaveCount(0);
    await expect(inputCard.getByRole('heading', { name: 'Fluid bag', exact: true })).toBeVisible();
  });

  test('groups the desktop Bag targets into two balanced fields without a header gutter', async ({ page }) => {
    const panel = await openKPhos(page, { width: 1103, height: 900 });
    const targetSection = panel.locator('.kphos-target-section');

    await expect(targetSection.getByRole('heading')).toHaveCount(0);
    await expect(targetSection).toContainText('Phosphate target');
    await expect(targetSection).toContainText('Potassium target');

    const geometry = await targetSection.locator('.kphos-target-fields').evaluate((grid) => {
      const gridRect = grid.getBoundingClientRect();
      const fields = [...grid.querySelectorAll<HTMLElement>(':scope > .kphos-field')].map((field) => field.getBoundingClientRect());
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
  });

  test('fits fully filled Bag and CRI modes within 1440x900', async ({ page }) => {
    for (const mode of ['Bag', 'CRI'] as const) {
      const panel = await openKPhos(page, { width: 1440, height: 900 });
      await fillCommonPlan(page, panel);

      if (mode === 'CRI') {
        await panel.getByRole('button', { name: 'CRI', exact: true }).click();
        await panel.getByLabel('Duration (hr)', { exact: true }).fill('12');
        await panel.getByLabel('CRI rate (mL/hr)', { exact: true }).fill('1');
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      const documentHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      expect(documentHeight, `${mode} document height`).toBeLessThanOrEqual(901);
    }
  });
});
