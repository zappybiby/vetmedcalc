import { expect, type Page, test } from '@playwright/test';

async function openInsOuts(page: Page) {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Ins / outs', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  await page.locator('#io-duration').fill('4');
}

test('results show only fluid in and out weight rates on separate lines', async ({ page }) => {
  await openInsOuts(page);
  await page.locator('#ins-total').fill('240');
  await page.locator('#out-total').fill('120');
  const results = page.getByRole('article', { name: 'Ins and outs results' });
  await expect(results).toHaveText(/Fluid in\s*6.00\s*mL\/kg\/hr\s*Fluid out\s*3.00\s*mL\/kg\/hr/);
  for (const width of [384, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const input = await page.getByTestId('io-in-weight-rate').boundingBox();
    const output = await page.getByTestId('io-out-weight-rate').boundingBox();
    expect(output!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
    expect(await results.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByLabel('Weight (kg)', { exact: true }).fill('');
  await expect(page.getByTestId('io-in-weight-rate')).toHaveText('—');
  await expect(page.getByTestId('io-out-weight-rate')).toHaveText('—');
});

test('rate and total toggles preserve the entered number', async ({ page }) => {
  await openInsOuts(page);
  await page.locator('#ins-total').fill('240');
  await page.locator('#out-total').fill('120');
  const toggle = page.getByRole('switch', { name: 'Fluid in rate mode', exact: true });
  await toggle.check();
  await expect(page.locator('#ins-rate')).toHaveValue('240');
  await expect(page.getByTestId('io-in-weight-rate')).toHaveText('24.00');
  await page.locator('#ins-rate').fill('60.5');
  await toggle.uncheck();
  await expect(page.locator('#ins-total')).toHaveValue('60.5');
  await expect(page.getByTestId('io-in-weight-rate')).toHaveText('1.51');
  await expect(page.locator('#out-total')).toHaveValue('120');
  await page.locator('#io-duration').fill('');
  await toggle.check();
  await expect(page.locator('#ins-rate')).toHaveValue('60.5');
  await expect(page.getByTestId('io-in-weight-rate')).toHaveText('6.05');
  await expect(page.getByTestId('io-out-weight-rate')).toHaveText('—');
  await page.locator('#ins-rate').fill('');
  await toggle.uncheck();
  await expect(page.locator('#ins-total')).toHaveValue('');
  await page.locator('#ins-total').fill('0');
  await toggle.check();
  await expect(page.locator('#ins-rate')).toHaveValue('0');
});
