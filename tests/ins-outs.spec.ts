import { expect, type Page, test } from '@playwright/test';

async function openInsOuts(page: Page) {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Ins / outs', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  await page.locator('#io-duration').fill('4');
}

function comparisonRow(page: Page, measurement: string) {
  return page.getByRole('table', { name: 'Fluid in and urine out comparison' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: measurement, exact: true }) })
    .getByRole('cell');
}

test('fluid balance compares all original metrics and keeps positive, negative, and zero signs clear', async ({ page }) => {
  await openInsOuts(page);
  await page.locator('#ins-total').fill('240');
  await page.locator('#out-total').fill('120');

  await expect(comparisonRow(page, 'Total (mL)')).toHaveText(['240.00', '120.00']);
  await expect(comparisonRow(page, 'Rate (mL/hr)')).toHaveText(['60.00', '30.00']);
  await expect(comparisonRow(page, 'Weight rate (mL/kg/hr)')).toHaveText(['6.00', '3.00']);
  await expect(page.getByTestId('io-net-total')).toHaveText('+120.00');
  await expect(page.getByTestId('io-net-rate')).toHaveText('+30.00');
  await expect(page.getByText('Input > output', { exact: true })).toBeVisible();

  await page.locator('#out-total').fill('320');
  await expect(page.getByTestId('io-net-total')).toHaveText('-80.00');
  await expect(page.getByTestId('io-net-rate')).toHaveText('-20.00');
  await expect(page.getByText('Input < output', { exact: true })).toBeVisible();

  await page.locator('#out-total').fill('240');
  await expect(page.getByTestId('io-net-total')).toHaveText('0.00');
  await expect(page.getByTestId('io-net-rate')).toHaveText('0.00');
  await expect(page.getByText('Input = output', { exact: true })).toBeVisible();

  await page.getByLabel('Weight (kg)', { exact: true }).fill('');
  await expect(comparisonRow(page, 'Weight rate (mL/kg/hr)')).toHaveText(['—', '—']);
  await expect(comparisonRow(page, 'Rate (mL/hr)')).toHaveText(['60.00', '60.00']);
});

test('rate and total entries use the shared period and changing modes clears only fluid in', async ({ page }) => {
  await openInsOuts(page);
  await page.locator('#ins-total').fill('240');
  await page.locator('#out-total').fill('120');

  await page.getByRole('radio', { name: 'Rate', exact: true }).check();
  await expect(page.locator('#ins-rate')).toHaveValue('');
  await expect(page.locator('#out-total')).toHaveValue('120');
  await expect(page.getByTestId('io-net-total')).toHaveText('—');
  await page.locator('#ins-rate').fill('60');
  await expect(comparisonRow(page, 'Total (mL)')).toHaveText(['240.00', '120.00']);
  await expect(page.getByTestId('io-net-total')).toHaveText('+120.00');

  await page.locator('#io-duration').fill('6');
  await expect(comparisonRow(page, 'Total (mL)')).toHaveText(['360.00', '120.00']);
  await expect(comparisonRow(page, 'Rate (mL/hr)')).toHaveText(['60.00', '20.00']);
  await expect(comparisonRow(page, 'Weight rate (mL/kg/hr)')).toHaveText(['6.00', '2.00']);
  await expect(page.getByTestId('io-net-total')).toHaveText('+240.00');
  await expect(page.getByTestId('io-net-rate')).toHaveText('+40.00');

  await page.getByRole('radio', { name: 'Total', exact: true }).check();
  await expect(page.locator('#ins-total')).toHaveValue('');
  await expect(page.locator('#out-total')).toHaveValue('120');
  await page.locator('#ins-total').fill('360');
  await expect(comparisonRow(page, 'Rate (mL/hr)')).toHaveText(['60.00', '20.00']);
  await expect(page.getByTestId('io-net-total')).toHaveText('+240.00');
  await expect(page.getByTestId('io-net-rate')).toHaveText('+40.00');
});
