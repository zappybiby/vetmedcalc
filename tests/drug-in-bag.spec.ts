import { expect, test, type Page } from '@playwright/test';

async function example(page: Page) {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Drug in bag', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('22');
  await page.locator('#drugbag-bag').fill('100');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Dexmedetomidine');
  await page.locator('#drugbag-stock-0').fill('0.5');
  await page.locator('#drugbag-dose-0').fill('0.25');
  await page.getByLabel('Dose unit 1', { exact: true }).selectOption('mcg/kg/hr');
  await page.locator('#drugbag-drug-1').selectOption('ketamine-100');
  await page.locator('#drugbag-dose-1').fill('5');
  await page.getByLabel('Dose unit 2', { exact: true }).selectOption('mcg/kg/hr');
  await page.locator('#drugbag-drug-2').selectOption('lidocaine-20');
  await page.locator('#drugbag-dose-2').fill('25');
}

for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080], [384, 854], [320, 740], [412, 915], [768, 1024]]) {
  test(`three medications and expanded calculations at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await example(page);
    const prep = page.getByRole('article', { name: 'Bag preparation' });
    await expect(prep).toContainText('21.15 mL');
    await expect(prep).toContainText('0.14 mL');
    await expect(prep).toContainText('0.01 mL');
    await expect(prep).toContainText('21 mL');
    await expect(prep).toContainText('8 mL/hr');
    await expect(prep).toContainText('12.5 hours');
    await expect(prep).toContainText('Delivers 0.255 mcg/kg/hr');
    await expect(prep).toContainText('Delivers 3.636 mcg/kg/hr');
    await expect(prep).toContainText('Delivers 25.455 mcg/kg/min');
    await expect(page.locator('#drugbag-drug-3')).toBeVisible();
    await page.getByText('Step-By-Step calculations', { exact: true }).last().click();
    await page.screenshot({ path: testInfo.outputPath(`drug-bag-${width}.png`), fullPage: true });
    if (width < 768) {
      // Touch targets and both input modes remain usable at phone widths.
      for (const selector of ['.precision-options label', '.mode-toggle', '.add-drug', '.field-control', '.field-select']) {
        const heights = await page.locator(`[aria-label="Drug in bag calculator"] ${selector}`).evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
      }
      await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
      await page.locator('#drugbag-time').fill('8.3');
      await page.getByRole('radio', { name: '0.1 mL/hr', exact: true }).check();
      await expect(prep).toContainText('8.3 mL/hr');
      await page.evaluate(() => document.documentElement.dataset.theme = 'light');
      await page.screenshot({ path: testInfo.outputPath(`drug-bag-rate-light-${width}.png`), fullPage: true });
    }
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      bottom: document.querySelector('[aria-label="Drug in bag calculator"]')!.getBoundingClientRect().bottom + window.scrollY,
    }));
    expect(bounds.width).toBeLessThanOrEqual(width);
    if (width >= 1280) {
      expect(bounds.height).toBeLessThanOrEqual(height);
      expect(bounds.bottom).toBeLessThanOrEqual(height);
    }
  });
}

test('incomplete and invalid cards block the full bag; blank cards, removal and rate mode work', async ({ page }) => {
  await example(page);
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(prep).toBeVisible();
  await page.locator('#drugbag-drug-3').selectOption('fentanyl-50');
  await expect(prep).toBeHidden();
  await page.locator('#drugbag-dose-3').fill('-1');
  await expect(prep).toBeHidden();
  await page.getByRole('button', { name: 'Remove medication 4' }).click();
  await expect(prep).toBeVisible();
  await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
  await page.locator('#drugbag-time').fill('10');
  await expect(prep).toContainText('17.12 mL');
  await expect(prep).toContainText('10 hours');
  await page.locator('#drugbag-time').fill('0');
  await expect(prep).toBeHidden();
  await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
  await expect(page.locator('#drugbag-time')).toHaveValue('12');
  await page.locator('#drugbag-bag').fill('10');
  await expect(prep).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('No pump rate');
});


test('pump precision changes delivered doses and runtime; 6 cc uses 0.2 mL ticks', async ({ page }) => {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Drug in bag', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  await page.locator('#drugbag-bag').fill('100');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Example');
  await page.locator('#drugbag-stock-0').fill('10');
  await page.locator('#drugbag-dose-0').fill('0.43');
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(prep).toContainText('5.4 mL');
  await expect(prep).toContainText('Delivers 0.432 mg/kg/hr');
  await expect(prep).toContainText('12.5 hours');
  await page.getByRole('radio', { name: '0.1 mL/hr', exact: true }).check();
  await expect(prep).toContainText('8.3 mL/hr');
  await expect(prep).toContainText('12 hours');
  await expect(prep).toContainText('Delivers 0.432 mg/kg/hr');
  await page.getByText('Step-By-Step calculations', { exact: true }).last().click();
  await expect(page.getByText('6 cc, 0.2 mL ticks', { exact: false })).toBeVisible();
  await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
  await page.locator('#drugbag-time').fill('15.5');
  await expect(prep).toContainText('15.5 mL/hr');
  await page.getByRole('radio', { name: '1 mL/hr', exact: true }).check();
  await expect(prep).toContainText('16 mL/hr');
  await expect(prep).toContainText('6.3 hours');
  await page.locator('#drugbag-time').fill('0.4');
  await expect(prep).toBeHidden();
  await page.getByRole('radio', { name: '0.1 mL/hr', exact: true }).check();
  await expect(page.getByRole('status')).not.toBeVisible();
});


test('MLK precision is an input, defaults to whole rates, and clean results have no boilerplate', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('vetmedcalc.theme', 'light'));
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Drug in bag', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('20');
  await page.locator('#drugbag-bag').fill('500');
  await page.locator('#drugbag-time').fill('12');
  await page.locator('#drugbag-drug-0').selectOption('custom');
  await page.locator('#drugbag-name-0').fill('Morphine');
  await page.locator('#drugbag-stock-0').fill('15');
  await page.locator('#drugbag-dose-0').fill('0.12');
  await page.locator('#drugbag-drug-1').selectOption('lidocaine-20');
  await page.locator('#drugbag-dose-1').fill('50');
  await page.locator('#drugbag-drug-2').selectOption('ketamine-100');
  await page.locator('#drugbag-dose-2').fill('10');
  await page.getByLabel('Dose unit 3', { exact: true }).selectOption('mcg/kg/min');
  const prep = page.getByRole('article', { name: 'Bag preparation' });
  await expect(page.locator('.input-column').getByRole('radio', { name: '1 mL/hr', exact: true })).toBeChecked();
  await expect(prep).toContainText('40 mL/hr');
  await page.getByRole('radio', { name: '0.1 mL/hr', exact: true }).check();
  await expect(prep).toContainText('40.4 mL/hr');
  await expect(prep).toContainText('12.4 hours');
  await expect(prep).toContainText('40.5 mL');
  await expect(prep).toContainText('Delivers 10.1 mcg/kg/min');
  await expect(prep).not.toContainText('exceeds');
  await page.screenshot({ path: testInfo.outputPath('mlk-light.png'), fullPage: true });
  await expect(page.getByRole('region', { name: 'Drug in bag calculator' })).not.toContainText(/verify|compatibility|stability|unrounded/i);
  await expect(page.getByLabel('Earlier (min)')).toHaveCount(0);
  await expect(page.getByLabel('Later (min)')).toHaveCount(0);
  await expect(page.getByText('Timing allowance:', { exact: false })).toHaveCount(0);
});
