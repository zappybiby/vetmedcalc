import { expect, type Page, test } from '@playwright/test';

const RESPONSIVE_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1180, height: 720 },
  { width: 1100, height: 720 },
  { width: 1024, height: 768 },
  { width: 900, height: 700 },
  { width: 800, height: 700 },
  { width: 700, height: 700 },
  { width: 640, height: 700 },
  { width: 600, height: 700 },
  { width: 384, height: 854 },
] as const;

const FULL_DATA_TABS = [
  'CRI calculator',
  'Drug in bag',
  'Ins / outs',
  'RER calculator',
  'Venous blood gas',
  'Blood transfusion',
  'CPR labels',
] as const;

type TabName = (typeof FULL_DATA_TABS)[number];

async function openApp(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('/vetmedcalc/');
  await expect(page.getByRole('tablist', { name: 'Tool tabs' })).toBeVisible();
}

async function selectTab(page: Page, tabName: TabName) {
  const tab = page.getByRole('tab', { name: tabName });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

function activePanel(page: Page) {
  return page.locator('[role="tabpanel"] > div:not([hidden])');
}

async function fillCommonPatientData(page: Page) {
  await page.getByLabel('Weight (kg)', { exact: true }).fill('22.5');
}

async function expandActivePanel(page: Page) {
  await page
    .locator('[role="tabpanel"] > div:not([hidden]) details.ui-card, [role="tabpanel"] > div:not([hidden]) details.ui-inset')
    .evaluateAll((nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLDetailsElement) node.open = true;
      }
    });

  const collapsedButtons = activePanel(page).locator('button[aria-expanded="false"]:visible');
  for (let i = 0; i < 4; i += 1) {
    if ((await collapsedButtons.count()) === 0) break;
    await collapsedButtons.first().click();
  }
}

async function fillTabData(page: Page, tabName: TabName) {
  await selectTab(page, tabName);

  if (tabName !== 'CPR labels') {
    await fillCommonPatientData(page);
  }

  const panel = activePanel(page);

  switch (tabName) {
    case 'CRI calculator':
      await page.locator('#cri-dose').fill('0.4');
      await page.locator('#cri-duration').fill('12');
      await page.locator('#cri-rate').fill('8');
      break;
    case 'Drug in bag':
      await page.locator('#drugbag-dose').fill('1');
      await page.locator('#drugbag-bag').fill('1000');
      await page.locator('#drugbag-rate').fill('60');
      break;
    case 'Ins / outs':
      await page.locator('#ins-total').fill('240');
      await page.locator('#out-total').fill('120');
      await page.locator('#io-duration').fill('4');
      break;
    case 'RER calculator':
      await panel.getByLabel('Diet density (kcal/mL)', { exact: true }).fill('1.1');
      await panel.getByLabel('RER factor', { exact: true }).fill('1.2');
      await panel.getByLabel('Interval (hours)', { exact: true }).fill('6');
      break;
    case 'Venous blood gas':
      await panel.getByRole('button', { name: 'Dog' }).click();
      await panel.getByLabel('pH', { exact: true }).fill('7.2');
      await panel.getByLabel('pCO2', { exact: true }).fill('55');
      await panel.getByLabel('HCO3', { exact: true }).fill('18');
      await panel.getByLabel('Base excess', { exact: true }).fill('-8');
      await panel.getByLabel('TCO2 (optional)', { exact: true }).fill('19');
      await panel.getByLabel('pO2 (optional)', { exact: true }).fill('42');
      break;
    case 'Blood transfusion':
      await panel.getByLabel('Total volume (mL)', { exact: true }).fill('250');
      await panel.getByLabel('Total time (hr)', { exact: true }).fill('4');
      break;
    case 'CPR labels':
      await fillCommonPatientData(page);
      await page.locator('#cpr-patient-name').fill('Bailey');
      await panel.getByRole('button', { name: 'Dog' }).click();
      break;
  }

  await expandActivePanel(page);
}

async function expectThemeToggleNotToOverlapTabs(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const toggle = document.querySelector<HTMLElement>('.tab-theme-toggle');
    const tabs = [...document.querySelectorAll<HTMLElement>('.ui-tab')];
    const visible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const overlapArea = (a: DOMRect, b: DOMRect) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };

    if (!toggle || !visible(toggle)) return ['Theme toggle is missing or hidden.'];

    const toggleRect = toggle.getBoundingClientRect();
    return tabs
      .filter(visible)
      .map((tab) => ({ text: tab.textContent?.trim() ?? 'unknown tab', area: overlapArea(toggleRect, tab.getBoundingClientRect()) }))
      .filter((hit) => hit.area > 1)
      .map((hit) => `Theme toggle overlaps ${hit.text}.`);
  });

  expect(violations, label).toEqual([]);
}

async function expectThemeToggleIconMatchesTheme(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const theme = document.documentElement.dataset.theme;
    const thumb = document.querySelector<HTMLElement>('.theme-toggle-thumb');
    const icon = thumb?.querySelector<SVGElement>('.theme-toggle-icon');
    const issues: string[] = [];

    if (theme !== 'dark' && theme !== 'light') issues.push(`Unexpected theme ${theme ?? 'missing'}.`);
    if (!thumb) issues.push('Theme toggle thumb is missing.');
    if (!icon) issues.push('Theme toggle icon is missing.');
    if (thumb && theme && thumb.dataset.themeIcon !== theme) {
      issues.push(`Theme toggle icon is ${thumb.dataset.themeIcon ?? 'missing'} for ${theme} theme.`);
    }

    return issues;
  });

  expect(violations, label).toEqual([]);
}

async function expectTabListHasNoHorizontalOverflow(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const tablist = document.querySelector<HTMLElement>('.ui-tablist');
    if (!tablist) return ['Tab list is missing.'];

    const tolerance = 1;
    const tablistRect = tablist.getBoundingClientRect();
    const issues: string[] = [];

    if (tablist.scrollWidth > tablist.clientWidth + tolerance) {
      issues.push(`Tab list scrollWidth ${tablist.scrollWidth} exceeds clientWidth ${tablist.clientWidth}.`);
    }

    for (const tab of [...tablist.querySelectorAll<HTMLElement>('.ui-tab')]) {
      const rect = tab.getBoundingClientRect();
      if (rect.right > tablistRect.right + tolerance || rect.left < tablistRect.left - tolerance) {
        issues.push(`${tab.textContent?.trim() ?? 'Tab'} extends outside the tab list.`);
      }
    }

    return issues;
  });

  expect(violations, label).toEqual([]);
}

async function expectTabPanelHasNoExtraFrame(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const tabpanel = document.querySelector<HTMLElement>('[role="tabpanel"]');
    if (!tabpanel) return ['Tab panel is missing.'];

    const style = getComputedStyle(tabpanel);
    const backgroundIsTransparent = style.backgroundColor === 'rgba(0, 0, 0, 0)';
    const borderIsAbsent = (
      style.borderTopWidth === '0px' &&
      style.borderRightWidth === '0px' &&
      style.borderBottomWidth === '0px' &&
      style.borderLeftWidth === '0px'
    );

    const issues: string[] = [];
    if (!backgroundIsTransparent) issues.push(`Tab panel background is ${style.backgroundColor}.`);
    if (!borderIsAbsent) issues.push(`Tab panel border is ${style.border}.`);
    return issues;
  });

  expect(violations, label).toEqual([]);
}

async function expectVisibleCardShellsMatch(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"] > div:not([hidden]) .ui-card')];
    if (cards.length === 0) return ['Visible tab has no card shell.'];

    const signatureFor = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
      };
    };

    const baseline = signatureFor(cards[0]);
    return cards
      .map((card, index) => ({ index, signature: signatureFor(card) }))
      .filter(({ signature }) => JSON.stringify(signature) !== JSON.stringify(baseline))
      .map(({ index, signature }) => `Card ${index + 1} shell differs: ${JSON.stringify(signature)}.`);
  });

  expect(violations, label).toEqual([]);
}

async function expectPageHasNoHorizontalOverflow(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const tolerance = 1;
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

    if (documentWidth <= viewportWidth + tolerance) return [];

    return [`Document width ${documentWidth} exceeds viewport width ${viewportWidth}.`];
  });

  expect(violations, label).toEqual([]);
}

async function expectPageHasNoVerticalOverflow(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const tolerance = 1;
    const viewportHeight = window.innerHeight;
    const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

    if (documentHeight <= viewportHeight + tolerance) return [];

    return [`Document height ${documentHeight} exceeds viewport height ${viewportHeight}.`];
  });

  expect(violations, label).toEqual([]);
}

test.describe('responsive layout guardrails', () => {
  test('theme toggle does not overlap tab buttons', async ({ page }) => {
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await openApp(page, viewport);
      const label = `${viewport.width}x${viewport.height}`;

      await expectThemeToggleNotToOverlapTabs(page, label);
      await expectThemeToggleIconMatchesTheme(page, label);
    }
  });

  test('theme toggle icon updates with the selected theme', async ({ page }) => {
    await openApp(page, { width: 1280, height: 720 });
    await expectThemeToggleIconMatchesTheme(page, 'initial dark theme');

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expectThemeToggleIconMatchesTheme(page, 'light theme');

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectThemeToggleIconMatchesTheme(page, 'dark theme');
  });

  test('tab buttons do not create horizontal overflow', async ({ page }) => {
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await openApp(page, viewport);
      const label = `${viewport.width}x${viewport.height}`;

      await expectTabListHasNoHorizontalOverflow(page, label);
    }
  });

  test('tab content has no redundant frame and uses a consistent card shell', async ({ page }) => {
    await openApp(page, { width: 1280, height: 720 });

    for (const tabName of FULL_DATA_TABS) {
      await selectTab(page, tabName);

      await expectTabPanelHasNoExtraFrame(page, `${tabName} tab panel frame`);
      await expectVisibleCardShellsMatch(page, `${tabName} card shell`);
    }
  });

  test('filled desktop tabs fit vertically at 1920x1080', async ({ page }) => {
    await openApp(page, { width: 1920, height: 1080 });

    for (const tabName of FULL_DATA_TABS) {
      await fillTabData(page, tabName);
      await page.evaluate(() => window.scrollTo(0, 0));

      await expectPageHasNoHorizontalOverflow(page, `${tabName} horizontal overflow`);
      await expectPageHasNoVerticalOverflow(page, `${tabName} vertical overflow`);
    }
  });

  test('filled mobile tabs do not create horizontal overflow on a Galaxy S24+ sized viewport', async ({ page }) => {
    await openApp(page, { width: 384, height: 854 });

    for (const tabName of FULL_DATA_TABS) {
      await fillTabData(page, tabName);
      await page.evaluate(() => window.scrollTo(0, 0));

      await expectPageHasNoHorizontalOverflow(page, `${tabName} mobile horizontal overflow`);
      await expectTabListHasNoHorizontalOverflow(page, `${tabName} mobile tab overflow`);
      await expectThemeToggleNotToOverlapTabs(page, `${tabName} mobile toggle overlap`);
    }
  });
});
