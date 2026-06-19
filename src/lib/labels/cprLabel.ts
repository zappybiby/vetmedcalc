import { CPR_DRUG_DOSES, CPR_MEDICATIONS, SYRINGES } from '@defs';
import type { CPRDrugDose, MedicationDef, Species, SyringeDef } from '@defs';
import { estimateEtForPatient } from '../helpers/etTube';
import type { EtTubeEstimate } from '../helpers/etTube';
import { LABEL_PAGE_SIZE, LABEL_PRINT_GEOMETRY_STYLES } from './geometry';

export type CPRLabelPatient = {
  name: string;
  species: Species | '';
  weightKg: number | null;
};

export type VolumeInfo = {
  ml: number;
  syringe: SyringeDef;
  decimals: number;
};

export type EtLabelDisplaySegment = {
  role: 'low' | 'mid' | 'high';
  className: 'et-small' | 'et-big';
  display: string;
};

export type CPRLabelComputed = {
  patient: CPRLabelPatient;
  epiMed: MedicationDef | null;
  atropineMed: MedicationDef | null;
  epiDose: CPRDrugDose | undefined;
  atropineDose: CPRDrugDose | undefined;
  epiVolume: VolumeInfo | null;
  atropineVolume: VolumeInfo | null;
  etEstimate: EtTubeEstimate | null;
  etLabelSegments: EtLabelDisplaySegment[] | null;
};

const epiMed = CPR_MEDICATIONS.find(m => m.name.toLowerCase() === 'epinephrine') ?? null;
const atropineMed = CPR_MEDICATIONS.find(m => m.name.toLowerCase() === 'atropine') ?? null;
const epiDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'epinephrine');
const atropineDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'atropine');

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function decimalsForIncrement(increment: number): number {
  const str = increment.toString();
  const decimalPart = str.split('.')[1];
  return decimalPart ? decimalPart.length : 0;
}

function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
  const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
  const oneFill = sorted.filter(s => s.sizeCc >= volMl);
  if (oneFill.length) {
    return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
  }
  return sorted[sorted.length - 1];
}

function computeRoundedVolume(mgPerKg: number, weightKg: number, concentrationMgPerMl: number): VolumeInfo {
  const rawMl = (mgPerKg * weightKg) / concentrationMgPerMl;
  const syringe = chooseSyringeForVolume(rawMl, SYRINGES);
  const decimals = decimalsForIncrement(syringe.incrementMl);
  const rounded = roundToIncrement(rawMl, syringe.incrementMl);
  const ml = Number(rounded.toFixed(decimals));
  return { ml, syringe, decimals };
}

const r0 = (x: number) => Math.round(x);

export const fmtVolume = (info: VolumeInfo | null) => (info == null ? '—' : info.ml.toFixed(info.decimals));
export const fmt0 = (x: number | null) => (x == null ? '—' : String(r0(x)));

function buildEtSegments(et: EtTubeEstimate | null): EtLabelDisplaySegment[] | null {
  if (!et) return null;

  type Candidate = EtLabelDisplaySegment & { priority: number; index: number };

  const candidates: Candidate[] = [
    { role: 'low', className: 'et-small', display: et.lowMm.toFixed(1), priority: 1, index: 0 },
    { role: 'mid', className: 'et-big', display: et.estimateMm.toFixed(1), priority: 0, index: 1 },
    { role: 'high', className: 'et-small', display: et.highMm.toFixed(1), priority: 1, index: 2 },
  ];

  const deduped: Candidate[] = [];
  for (const entry of candidates) {
    const existingIdx = deduped.findIndex(item => item.display === entry.display);
    if (existingIdx === -1) {
      deduped.push(entry);
    } else if (entry.priority < deduped[existingIdx].priority) {
      deduped[existingIdx] = entry;
    }
  }

  return deduped
    .sort((a, b) => a.index - b.index)
    .map<EtLabelDisplaySegment>(({ role, className, display }) => ({ role, className, display }));
}

export function computeCprLabel(patient: CPRLabelPatient): CPRLabelComputed {
  const etEstimate = estimateEtForPatient({
    species: patient.species,
    weightKg: patient.weightKg,
  });

  const etLabelSegments = buildEtSegments(etEstimate);

  const epiVolume =
    patient.weightKg && epiDose && epiMed
      ? computeRoundedVolume(epiDose.mgPerKg, patient.weightKg, epiMed.concentration.value)
      : null;

  const atropineVolume =
    patient.weightKg && atropineDose && atropineMed
      ? computeRoundedVolume(atropineDose.mgPerKg, patient.weightKg, atropineMed.concentration.value)
      : null;

  return {
    patient,
    epiMed,
    atropineMed,
    epiDose,
    atropineDose,
    epiVolume,
    atropineVolume,
    etEstimate,
    etLabelSegments,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderEtRow(segments: EtLabelDisplaySegment[] | null): string {
  if (!segments || !segments.length) {
    return `
      <div class="et-row" aria-label="ET tube size unavailable">
        <span class="et-small">—</span>
        <span class="dash">-</span>
        <span class="et-big">—</span>
        <span class="dash">-</span>
        <span class="et-small">—</span>
      </div>
    `;
  }

  const pieces = segments
    .map((segment, index) => {
      const dash = index < segments.length - 1 ? '<span class="dash">-</span>' : '';
      return `<span class="${segment.className}">${segment.display}</span>${dash}`;
    })
    .join('');

  return `<div class="et-row" aria-label="ET tube size range">${pieces}</div>`;
}

export function renderCprLabelMarkup(ctx: CPRLabelComputed): string {
  const name = ctx.patient.name.trim() ? escapeHtml(ctx.patient.name.trim()) : 'NAME';
  const weightDisplay = ctx.patient.weightKg != null
    ? `${ctx.patient.weightKg.toFixed(1)} kg`
    : 'WEIGHT';

  const epiVolumeDisplay = fmtVolume(ctx.epiVolume);
  const atropineVolumeDisplay = fmtVolume(ctx.atropineVolume);

  const epiDrug = ctx.epiMed
    ? `EPINEPHRINE ${ctx.epiMed.concentration.value} ${ctx.epiMed.concentration.units}`
    : 'EPINEPHRINE';

  const atropineDrug = ctx.atropineMed
    ? `ATROPINE ${ctx.atropineMed.concentration.value} ${ctx.atropineMed.concentration.units}`
    : 'ATROPINE';

  const epiDoseDisplay = ctx.epiDose ? `${ctx.epiDose.mgPerKg} mg/kg` : '';
  const atropineDoseDisplay = ctx.atropineDose ? `${ctx.atropineDose.mgPerKg} mg/kg` : '';

  return `
    <div class="label-outer">
      <div class="label-hdr">
        <div class="label-name">${name}</div>
        <div class="label-weight">${weightDisplay}</div>
      </div>

      <div class="label-table">
        <div class="label-row">
          <div class="med">
            <div class="drug">${epiDrug}</div>
            <div class="perkg">${epiDoseDisplay}</div>
          </div>
          <div class="dose">
            <span class="dose-value">${epiVolumeDisplay}</span>
            <span class="dose-unit">mL</span>
          </div>
        </div>
        <div class="label-row">
          <div class="med">
            <div class="drug">${atropineDrug}</div>
            <div class="perkg">${atropineDoseDisplay}</div>
          </div>
          <div class="dose">
            <span class="dose-value">${atropineVolumeDisplay}</span>
            <span class="dose-unit">mL</span>
          </div>
        </div>
      </div>

      <div class="label-bolus">
        <div class="bolus-box et-box">
          <div class="et-label">Estimated ET Tube Size</div>
          ${renderEtRow(ctx.etLabelSegments)}
        </div>
      </div>
    </div>
  `;
}

export const CPR_LABEL_PRINT_STYLES = `
  @page { size: ${LABEL_PAGE_SIZE}; margin: 0; }
  ${LABEL_PRINT_GEOMETRY_STYLES}
  :root {
    color-scheme: light;
    --cpr-label-scale: 1.123;
    --cpr-space-scale: 0.84;
    --cpr-dose-scale: 1;
  }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: system-ui, Arial, Helvetica, sans-serif; }

  body.print-mode-single {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  body.print-mode-batch {
    margin: 0;
    padding: 0;
  }

  .label-page {
    width: var(--label-page-width);
    height: var(--label-page-height);
    min-height: var(--label-page-height);
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    margin: 0 auto;
    break-after: page;
    page-break-after: always;
  }

  .label-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .label-sheet {
    width: var(--label-safe-width);
    height: var(--label-safe-height);
    box-sizing: border-box;
    display: flex;
    overflow: hidden;
  }

  .label-page > .label-sheet {
    position: absolute;
    top: var(--label-safe-inset-left);
    left: calc(var(--label-stock-height) - var(--label-safe-inset-top));
    transform: rotate(90deg);
    transform-origin: top left;
  }
  .label-outer {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 2px solid #000;
    padding: calc(0.045in * var(--cpr-space-scale)) calc(0.058in * var(--cpr-space-scale));
    display: grid;
    grid-template-rows: auto minmax(0, 1.45fr) minmax(0, 0.48fr);
    gap: calc(0.036in * var(--cpr-space-scale));
    align-content: stretch;
    color: #000;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }
  .label-hdr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(0.045in * var(--cpr-space-scale));
    border: 2px solid #000;
    border-radius: .06in;
    padding: calc(0.028in * var(--cpr-space-scale)) calc(0.05in * var(--cpr-space-scale));
    font-weight: 800;
    font-size: calc(8.9pt * var(--cpr-label-scale));
    line-height: 1.08;
  }
  .label-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: calc(12.7pt * var(--cpr-label-scale));
    line-height: 1.1;
  }
  .label-weight {
    text-align: right;
    font-size: calc(12.7pt * var(--cpr-label-scale));
    line-height: 1.1;
  }
  .label-table {
    display: grid;
    border: 2px solid #000;
    border-radius: .06in;
    overflow: hidden;
    height: 100%;
    grid-template-rows: repeat(2, 1fr);
  }
  .label-row {
    display: grid;
    grid-template-columns: 1.66fr 0.74fr;
    align-items: stretch;
    border-bottom: 2px solid #000;
  }
  .label-row:last-child { border-bottom: none; }
  .med {
    padding: calc(0.034in * var(--cpr-space-scale)) calc(0.056in * var(--cpr-space-scale));
    display: grid;
    grid-template-rows: auto auto;
    row-gap: calc(0.012in * var(--cpr-space-scale));
    align-content: center;
  }
  .drug {
    font-weight: 800;
    font-size: calc(8.55pt * var(--cpr-label-scale));
    line-height: 1.05;
    white-space: nowrap;
  }
  .perkg { font-size: calc(7.55pt * var(--cpr-label-scale)); line-height: 1; opacity: .9; }
  .dose {
    border-left: 2px solid #000;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: calc(0.034in * var(--cpr-space-scale));
    padding: calc(0.018in * var(--cpr-space-scale)) calc(0.04in * var(--cpr-space-scale));
    font-weight: 900;
    text-align: center;
  }
  .dose-value { font-size: calc(13.1pt * var(--cpr-label-scale) * var(--cpr-dose-scale)); line-height: 1; white-space: nowrap; }
  .dose-unit { font-size: calc(9.45pt * var(--cpr-label-scale)); font-weight: 800; line-height: 1; }
  .label-bolus {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-height: 0;
    flex: 1 1 auto;
  }
  .bolus-box {
    border: 2px solid #000;
    border-radius: .06in;
    padding: calc(0.026in * var(--cpr-space-scale));
    font-weight: 900;
    font-size: calc(8.8pt * var(--cpr-label-scale));
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    max-width: 100%;
    flex: 1 1 auto;
    width: 100%;
  }
  .et-box {
    text-align: center;
    justify-self: stretch;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 1 1 auto;
    width: 100%;
  }
  .et-label { font-weight: 800; font-size: calc(8.8pt * var(--cpr-label-scale)); text-align: center; }
  .et-row { display: flex; justify-content: center; align-items: baseline; gap: calc(0.045in * var(--cpr-space-scale)); }
  .et-small { font-weight: 700; font-size: calc(8.8pt * var(--cpr-label-scale)); opacity: .9; }
  .et-big { font-weight: 900; font-size: calc(12.9pt * var(--cpr-label-scale) * var(--cpr-dose-scale)); }
  .dash { font-weight: 800; font-size: calc(10.6pt * var(--cpr-label-scale)); line-height: 1; }
`;
