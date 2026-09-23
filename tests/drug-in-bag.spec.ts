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
  await page.getByRole('button', { name: 'Add medication' }).click();
  await page.locator('#drugbag-drug-2').selectOption('lidocaine-20');
  await page.locator('#drugbag-dose-2').fill('25');
}

for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080], [384, 854], [320, 740]]) {
  test(`three medications and expanded calculations at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await example(page);
    const prep = page.getByRole('article', { name: 'Bag preparation' });
    await expect(prep).toContainText('19.9452 mL');
    await expect(prep).toContainText('0.132 mL');
    await expect(prep).toContainText('0.0132 mL');
    await expect(prep).toContainText('19.8 mL');
    await expect(prep).toContainText('8.333 mL/hr');
    await page.getByText('Step-By-Step calculations', { exact: true }).last().click();
    await page.screenshot({ path: testInfo.outputPath(`drug-bag-${width}.png`), fullPage: true });
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
  await page.getByRole('button', { name: 'Add medication' }).click();
  await expect(prep).toBeVisible();
  await page.locator('#drugbag-drug-3').selectOption('fentanyl-50');
  await expect(prep).toBeHidden();
  await page.locator('#drugbag-dose-3').fill('-1');
  await expect(prep).toBeHidden();
  await page.getByRole('button', { name: 'Remove medication 4' }).click();
  await expect(prep).toBeVisible();
  await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
  await page.locator('#drugbag-time').fill('10');
  await expect(prep).toContainText('16.621 mL');
  await expect(prep).toContainText('10 hr');
  await page.locator('#drugbag-time').fill('0');
  await expect(prep).toBeHidden();
  await page.getByRole('switch', { name: 'Enter pump rate instead of duration' }).click();
  await expect(page.locator('#drugbag-time')).toHaveValue('12');
  await page.locator('#drugbag-bag').fill('10');
  await expect(prep).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('exceeding');
});
