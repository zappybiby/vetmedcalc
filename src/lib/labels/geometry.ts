export const LABEL_PRINT_GEOMETRY = {
  // Printer reports 638 dots wide by 924 dots long at 300 dpi.
  driverStockWidthIn: 2.13,
  driverStockHeightIn: 3.08,
  canvasWidthIn: 3.08,
  canvasHeightIn: 2.13,
  safeWidthIn: 3.08,
  safeHeightIn: 2.13,
  safeInsetTopIn: 0,
  safeInsetBottomIn: 0,
} as const;

const inches = (value: number) => `${value}in`;

export const LABEL_PRINT_GEOMETRY_STYLES = `
  :root {
    --label-stock-width: ${inches(LABEL_PRINT_GEOMETRY.canvasWidthIn)};
    --label-stock-height: ${inches(LABEL_PRINT_GEOMETRY.canvasHeightIn)};
    --label-safe-width: ${inches(LABEL_PRINT_GEOMETRY.safeWidthIn)};
    --label-safe-height: ${inches(LABEL_PRINT_GEOMETRY.safeHeightIn)};
    --label-safe-inset-top: ${inches(LABEL_PRINT_GEOMETRY.safeInsetTopIn)};
    --label-safe-inset-bottom: ${inches(LABEL_PRINT_GEOMETRY.safeInsetBottomIn)};
  }
`;

export const LABEL_PAGE_SIZE = `${inches(LABEL_PRINT_GEOMETRY.canvasWidthIn)} ${inches(LABEL_PRINT_GEOMETRY.canvasHeightIn)}`;
