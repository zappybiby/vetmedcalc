import { expect, test, type Page } from '@playwright/test';

const TEXT_RATIO = 4.5;
const CONTROL_BOUNDARY_RATIO = 3;

type Theme = 'dark' | 'light';

type ContrastViolation = {
  label: string;
  ratio: number;
  threshold: number;
};

async function openTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => {
    localStorage.setItem('vetmedcalc.theme', value);
  }, theme);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/vetmedcalc/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function expectThemeContrast(page: Page, theme: Theme) {
  const violations = await page.evaluate(
    ({ boundaryRatio, textRatio }) => {
      type Rgba = { r: number; g: number; b: number; a: number };

      const parseColor = (value: string): Rgba => {
        const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
        if (rgbMatch) {
          const parts = rgbMatch[1].split(',').map((part) => Number(part.trim()));
          const [r = 0, g = 0, b = 0, a = 1] = parts;
          return { r, g, b, a };
        }

        const srgbMatch = value.match(/^color\(srgb\s+([^)]+)\)$/);
        if (srgbMatch) {
          const [channels, alpha = '1'] = srgbMatch[1].split('/').map((part) => part.trim());
          const [r = 0, g = 0, b = 0] = channels.split(/\s+/).map((part) => Number(part) * 255);
          return { r, g, b, a: Number(alpha) };
        }

        throw new Error(`Unsupported computed color: ${value}`);
      };

      const blend = (fg: Rgba, bg: Rgba): Rgba => {
        const a = fg.a + bg.a * (1 - fg.a);
        if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };

        return {
          r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
          g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
          b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
          a,
        };
      };

      const luminance = (color: Rgba): number => {
        const convert = (channel: number) => {
          const value = channel / 255;
          return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };

        return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
      };

      const contrast = (a: Rgba, b: Rgba): number => {
        const first = luminance(a);
        const second = luminance(b);
        const lighter = Math.max(first, second);
        const darker = Math.min(first, second);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const backgroundFor = (element: Element): Rgba => {
        let current: Element | null = element;
        while (current) {
          const color = parseColor(getComputedStyle(current).backgroundColor);
          if (color.a > 0) return color;
          current = current.parentElement;
        }

        return parseColor(getComputedStyle(document.body).backgroundColor);
      };

      const boundaryFor = (element: HTMLElement): Rgba => {
        const parentBackground = backgroundFor(element.parentElement ?? document.body);
        return blend(parseColor(getComputedStyle(element).borderTopColor), parentBackground);
      };

      const samples: ContrastViolation[] = [];

      const checkText = (selector: string, label: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          samples.push({ label: `${label} missing`, ratio: 0, threshold: textRatio });
          return;
        }

        const style = getComputedStyle(element);
        const ratio = contrast(parseColor(style.color), backgroundFor(element));
        if (ratio < textRatio) {
          samples.push({ label, ratio: Number(ratio.toFixed(2)), threshold: textRatio });
        }
      };

      const checkBoundary = (selector: string, label: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          samples.push({ label: `${label} missing`, ratio: 0, threshold: boundaryRatio });
          return;
        }

        const boundary = boundaryFor(element);
        const ownBackground = backgroundFor(element);
        const parentBackground = backgroundFor(element.parentElement ?? document.body);
        const ratio = Math.min(contrast(boundary, ownBackground), contrast(boundary, parentBackground));
        if (ratio < boundaryRatio) {
          samples.push({ label, ratio: Number(ratio.toFixed(2)), threshold: boundaryRatio });
        }
      };

      checkText('.ui-tab:not(.ui-tab-active)', 'inactive tab text');
      checkText('.ui-tab-active', 'active tab text');
      checkText('.field-control', 'input text');
      checkText('.field-select', 'select text');
      checkText('.ui-label', 'field label text');

      checkBoundary('.field-control', 'input boundary');
      checkBoundary('.field-select', 'select boundary');
      checkBoundary('.ui-tab:not(.ui-tab-active)', 'inactive tab boundary');
      checkBoundary('.ui-tab-active', 'active tab boundary');
      checkBoundary('.ui-button', 'button boundary');

      return samples;
    },
    { boundaryRatio: CONTROL_BOUNDARY_RATIO, textRatio: TEXT_RATIO },
  );

  expect(violations, `${theme} theme contrast`).toEqual([]);
}

test.describe('theme contrast guardrails', () => {
  test('dark theme interactive controls meet contrast thresholds', async ({ page }) => {
    await openTheme(page, 'dark');
    await expectThemeContrast(page, 'dark');
  });

  test('light theme interactive controls meet contrast thresholds', async ({ page }) => {
    await openTheme(page, 'light');
    await expectThemeContrast(page, 'light');
  });
});
