import { expect, type Page, test } from '@playwright/test';

type ClipboardMode = 'success' | 'denied' | 'unavailable';

async function openFood(page: Page, clipboardMode: ClipboardMode = 'success') {
  await page.addInitScript((mode) => {
    const writes: string[] = [];
    Object.defineProperty(window, 'foodClipboardWrites', { value: writes });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: mode === 'unavailable' ? undefined : {
        writeText: async (text: string) => {
          if (mode === 'denied') throw new DOMException('Clipboard denied', 'NotAllowedError');
          writes.push(text);
        },
      },
    });
  }, clipboardMode);

  await page.goto('/vetmedcalc/');
  await page.getByRole('tab', { name: 'Food calc', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('10');
  return page.getByRole('region', { name: 'Food calculator', exact: true });
}

async function clipboardWrites(page: Page) {
  return page.evaluate(() => (window as unknown as { foodClipboardWrites: string[] }).foodClipboardWrites);
}

test('copies only the food name, decimal portion, interval and matching calories', async ({ page }) => {
  const panel = await openFood(page);
  // Shared patient details must not add extra text to the copied feeding line.
  await page.getByRole('tab', { name: 'CPR labels', exact: true }).click();
  await page.locator('#cpr-patient-name').fill('Bailey');
  await page.getByRole('tab', { name: 'Food calc', exact: true }).click();
  await panel.getByRole('button', { name: 'Dog', exact: true }).click();
  await panel.getByLabel('RER factor', { exact: true }).fill('1.2');
  await panel.getByLabel('Interval (hours)', { exact: true }).fill('6');

  await panel.getByRole('button', { name: "Copy note for Hill's a/d Urgent Care", exact: true }).click();

  await expect.poll(() => clipboardWrites(page)).toEqual([
    "Hill's a/d: 0.65 cans every 6 hours (119 kcal/feed).",
  ]);
  await expect(panel.getByRole('status')).toHaveText("Copied Hill's a/d Urgent Care feeding note.");
});

test('mobile custom notes follow species, weight, interval and calorie changes', async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 854 });
  const panel = await openFood(page);
  await panel.getByRole('button', { name: 'Cat', exact: true }).click();
  await page.getByLabel('Weight (kg)', { exact: true }).fill('4');
  await panel.getByLabel('RER factor', { exact: true }).fill('1');
  await panel.getByLabel('Interval (hours)', { exact: true }).fill('8');
  await panel.getByLabel('Custom kcal/can', { exact: true }).fill('200');
  await expect(panel.getByText("Hill's c/d Feline Urinary Ocean Fish", { exact: true })).toBeVisible();
  await expect(panel.getByText("Hill's k/d Canine Chicken", { exact: true })).toHaveCount(0);

  const copy = panel.getByRole('button', { name: 'Copy note for custom food', exact: true });
  await copy.click();
  await expect.poll(() => clipboardWrites(page)).toEqual([
    'Custom food: 0.33 cans every 8 hours (66 kcal/feed).',
  ]);

  await panel.getByLabel('Custom kcal/can', { exact: true }).fill('400');
  await expect(panel.getByRole('status')).toBeEmpty();
  await expect(copy).toHaveText('Copy note');
  await copy.click();
  await expect.poll(async () => (await clipboardWrites(page))[1]).toBe(
    'Custom food: 0.16 cans every 8 hours (64 kcal/feed).',
  );

  await panel.getByLabel('Custom kcal/can', { exact: true }).fill('0');
  await expect(copy).toHaveCount(0);
  await panel.getByLabel('RER factor', { exact: true }).fill('0');
  await expect(panel.getByRole('button', { name: /^Copy note for/ })).toHaveCount(0);
});

for (const mode of ['denied', 'unavailable'] as const) {
  test(`provides a selectable note when the clipboard is ${mode}`, async ({ page }) => {
    const panel = await openFood(page, mode);
    await panel.getByRole('button', { name: "Copy note for Hill's a/d Urgent Care", exact: true }).click();

    await expect(panel.getByRole('status')).toHaveText('Clipboard unavailable. Select and copy the note below.');
    const note = panel.getByRole('textbox', { name: 'Feeding note', exact: true });
    await expect(note).toHaveValue(
      "Hill's a/d: 0.54 cans every 6 hours (99 kcal/feed).",
    );
    await note.focus();
    await expect.poll(() => note.evaluate((element: HTMLTextAreaElement) =>
      element.selectionEnd - element.selectionStart === element.value.length,
    )).toBe(true);
    expect(await clipboardWrites(page)).toEqual([]);

    await panel.getByLabel('RER factor', { exact: true }).fill('1.2');
    await expect(note).toHaveCount(0);
    await expect(panel.getByRole('status')).toBeEmpty();
  });
}
