import { expect, test, type Locator } from '@playwright/test';

test('binary toggles respond on both sides, their edge, and the keyboard', async ({ page }) => {
  await page.goto('/vetmedcalc/');
  async function exercise(toggle: Locator) {
    const initial = await toggle.isChecked();
    await toggle.locator(`[data-side="${initial ? 'second' : 'first'}"]`).click();
    await expect(toggle).toBeChecked({ checked: !initial });
    await toggle.locator(`[data-side="${initial ? 'second' : 'first'}"]`).click();
    await expect(toggle).toBeChecked({ checked: initial });
    const bounds = (await toggle.boundingBox())!;
    await toggle.click({ position: { x: bounds.width / 2, y: 1 } });
    await expect(toggle).toBeChecked({ checked: !initial });
    await toggle.press('Space');
    await expect(toggle).toBeChecked({ checked: initial });
    await toggle.press('Enter');
    await expect(toggle).toBeChecked({ checked: !initial });
  }
  for (const tab of ['Multi-Drug CRI', 'KPhos/KCl', 'Ins / outs', 'Tube Feeding', 'CPR labels', 'Food calc']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const panel = page.locator('[role="tabpanel"] > div:not([hidden])');
    if (tab === 'CPR labels') {
      const species = panel.getByRole('switch', { name: 'Species', exact: true });
      await expect(species).not.toBeChecked();
      await expect(species.locator('.is-selected')).toHaveText('Dog');
    }
    for (const toggle of await panel.locator('.segmented-toggle:visible').all()) {
      const name = (await toggle.getAttribute('aria-label'))!;
      if (name !== 'Batch mode') await exercise(panel.getByRole('switch', { name, exact: true }));
    }
    if (tab === 'CPR labels') {
      await exercise(panel.getByRole('switch', { name: 'Batch mode', exact: true }));
      await panel.getByRole('switch', { name: 'Batch mode', exact: true }).uncheck();
    }
  }
});

test('tube feeding uses the selected mode independently of the interval', async ({ page }) => {
  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Tube Feeding', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('44.2');

  const mode = page.getByRole('switch', { name: 'Feeding mode' });
  const interval = page.getByLabel('Interval (hours)', { exact: true });
  const continuous = page.getByRole('article', { name: 'Continuous rate' });
  await expect(mode).not.toBeChecked();
  await interval.fill('1');
  await expect(page.getByText('Give every 1 hr', { exact: true })).toBeVisible();
  await expect(continuous).toBeHidden();

  await interval.clear();
  await mode.check();
  await expect(interval).toBeHidden();
  await expect(continuous).toContainText('55.6 mL/hr');
  await expect(page.getByText(/^Give every \d/)).toBeHidden();

  await mode.uncheck();
  await expect(interval).toHaveValue('');
  await interval.fill('2');
  await mode.check();
  await mode.uncheck();
  await expect(interval).toHaveValue('2');
  await expect(page.getByText('Give every 2 hr', { exact: true })).toBeVisible();
  await expect(continuous).toBeHidden();
});
