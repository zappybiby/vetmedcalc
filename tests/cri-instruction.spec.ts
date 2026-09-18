import { expect, test } from '@playwright/test';
import { MEDICATIONS } from '../src/lib/definitions/medications';

for (const width of [320, 360, 384, 412, 640, 768, 1024, 1280, 1920]) {
  test(`CRI instruction keeps diluent together for every preset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width >= 1280 ? 720 : 854 });
    await page.goto('/vetmedcalc/');
    await page.getByLabel('Weight (kg)', { exact: true }).fill('5');
    await page.locator('#cri-duration').fill('12');
    const instruction = page.locator('[aria-label="CRI calculator"] .ui-instruction');

    for (const med of MEDICATIONS) {
      await page.locator('#cri-med').selectOption(med.id);
      await page.getByRole('region', { name: 'CRI calculator', exact: true }).getByLabel('Dose unit', { exact: true }).selectOption('mg/kg/day');
      // Keep the stock draw at 0.5 mL so every name exercises the diluted layout.
      const concentrationMgMl = med.concentration.units === 'mg/mL' ? med.concentration.value : med.concentration.value / 1000;
      await page.locator('#cri-dose').fill(String(concentrationMgMl * 0.2));
      for (const rate of ['1', '100']) {
        await page.locator('#cri-rate').fill(rate);
        await expect(instruction).toContainText(med.name);
        await expect(instruction.getByText('diluent', { exact: true })).toBeVisible();
        const geometry = await instruction.evaluate((element) => {
          const stock = element.firstElementChild!;
          const diluent = Array.from(element.querySelectorAll('span')).find((span) => span.textContent === 'diluent')!;
          const group = diluent.parentElement!;
          const textRects = Array.from(group.children).map((child) => {
            const range = document.createRange();
            range.selectNodeContents(child);
            return Array.from(range.getClientRects()).map((rect) => ({ top: rect.top, bottom: rect.bottom }));
          });
          const bounds = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            onNewLine: group.getBoundingClientRect().top >= stock.getBoundingClientRect().bottom - 1,
            sameLine: Math.max(...textRects.flat().map((rect) => rect.top)) < Math.min(...textRects.flat().map((rect) => rect.bottom)),
            contained: Array.from(range.getClientRects()).every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
            pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        expect(geometry, `${med.name}, rate ${rate}, width ${width}`).toEqual({
          onNewLine: true, sameLine: true, contained: true, pageOverflow: false,
        });
      }
    }
  });
}

test('undiluted CRI has no diluent line and keeps the pump rate intact', async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 854 });
  await page.goto('/vetmedcalc/');
  await page.getByLabel('Weight (kg)', { exact: true }).fill('5');
  await page.locator('#cri-dose').fill('0.4');
  await page.locator('#cri-duration').fill('12');
  const instruction = page.locator('[aria-label="CRI calculator"] .ui-instruction');
  await expect(instruction).toContainText('and run at');
  await expect(instruction).not.toContainText('diluent');
  const rate = instruction.locator(':scope > span').last();
  expect(await rate.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
