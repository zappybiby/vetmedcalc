import { calculateBagIfMobile, setToggle } from './toggle';
import { expect, test, type Page } from '@playwright/test';

test('mobile bag results require Calculate and clear when inputs change', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Multi-Drug CRI', exact: true }).click();
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(page.getByLabel('Bag volume (mL)', { exact: true })).toBeVisible();
  await expect(page.locator('.drug-row')).toHaveCount(1);
  await expect(prep).toBeHidden();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  await page.locator('#drugbag-bag').fill('100');
  await page.locator('#drugbag-time').fill('10');
  await page.locator('#drugbag-dose-0').fill('3');
  await calculateBagIfMobile(page);
  await expect(page.locator('#drugbag-drug-0')).toBeFocused();
  await page.locator('#drugbag-drug-0').selectOption('fentanyl-50');
  await expect(page.locator('.drug-row')).toHaveCount(1);
  await expect(prep).toBeHidden();
  await calculateBagIfMobile(page);
  await expect(prep).toBeVisible();
  await page.locator('#drugbag-dose-0').fill('4');
  await expect(prep).toBeHidden();
  await calculateBagIfMobile(page);
  await expect(prep).toBeVisible();
});

async function example(page: Page) {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Multi-Drug CRI', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Calculation mode', exact: true })).toBeChecked();
  await setToggle(page, 'Calculation mode', false);
  await page.getByLabel('Weight (kg)', { exact: true }).fill('22');
  await page.locator('#drugbag-bag').fill('100');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Dexmedetomidine');
  await page.locator('#drugbag-stock-0').fill('0.5');
  await page.locator('#drugbag-dose-0').fill('0.25');
  await page.getByLabel('Dose unit 1', { exact: true }).selectOption('mcg/kg/hr');
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await page.locator('#drugbag-drug-1').selectOption('ketamine-100');
  await page.locator('#drugbag-dose-1').fill('5');
  await page.getByLabel('Dose unit 2', { exact: true }).selectOption('mcg/kg/hr');
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await page.locator('#drugbag-drug-2').selectOption('lidocaine-20');
  await page.locator('#drugbag-dose-2').fill('25');
  await calculateBagIfMobile(page);
}

for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080], [384, 854], [320, 740], [412, 915], [768, 1024], [1024, 768]]) {
  test(`three medications and expanded calculations at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await example(page);
    const prep = page.getByRole('article', { name: 'Bag preparation' });
    await expect(prep.locator('.prep-summary p')).toHaveText('Remove 22 mL from bag, then add...');
    await expect(prep).toContainText('0.14 mL');
    await expect(prep).toContainText('0.01 mL');
    await expect(prep).toContainText('21 mL');
    await expect(prep).toContainText('8 mL/hr');
    await expect(prep).toContainText('12.5 hours');
    const results = prep.getByRole('table', { name: 'Medication preparation' });
    await expect(results.locator('.delivered-result strong')).toHaveText([
      '0.255 mcg/kg/hr', '3.636 mcg/kg/hr', '25.455 mcg/kg/min',
    ]);
    await expect(results.locator('.bag-concentration strong')).toHaveText([
      '0.7 mcg/mL', '10 mcg/mL', '4.2 mg/mL',
    ]);
    await expect(page.locator('.drug-row')).toHaveCount(3);
    const alignedElements = [
      prep.getByRole('heading', { name: 'Bag preparation' }),
      prep.locator('.prep-summary p'),
      results.getByRole('rowheader', { name: 'Dexmedetomidine' }),
    ];
    const leftEdges = await Promise.all(alignedElements.map(
      element => element.evaluate(node => node.getBoundingClientRect().left),
    ));
    leftEdges.forEach(leftEdge => expect(leftEdge).toBeCloseTo(leftEdges[0], 1));
    const medicationFields = page.locator('.custom-medication .medication-fields');
    const fieldPositions = await medicationFields.locator('input, select').evaluateAll(fields =>
      fields.map(field => ({ x: field.getBoundingClientRect().left, y: field.getBoundingClientRect().top })),
    );
    expect(fieldPositions[0].x).toBeLessThan(fieldPositions[1].x);
    expect(fieldPositions[1].x).toBeLessThan(fieldPositions[2].x);
    fieldPositions.forEach(field => expect(field.y).toBeCloseTo(fieldPositions[0].y, 1));
    // Every field keeps the CRI calculator's 6 px label-to-control gap.
    const labelGaps = await page.locator('.form-card label[for]').evaluateAll(labels =>
      labels.filter(label => getComputedStyle(label).position !== 'absolute').map(label => {
        const control = document.getElementById(label.getAttribute('for')!)!;
        return control.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
      }),
    );
    for (const gap of labelGaps) expect(gap).toBeCloseTo(6, 1);
    if (width >= 1024) {
      const doseWidth = (await page.locator('#drugbag-dose-0').boundingBox())!.width;
      expect(doseWidth, 'Dose entry leaves room for decimals and number controls').toBeGreaterThanOrEqual(80);
    }
    // Neither mode text nor precision selection may move or resize the input form.
    const formGeometry = () => page.locator('.form-card').locator('.field, .bag-settings-fields, .segmented-toggle, .drug-row').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return [rect.x + window.scrollX, rect.y + window.scrollY, rect.width, rect.height];
    }));
    const beforeToggle = await formGeometry();
    const removePositions = await page.locator('.drug-row').evaluateAll(rows => rows.map(row => {
      const button = row.querySelector('.remove-drug')!.getBoundingClientRect();
      const overlapsControl = [...row.querySelectorAll('input, select')].some(control => {
        const field = control.getBoundingClientRect();
        return button.left < field.right && button.right > field.left
          && button.top < field.bottom && button.bottom > field.top;
      });
      return { rightOffset: row.getBoundingClientRect().right - button.right, overlapsControl };
    }));
    for (const position of removePositions) {
      expect(position.rightOffset).toBeCloseTo(0, 1);
      expect(position.overlapsControl).toBe(false);
    }
    await setToggle(page, 'Calculation mode', true);
    expect(await formGeometry()).toEqual(beforeToggle);
    await setToggle(page, 'Pump rate precision', true);
    expect(await formGeometry()).toEqual(beforeToggle);
    await setToggle(page, 'Calculation mode', false);
    await setToggle(page, 'Pump rate precision', false);
    expect(await formGeometry()).toEqual(beforeToggle);
    await calculateBagIfMobile(page);
    const resultGeometry = () => prep.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return [rect.x + window.scrollX, rect.y + window.scrollY, rect.width, rect.height];
    });
    const beforeExpansion = await resultGeometry();
    await page.getByText('Step-By-Step calculations', { exact: true }).last().click();
    expect(await formGeometry()).toEqual(beforeToggle);
    expect(await resultGeometry()).toEqual(beforeExpansion);
    await page.screenshot({ path: testInfo.outputPath(`drug-bag-${width}.png`), fullPage: true });
    if (width < 768) {
      // Touch targets and both input modes remain usable at phone widths.
      for (const selector of ['.segmented-toggle', '.add-drug', '.field-control', '.field-select']) {
        const heights = await page.locator(`[aria-label="Multi-Drug CRI calculator"] ${selector}`).evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(selector === '.segmented-toggle' || selector === '.add-drug' ? 36 : 40);
      }
      await setToggle(page, 'Calculation mode', true);
      await page.locator('#drugbag-time').fill('8.3');
      await setToggle(page, 'Pump rate precision', true);
      await calculateBagIfMobile(page);
      await expect(prep).toContainText('8.3 mL/hr');
      await page.evaluate(() => document.documentElement.dataset.theme = 'light');
      await page.screenshot({ path: testInfo.outputPath(`drug-bag-rate-light-${width}.png`), fullPage: true });
    }
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      bottom: document.querySelector('[aria-label="Multi-Drug CRI calculator"]')!.getBoundingClientRect().bottom + window.scrollY,
    }));
    expect(bounds.width).toBeLessThanOrEqual(width);
    // The expanded desktop fit target is 1920x1080; shorter windows can scroll vertically.
    if (width >= 1920 && height >= 1080) {
      expect(bounds.height).toBeLessThanOrEqual(height);
      expect(bounds.bottom).toBeLessThanOrEqual(height);
    }
  });
}

test('incomplete and invalid rows block the full bag; blank rows, removal and rate mode work', async ({ page }) => {
  await example(page);
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(prep).toBeVisible();
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await expect(prep).toBeVisible();
  await expect(page.locator('#drugbag-drug-3')).toBeFocused();
  await page.locator('#drugbag-drug-3').selectOption('fentanyl-50');
  await expect(prep).toBeHidden();
  await page.locator('#drugbag-dose-3').fill('-1');
  await expect(prep).toBeHidden();
  await page.getByRole('button', { name: 'Remove medication 4' }).click();
  await expect(prep).toBeVisible();
  await setToggle(page, 'Calculation mode', true);
  await page.locator('#drugbag-time').fill('10');
  await expect(prep).toContainText('Remove 18 mL');
  await expect(prep).toContainText('10 hours');
  await page.locator('#drugbag-time').fill('0');
  await expect(prep).toBeHidden();
  await setToggle(page, 'Calculation mode', false);
  await expect(page.locator('#drugbag-time')).toHaveValue('12');
  await page.locator('#drugbag-bag').fill('10');
  await expect(prep).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('No pump rate');
});


test('pump precision changes delivered doses and duration', async ({ page }) => {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Multi-Drug CRI', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Calculation mode', exact: true })).toBeChecked();
  await setToggle(page, 'Calculation mode', false);
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  await page.locator('#drugbag-bag').fill('100');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Example');
  await page.locator('#drugbag-stock-0').fill('10');
  await page.locator('#drugbag-dose-0').fill('0.43');
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(prep).toContainText('5.4 mL');
  await expect(page.getByTestId('drugbag-removal')).toHaveText('6 mL');
  await expect(prep.locator('.delivered-result strong')).toHaveText('0.432 mg/kg/hr');
  await expect(prep).toContainText('12.5 hours');
  await setToggle(page, 'Pump rate precision', true);
  await expect(prep).toContainText('8.3 mL/hr');
  await expect(page.getByTestId('drugbag-removal')).toHaveText('6 mL');
  await expect(prep).toContainText('12 hours');
  await expect(prep.locator('.delivered-result strong')).toHaveText('0.432 mg/kg/hr');
  await page.getByText('Step-By-Step calculations', { exact: true }).last().click();
  await setToggle(page, 'Calculation mode', true);
  await page.locator('#drugbag-time').fill('15.5');
  await expect(prep).toContainText('15.5 mL/hr');
  await setToggle(page, 'Pump rate precision', false);
  await expect(prep).toContainText('16 mL/hr');
  await expect(prep).toContainText('6.3 hours');
  await page.locator('#drugbag-time').fill('0.4');
  await expect(prep).toBeHidden();
  await setToggle(page, 'Pump rate precision', true);
  await expect(page.getByRole('status')).not.toBeVisible();
});


test('MLK precision is an input, defaults to whole rates, and clean results have no boilerplate', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('vetmedcalc.theme', 'light'));
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Multi-Drug CRI', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Calculation mode', exact: true })).toBeChecked();
  await setToggle(page, 'Calculation mode', false);
  await page.getByLabel('Weight (kg)', { exact: true }).fill('20');
  await page.locator('#drugbag-bag').fill('500');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Morphine');
  await page.locator('#drugbag-stock-0').fill('15');
  await page.locator('#drugbag-dose-0').fill('0.12');
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await page.locator('#drugbag-drug-1').selectOption('lidocaine-20');
  await page.locator('#drugbag-dose-1').fill('50');
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await page.locator('#drugbag-drug-2').selectOption('ketamine-100');
  await page.locator('#drugbag-dose-2').fill('10');
  await page.getByLabel('Dose unit 3', { exact: true }).selectOption('mcg/kg/min');
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(page.getByRole('switch', { name: 'Pump rate precision', exact: true })).not.toBeChecked();
  await expect(prep).toContainText('40 mL/hr');
  await setToggle(page, 'Pump rate precision', true);
  await expect(prep).toContainText('40.4 mL/hr');
  await expect(prep).toContainText('12.4 hours');
  await expect(prep).toContainText('Remove 41 mL');
  await expect(prep.locator('.draw-result').filter({ hasText: 'Ketamine' }).locator('.delivered-result strong')).toHaveText('10.1 mcg/kg/min');
  await expect(prep).not.toContainText('exceeds');
  await page.screenshot({ path: testInfo.outputPath('mlk-light.png'), fullPage: true });
  await expect(page.getByRole('region', { name: 'Multi-Drug CRI calculator' })).not.toContainText(/verify|compatibility|stability|unrounded/i);
  await expect(page.getByLabel('Earlier (min)')).toHaveCount(0);
  await expect(page.getByLabel('Later (min)')).toHaveCount(0);
  await expect(page.getByText('Timing allowance:', { exact: false })).toHaveCount(0);
});
