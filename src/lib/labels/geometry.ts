export const LABEL_PRINT_GEOMETRY = {
  driverStockWidthIn: 2.36,
  driverStockHeightIn: 3.48,
  canvasWidthIn: 3.48,
  canvasHeightIn: 2.36,
  safeWidthIn: 3.48,
  safeHeightIn: 2.13,
  safeInsetTopIn: 0.12,
  safeInsetBottomIn: 0.11,
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
