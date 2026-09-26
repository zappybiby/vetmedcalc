import type { Locator, Page } from '@playwright/test';

export async function openBagSettings(scope: Page | Locator) {
  const button = scope.getByRole('button', { name: 'Bag settings', exact: true });
  if (await button.isVisible() && await button.getAttribute('aria-expanded') === 'false') await button.click();
}

export async function calculateBagIfMobile(scope: Page | Locator) {
  const button = scope.getByRole('button', { name: 'Calculate', exact: true });
  if (await button.isVisible()) await button.click();
}

export async function setToggle(scope: Page | Locator, name: string, secondSelected: boolean) {
  if (name === 'Calculation mode' || name === 'Pump rate precision') await openBagSettings(scope);
  const toggle = scope.getByRole('switch', { name, exact: true });
  if (await toggle.count()) {
    await toggle.setChecked(secondSelected);
  } else {
    // CPR species starts unset; choose an initial option before it becomes a switch.
    await scope.getByRole('button', { name, exact: true })
      .locator(`[data-side="${secondSelected ? 'second' : 'first'}"]`).click();
  }
}
