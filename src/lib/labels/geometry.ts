export const LABEL_PRINT_GEOMETRY = {
  // Printer reports 638 dots wide by 924 dots long at 300 dpi.
  driverStockWidthIn: 2.13,
  driverStockHeightIn: 3.08,
  // The label artwork is designed landscape, then rotated onto the driver's
  // portrait stock so the driver does not scale it down as a portrait page.
  canvasWidthIn: 3.08,
  canvasHeightIn: 2.13,
  safeWidthIn: 2.86,
  safeHeightIn: 2.13,
  safeInsetTopIn: 0,
  safeInsetRightIn: 0,
  safeInsetBottomIn: 0,
  safeInsetLeftIn: 0.22,
} as const;

const inches = (value: number) => `${value}in`;

export const LABEL_PRINT_GEOMETRY_STYLES = `
  :root {
    --label-page-width: ${inches(LABEL_PRINT_GEOMETRY.driverStockWidthIn)};
    --label-page-height: ${inches(LABEL_PRINT_GEOMETRY.driverStockHeightIn)};
    --label-stock-width: ${inches(LABEL_PRINT_GEOMETRY.canvasWidthIn)};
    --label-stock-height: ${inches(LABEL_PRINT_GEOMETRY.canvasHeightIn)};
    --label-safe-width: ${inches(LABEL_PRINT_GEOMETRY.safeWidthIn)};
    --label-safe-height: ${inches(LABEL_PRINT_GEOMETRY.safeHeightIn)};
    --label-safe-inset-top: ${inches(LABEL_PRINT_GEOMETRY.safeInsetTopIn)};
    --label-safe-inset-right: ${inches(LABEL_PRINT_GEOMETRY.safeInsetRightIn)};
    --label-safe-inset-bottom: ${inches(LABEL_PRINT_GEOMETRY.safeInsetBottomIn)};
    --label-safe-inset-left: ${inches(LABEL_PRINT_GEOMETRY.safeInsetLeftIn)};
  }
`;

export const LABEL_PAGE_SIZE = `${inches(LABEL_PRINT_GEOMETRY.driverStockWidthIn)} ${inches(LABEL_PRINT_GEOMETRY.driverStockHeightIn)}`;
