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
  for (const tab of ['Drug in bag', 'KPhos/KCl', 'Ins / outs', 'CPR labels', 'Food calc']) {
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
