import type { MedicationDef } from '@defs';
import type { CRIViewModel, DrawCard } from '../viewmodels/criViewModel';

export type CRILabelComputed = {
  dateTimeText: string;
  weightText: string;
  drugText: string;
  sourceConcentrationText: string;
  stockVolumeText: string;
  stockMassText: string;
  diluentVolumeText: string | null;
  finalConcentrationText: string;
  deliveryDoseText: string;
  deliveryRateText: string;
};

export type CRILabelParams = {
  medication: MedicationDef;
  viewModel: CRIViewModel;
  patientWeightKg?: number | null;
  generatedAt?: Date;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderFormattedText(value: string): string {
  const numberPattern = /-?\d+(?:\.\d+)?/g;
  let output = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = numberPattern.exec(value)) !== null) {
    output += escapeHtml(value.slice(lastIndex, match.index));

    const token = match[0];
    const decimalIndex = token.indexOf('.');
    if (decimalIndex === -1) {
      output += `<span class="cri-num">${escapeHtml(token)}</span>`;
    } else {
      output += `<span class="cri-num"><span class="cri-num-whole">${escapeHtml(token.slice(0, decimalIndex))}</span><span class="cri-num-decimal">${escapeHtml(token.slice(decimalIndex))}</span></span>`;
    }

    lastIndex = match.index + token.length;
  }

  output += escapeHtml(value.slice(lastIndex));
  return output;
}

function concentrationMgPerMl(medication: MedicationDef): number {
  return medication.concentration.units === 'mg/mL'
    ? medication.concentration.value
    : medication.concentration.value / 1000;
}

function trimFixed(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

function decimalsForCompactValue(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 100) return 0;
  if (abs >= 10) return 1;
  if (abs >= 1) return 2;
  if (abs >= 0.1) return 3;
  return 4;
}

function formatMassMg(valueMg: number): string {
  const absMg = Math.abs(valueMg);

  if (absMg > 0 && absMg < 1) {
    const valueMcg = valueMg * 1000;
    return `${trimFixed(valueMcg, decimalsForCompactValue(valueMcg))} mcg`;
  }

  return `${trimFixed(valueMg, decimalsForCompactValue(valueMg))} mg`;
}

function formatConcentrationMgPerMl(valueMgPerMl: number): string {
  return `${trimFixed(valueMgPerMl, 4)} mg/mL`;
}

function formatStockConcentration(medication: MedicationDef): string {
  const mgPerMl = concentrationMgPerMl(medication);

  if (mgPerMl > 0 && mgPerMl < 1) {
    return `${trimFixed(mgPerMl * 1000, decimalsForCompactValue(mgPerMl * 1000))} mcg/mL`;
  }

  return `${trimFixed(mgPerMl, 4)} mg/mL`;
}

function formatWeightKg(weightKg: number | null | undefined): string {
  if (weightKg == null || Number.isNaN(weightKg)) return '-- kg';
  return `${trimFixed(weightKg, 2)} kg`;
}

function formatDeliveredDoseForLabel(doseText: string): string {
  const match = doseText.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return doseText;

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || !unit) return doseText;

  return `${value.toFixed(2)} ${unit}`;
}

function formatPumpRateForLabel(valueMlPerHr: number): string {
  return `${trimFixed(valueMlPerHr, 2)} mL/hr`;
}

function findDrawCard(viewModel: CRIViewModel, kind: DrawCard['kind']): DrawCard | null {
  return viewModel.drawCards.find((card) => card.kind === kind) ?? null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCriLabelDateTime(date: Date): string {
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const year = date.getFullYear();
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const minutes = pad2(date.getMinutes());
  const suffix = hour24 >= 12 ? 'PM' : 'AM';

  return `${month}/${day}/${year} ${hour12}:${minutes}${suffix}`;
}

export function buildCriLabel(params: CRILabelParams): CRILabelComputed {
  const { medication, viewModel, patientWeightKg, generatedAt = new Date() } = params;
  const stockDraw = findDrawCard(viewModel, 'stock');
  const diluentDraw = findDrawCard(viewModel, 'diluent');
  const stockMassMg = stockDraw ? stockDraw.volumeMl * concentrationMgPerMl(medication) : null;

  return {
    dateTimeText: formatCriLabelDateTime(generatedAt),
    weightText: formatWeightKg(patientWeightKg),
    drugText: medication.name,
    sourceConcentrationText: formatStockConcentration(medication),
    stockVolumeText: stockDraw?.volumeText ?? '--',
    stockMassText: stockMassMg == null ? '--' : formatMassMg(stockMassMg),
    diluentVolumeText: diluentDraw?.volumeText ?? null,
    finalConcentrationText: formatConcentrationMgPerMl(viewModel.resultCard.finalConcentrationMgPerMl),
    deliveryDoseText: formatDeliveredDoseForLabel(viewModel.resultCard.deliveredDoseText),
    deliveryRateText: formatPumpRateForLabel(viewModel.resultCard.pumpRateMlPerHr),
  };
}

export function renderCriLabelMarkup(ctx: CRILabelComputed): string {
  const diluentMarkup = ctx.diluentVolumeText
    ? `
        <div class="cri-prep-row cri-diluent-row">
          <div class="cri-row-label">Diluent</div>
          <div class="cri-row-value">
            <span class="cri-prep-volume">${renderFormattedText(ctx.diluentVolumeText)}</span>
            <span class="cri-diluent-options">(NaCl)&nbsp;&nbsp;(D5W)&nbsp;&nbsp;(Water)</span>
          </div>
        </div>
      `
    : '';

  return `
    <div class="cri-label-outer">
      <header class="cri-patient-block">
        <div class="cri-handwritten-row">
          <span class="cri-handwritten-label">Patient name:</span>
          <span class="cri-name-space" aria-hidden="true"></span>
        </div>

        <div class="cri-meta-row">
          <span class="cri-weight-row">
            <span class="cri-weight-label">Wt</span>
            <span class="cri-weight-value">${renderFormattedText(ctx.weightText)}</span>
          </span>
          <span class="cri-date">${renderFormattedText(ctx.dateTimeText)}</span>
        </div>

        <div class="cri-initials-row">
          <span class="cri-initials">
            <span>Initials:</span>
            <span class="cri-initials-space" aria-hidden="true"></span>
          </span>
        </div>
      </header>

      <section class="cri-drug-heading">
        <span class="cri-heading-label">CRI</span>
        <strong class="cri-drug-name">${renderFormattedText(ctx.drugText)}</strong>
      </section>

      <section class="cri-clinical-boxes">
        <div class="cri-final-box">
          <span class="cri-box-label">Final conc.</span>
          <strong class="cri-final-value">${renderFormattedText(ctx.finalConcentrationText)}</strong>
        </div>

        <div class="cri-delivers-box">
          <span class="cri-box-label">Delivers</span>
          <strong>${renderFormattedText(ctx.deliveryDoseText)}</strong>
          <strong>at ${renderFormattedText(ctx.deliveryRateText)}</strong>
        </div>
      </section>

      <section class="cri-prep-section">
        <div class="cri-prep-row">
          <div class="cri-row-label">Drug</div>
          <div class="cri-row-value">
            <span class="cri-prep-volume">${renderFormattedText(ctx.stockVolumeText)}</span>
            ${renderFormattedText(ctx.drugText)}
            <span class="cri-prep-concentration">(${renderFormattedText(ctx.sourceConcentrationText)})</span>
          </div>
        </div>
        <div class="cri-prep-row cri-total-row">
          <div class="cri-row-label" aria-hidden="true"></div>
          <div class="cri-row-value">${renderFormattedText(`${ctx.stockMassText} total`)}</div>
        </div>
        ${diluentMarkup}
      </section>
    </div>
  `;
}

export const CRI_LABEL_PRINT_STYLES = `
  @page { size: 2.13in 2in; margin: 0; }
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: system-ui, Arial, Helvetica, sans-serif; }

  body.print-mode-single {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cri-label-page {
    width: 100%;
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    padding: 0;
  }

  .cri-label-sheet {
    width: 2.13in;
    height: 2in;
    box-sizing: border-box;
    display: flex;
    overflow: hidden;
  }

  .cri-label-outer {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 1.5px solid #000;
    padding: 0.132in 0.07in 0.03in;
    display: grid;
    grid-template-rows: auto auto auto auto;
    align-content: start;
    gap: 0;
    color: #000;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }

  .cri-patient-block {
    display: grid;
    gap: 0.113in;
    min-width: 0;
  }

  .cri-handwritten-row,
  .cri-initials,
  .cri-weight-row {
    display: flex;
    align-items: baseline;
    min-width: 0;
  }

  .cri-handwritten-row {
    gap: 0.058in;
    font-size: 8.45pt;
    font-weight: 900;
    line-height: 1.05;
  }

  .cri-handwritten-label {
    white-space: nowrap;
  }

  .cri-name-space {
    display: block;
    min-width: 0;
  }

  .cri-name-space {
    flex: 1 1 auto;
  }

  .cri-weight-label,
  .cri-weight-value {
    white-space: nowrap;
  }

  .cri-meta-row {
    display: grid;
    grid-template-columns: max-content max-content;
    justify-content: space-between;
    align-items: baseline;
    column-gap: 0.04in;
    min-width: 0;
    font-size: 6.05pt;
    font-weight: 850;
    line-height: 1.05;
  }

  .cri-date {
    white-space: nowrap;
  }

  .cri-initials-row {
    display: flex;
    justify-content: flex-start;
    min-width: 0;
    font-size: 6.05pt;
    font-weight: 850;
    line-height: 1.05;
  }

  .cri-initials {
    width: 1in;
    gap: 0.024in;
    justify-content: flex-start;
    white-space: nowrap;
  }

  .cri-initials-space {
    display: block;
    flex: 1 1 auto;
    min-width: 0.4in;
  }

  .cri-weight-row {
    gap: 0.022in;
  }

  .cri-drug-heading {
    min-width: 0;
    margin-top: 0.029in;
    border-top: 1.8px solid #000;
    padding-top: 0.021in;
  }

  .cri-heading-label,
  .cri-box-label {
    display: block;
    font-size: 5.05pt;
    font-weight: 900;
    line-height: 1.04;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .cri-row-label {
    display: block;
    font-size: 5.28pt;
    font-weight: 900;
    line-height: 1.04;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .cri-drug-name {
    display: block;
    margin-top: 0.007in;
    font-size: 9.15pt;
    font-weight: 900;
    line-height: 0.98;
    overflow-wrap: anywhere;
  }

  .cri-clinical-boxes {
    min-width: 0;
    margin-top: 0.004in;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.028in;
  }

  .cri-final-box,
  .cri-delivers-box {
    min-width: 0;
    border: 1.45px solid #000;
    padding: 0.034in 0.042in;
    display: grid;
    align-items: baseline;
    align-content: center;
  }

  .cri-final-box {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 0.055in;
  }

  .cri-final-value {
    display: block;
    justify-self: start;
    font-size: 9.05pt;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
  }

  .cri-delivers-box {
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.038in;
    font-weight: 900;
    line-height: 1.05;
  }

  .cri-delivers-box strong {
    display: block;
    font-size: 6.32pt;
    line-height: 1.05;
    white-space: nowrap;
  }

  .cri-delivers-box strong:first-of-type {
    font-size: 6.32pt;
  }

  .cri-delivers-box strong:last-child {
    justify-self: end;
  }

  .cri-prep-section {
    min-width: 0;
    margin-top: 0.046in;
    border-top: 1.8px solid #000;
    padding-top: 0.034in;
    display: grid;
    align-content: start;
    gap: 0.027in;
  }

  .cri-prep-row {
    display: grid;
    grid-template-columns: 0.4in minmax(0, 1fr);
    column-gap: 0.028in;
    align-items: baseline;
    min-width: 0;
  }

  .cri-row-value {
    min-width: 0;
    font-size: 5.52pt;
    font-weight: 900;
    line-height: 1.08;
    white-space: nowrap;
  }

  .cri-prep-volume {
    font-size: 5.95pt;
    line-height: 1;
  }

  .cri-prep-concentration {
    font-size: 4.82pt;
    line-height: 1;
  }

  .cri-total-row {
    margin-top: 0;
  }

  .cri-total-row .cri-row-value {
    font-size: 5.52pt;
  }

  .cri-diluent-row {
    margin-top: 0.054in;
  }

  .cri-diluent-options {
    font-size: inherit;
    font-weight: 900;
    white-space: nowrap;
  }

  .cri-num {
    font-variant-numeric: tabular-nums;
  }

  .cri-num-decimal {
    font-size: calc(1em - 1px);
    vertical-align: baseline;
    letter-spacing: 0;
  }
`;
