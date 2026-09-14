import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

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

async function expectFoodFitsViewport(page: Page, panel: Locator, testInfo: TestInfo, state: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const layout = await panel.evaluate((root) => {
    const tolerance = 1;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const documentSize = {
      width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    };
    const violations: string[] = [];
    const within = (rect: DOMRect, boundary: { left: number; right: number; top: number; bottom: number }) =>
      rect.left >= boundary.left - tolerance && rect.right <= boundary.right + tolerance &&
      rect.top >= boundary.top - tolerance && rect.bottom <= boundary.bottom + tolerance;
    const screen = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };

    if (documentSize.width > viewport.width + tolerance) violations.push('The page scrolls horizontally.');
    if (documentSize.height > viewport.height + tolerance) violations.push('The page scrolls vertically.');

    // Text ranges expose clipped or overlapping labels even if an ancestor hides
    // overflow and the document itself reports that it fits the viewport.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      if (!parent || !text) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) continue;

      const ancestors: HTMLElement[] = [];
      for (let element: HTMLElement | null = parent; element; element = element.parentElement) ancestors.push(element);
      // Responsive table captions intentionally retain screen-reader-only text.
      if (ancestors.some((element) => {
        const style = getComputedStyle(element);
        return style.visibility === 'hidden' || style.display === 'none' ||
          (style.position === 'absolute' && element.clientWidth <= 1 && element.clientHeight <= 1);
      })) continue;

      for (const rect of rects) {
        if (!within(rect, screen)) violations.push(`Text outside viewport: ${text}`);
        const cell = parent.closest('th, td');
        if (cell && !within(rect, cell.getBoundingClientRect())) violations.push(`Text outside table cell: ${text}`);
        for (const ancestor of ancestors) {
          const style = getComputedStyle(ancestor);
          const boundary = ancestor.getBoundingClientRect();
          if (/(hidden|clip|auto|scroll)/.test(style.overflowX) &&
              (rect.left < boundary.left - tolerance || rect.right > boundary.right + tolerance)) {
            violations.push(`Horizontally clipped text: ${text}`);
          }
          if (/(hidden|clip|auto|scroll)/.test(style.overflowY) &&
              (rect.top < boundary.top - tolerance || rect.bottom > boundary.bottom + tolerance)) {
            violations.push(`Vertically clipped text: ${text}`);
          }
        }
      }
    }

    for (const control of root.querySelectorAll<HTMLElement>('input, button, textarea')) {
      const rect = control.getBoundingClientRect();
      if (rect.width && rect.height && !within(rect, screen)) {
        violations.push(`Control outside viewport: ${control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName}`);
      }
      if (control instanceof HTMLTextAreaElement &&
          (control.scrollHeight > control.clientHeight + tolerance || control.scrollWidth > control.clientWidth + tolerance)) {
        violations.push('The feeding note requires internal scrolling.');
      }
    }

    return {
      viewport,
      documentSize,
      panelBottom: root.getBoundingClientRect().bottom,
      tableHeights: [...root.querySelectorAll('table')].map((table) => table.getBoundingClientRect().height),
      violations: [...new Set(violations)],
    };
  });
  const screenshot = testInfo.outputPath(`${state}.png`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled', caret: 'hide' });
  await testInfo.attach(state, { path: screenshot, contentType: 'image/png' });
  expect.soft(layout.violations, `${state}: ${JSON.stringify(layout)}`).toEqual([]);
}

for (const viewport of [
  { width: 1280, height: 720, theme: 'dark' },
  { width: 1280, height: 720, theme: 'light' },
  { width: 1366, height: 768, theme: 'dark' },
  { width: 1440, height: 900, theme: 'dark' },
  { width: 1920, height: 1080, theme: 'dark' },
] as const) {
  test(`fully populated food calculator fits ${viewport.width}x${viewport.height} in ${viewport.theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const panel = await openFood(page);
    if (viewport.theme === 'light') await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    await page.getByLabel('Weight (kg)', { exact: true }).fill('22.5');
    await panel.getByLabel('RER factor', { exact: true }).fill('1.2');
    await panel.getByLabel('Interval (hours)', { exact: true }).fill('6');
    await panel.getByLabel('Custom kcal/can', { exact: true }).fill('200');

    for (const species of [
      { label: 'Dog', rows: 14, food: "Hill's i/d Low Fat Rice, Vegetable & Chicken Stew" },
      { label: 'Cat', rows: 13, food: "Hill's z/d Food Sensitivity Original/Hydrolyzed Chicken" },
    ]) {
      await panel.getByRole('button', { name: species.label, exact: true }).click();
      await expect(panel.locator('tbody tr')).toHaveCount(species.rows);
      await expect(panel.getByRole('button', { name: /^Copy note for/ })).toHaveCount(species.rows);
      const state = `${viewport.width}x${viewport.height}-${viewport.theme}-${species.label.toLowerCase()}`;
      await expectFoodFitsViewport(page, panel, testInfo, `${state}-populated`);

      // Use long food names to exercise the longest success messages and notes.
      const copy = panel.getByRole('button', { name: `Copy note for ${species.food}`, exact: true });
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => {} },
      }));
      await copy.click();
      await expect(panel.getByRole('status')).toHaveText(`Copied ${species.food} feeding note.`);
      await expectFoodFitsViewport(page, panel, testInfo, `${state}-copied`);

      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError'); } },
      }));
      await copy.click();
      await expect(panel.getByRole('textbox', { name: 'Feeding note', exact: true })).toBeVisible();
      await expectFoodFitsViewport(page, panel, testInfo, `${state}-fallback`);
    }
  });
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
