import {
  VENOUS_BLOOD_GAS_REFERENCE_RANGES,
  type VenousBloodGasAnalyteId,
  type VenousBloodGasReferenceInterval,
} from '@defs';
import type { Species } from '@defs';

export type VenousBloodGasValues = Partial<Record<VenousBloodGasAnalyteId, number | null>>;
export type ComponentState = 'LOW' | 'NORMAL' | 'HIGH' | 'DISCORDANT' | 'MISSING';
export type AcidBaseStatus = 'ACIDEMIA' | 'ALKALEMIA' | 'WITHIN_RI';
export type PrimaryProcess = 'METABOLIC' | 'RESPIRATORY' | 'MIXED' | 'NO_PRIMARY_PROCESS' | 'INDETERMINATE';
export type Disorder =
  | 'METABOLIC_ACIDOSIS'
  | 'METABOLIC_ALKALOSIS'
  | 'RESPIRATORY_ACIDOSIS'
  | 'RESPIRATORY_ALKALOSIS'
  | 'MIXED_ACIDOSIS_PATTERN'
  | 'MIXED_ALKALOSIS_PATTERN'
  | 'NO_ACID_BASE_DISORDER'
  | 'INDETERMINATE';
export type CompensationStatus =
  | 'NO_COMPENSATION'
  | 'PARTIAL_COMPENSATION'
  | 'COMPLETE_COMPENSATION'
  | 'NOT_APPLICABLE'
  | 'INDETERMINATE';
export type VenousBloodGasNote =
  | 'METABOLIC_COMPONENT_DISCORDANT'
  | 'PRIMARY_PROCESS_UNCERTAIN'
  | 'PH_DRIVEN_METABOLIC_PATTERN'
  | 'PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY'
  | 'QUALITATIVE_COMPENSATION_ASSESSMENT'
  | 'RESPIRATORY_RESPONSE_APPROPRIATE'
  | 'RESPIRATORY_RESPONSE_ABOVE_EXPECTED'
  | 'RESPIRATORY_RESPONSE_BELOW_EXPECTED'
  | 'METABOLIC_RESPONSE_APPROPRIATE'
  | 'METABOLIC_RESPONSE_ABOVE_EXPECTED'
  | 'METABOLIC_RESPONSE_BELOW_EXPECTED'
  | 'VENOUS_OXYGEN_NOT_INTERPRETED'
  | 'POSSIBLE_AIR_CONTAMINATION';

export type VenousBloodGasInterpretationDetail = {
  label: string;
  value: string;
  detail: string;
};

export type VenousBloodGasInterpretation = {
  acidBaseStatus: AcidBaseStatus;
  respiratoryComponent: ComponentState;
  metabolicComponent: ComponentState;
  primaryProcess: PrimaryProcess;
  disorder: Disorder;
  compensationStatus: CompensationStatus;
  notes: VenousBloodGasNote[];
  details: VenousBloodGasInterpretationDetail[];
};

type DirectionState = 'LOW' | 'NORMAL' | 'HIGH' | 'MISSING';
type PHNormalPosition = 'LOW_NORMAL' | 'MID_NORMAL' | 'HIGH_NORMAL' | 'OUTSIDE_RI';
type PrimaryMetabolicAnalyteId = 'HCO3' | 'BEecf';
type MetabolicSummary = {
  component: ComponentState;
  primaryComponent: ComponentState;
  primaryStates: Record<PrimaryMetabolicAnalyteId, DirectionState>;
  tco2State: DirectionState;
  includesTCO2: boolean;
  tco2Discordant: boolean;
};

const directionLabels: Record<DirectionState, string> = {
  LOW: 'below RI',
  NORMAL: 'within RI',
  HIGH: 'above RI',
  MISSING: 'missing',
};

const componentLabels: Record<ComponentState, string> = {
  LOW: 'Low',
  NORMAL: 'Within RI',
  HIGH: 'High',
  DISCORDANT: 'Discordant',
  MISSING: 'Missing',
};

const acidBaseLabels: Record<AcidBaseStatus, string> = {
  ACIDEMIA: 'Acidemia',
  ALKALEMIA: 'Alkalemia',
  WITHIN_RI: 'Within RI',
};

const disorderLabels: Record<Disorder, string> = {
  METABOLIC_ACIDOSIS: 'Metabolic acidosis',
  METABOLIC_ALKALOSIS: 'Metabolic alkalosis',
  RESPIRATORY_ACIDOSIS: 'Respiratory acidosis',
  RESPIRATORY_ALKALOSIS: 'Respiratory alkalosis',
  MIXED_ACIDOSIS_PATTERN: 'Mixed acidosis pattern',
  MIXED_ALKALOSIS_PATTERN: 'Mixed alkalosis pattern',
  NO_ACID_BASE_DISORDER: 'No acid-base disorder',
  INDETERMINATE: 'Indeterminate',
};

const compensationLabels: Record<CompensationStatus, string> = {
  NO_COMPENSATION: 'No compensation',
  PARTIAL_COMPENSATION: 'Partial compensation',
  COMPLETE_COMPENSATION: 'Complete compensation',
  NOT_APPLICABLE: 'Not applicable',
  INDETERMINATE: 'Indeterminate',
};

function compareToRi(value: number | null | undefined, ri: VenousBloodGasReferenceInterval | null | undefined): DirectionState {
  if (value == null || ri == null || !Number.isFinite(value)) return 'MISSING';
  if (value < ri.low) return 'LOW';
  if (value > ri.high) return 'HIGH';
  return 'NORMAL';
}

function midpoint(ri: VenousBloodGasReferenceInterval): number {
  return (ri.low + ri.high) / 2;
}

function getPHNormalPosition(pH: number | null | undefined, riPH: VenousBloodGasReferenceInterval): PHNormalPosition {
  const state = compareToRi(pH, riPH);
  if (state !== 'NORMAL') return 'OUTSIDE_RI';
  if (pH == null) return 'OUTSIDE_RI';
  if (pH < midpoint(riPH)) return 'LOW_NORMAL';
  if (pH > midpoint(riPH)) return 'HIGH_NORMAL';
  return 'MID_NORMAL';
}

function summarizePrimaryMetabolicComponent(states: DirectionState[]): ComponentState {
  const filtered = states.filter((state) => state !== 'MISSING');
  if (filtered.length === 0) return 'MISSING';

  const hasLow = filtered.includes('LOW');
  const hasHigh = filtered.includes('HIGH');

  if (hasLow && hasHigh) return 'DISCORDANT';
  if (hasLow) return 'LOW';
  if (hasHigh) return 'HIGH';
  return 'NORMAL';
}

function summarizeMetabolicComponent(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): MetabolicSummary {
  const primaryStates: Record<PrimaryMetabolicAnalyteId, DirectionState> = {
    HCO3: compareToRi(values.HCO3, ri.HCO3),
    BEecf: compareToRi(values.BEecf, ri.BEecf),
  };
  const tco2State = compareToRi(values.TCO2, ri.TCO2);
  const primaryComponent = summarizePrimaryMetabolicComponent(Object.values(primaryStates));
  const includesTCO2 = values.TCO2 != null;
  let component = primaryComponent;
  let tco2Discordant = false;

  if (primaryComponent === 'MISSING' && includesTCO2) {
    component = tco2State === 'MISSING' ? 'MISSING' : tco2State;
  }

  if (includesTCO2 && primaryComponent !== 'MISSING') {
    if (
      (primaryComponent === 'LOW' && tco2State === 'HIGH') ||
      (primaryComponent === 'HIGH' && tco2State === 'LOW')
    ) {
      component = 'DISCORDANT';
      tco2Discordant = true;
    } else if (primaryComponent === 'NORMAL' && (tco2State === 'LOW' || tco2State === 'HIGH')) {
      tco2Discordant = true;
    }
  }

  return { component, primaryComponent, primaryStates, tco2State, includesTCO2, tco2Discordant };
}

function trimFixed(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

function formatValue(value: number, id: VenousBloodGasAnalyteId): string {
  if (id === 'pH') return trimFixed(value, 3);
  return trimFixed(value, 1);
}

function formatMeasurement(
  id: VenousBloodGasAnalyteId,
  value: number,
  ri: VenousBloodGasReferenceInterval,
): string {
  const unit = ri.unit ? ` ${ri.unit}` : '';
  return `${formatValue(value, id)}${unit}`;
}

function formatRange(id: VenousBloodGasAnalyteId, ri: VenousBloodGasReferenceInterval): string {
  const unit = ri.unit ? ` ${ri.unit}` : '';
  return `${formatValue(ri.low, id)} to ${formatValue(ri.high, id)}${unit}`;
}

function describeAnalyte(
  id: VenousBloodGasAnalyteId,
  value: number | null | undefined,
  state: DirectionState,
  ri: VenousBloodGasReferenceInterval,
): string {
  if (value == null || !Number.isFinite(value)) return `${ri.label} is missing.`;
  return `${ri.label} ${formatMeasurement(id, value, ri)} is ${directionLabels[state]} (${formatRange(id, ri)}).`;
}

function describeRespiratoryContext(acidBaseStatus: AcidBaseStatus, respiratoryComponent: ComponentState): string {
  if (acidBaseStatus === 'ACIDEMIA') {
    if (respiratoryComponent === 'HIGH') return 'High pCO2 can explain acidemia as respiratory acidosis.';
    if (respiratoryComponent === 'LOW') return 'Low pCO2 moves opposite the acidemia and fits respiratory compensation.';
    if (respiratoryComponent === 'NORMAL') return 'pCO2 does not explain the acidemia as primary respiratory acidosis.';
  }

  if (acidBaseStatus === 'ALKALEMIA') {
    if (respiratoryComponent === 'LOW') return 'Low pCO2 can explain alkalemia as respiratory alkalosis.';
    if (respiratoryComponent === 'HIGH') return 'High pCO2 moves opposite the alkalemia and fits respiratory compensation.';
    if (respiratoryComponent === 'NORMAL') return 'pCO2 does not explain the alkalemia as primary respiratory alkalosis.';
  }

  if (acidBaseStatus === 'WITHIN_RI') {
    return 'pCO2 is interpreted with pH position and the metabolic markers.';
  }

  return 'pCO2 could not be assigned to a clear respiratory role.';
}

function describeMetabolicContext(metabolicSummary: MetabolicSummary): string {
  if (metabolicSummary.component === 'DISCORDANT') return 'Metabolic markers conflict, so the metabolic direction is not assigned.';
  if (metabolicSummary.component === 'HIGH') return 'The metabolic markers move in an alkalinizing direction.';
  if (metabolicSummary.component === 'LOW') return 'The metabolic markers move in an acidifying direction.';
  if (metabolicSummary.component === 'NORMAL') return 'HCO3 and base excess do not identify a primary metabolic shift.';
  return 'Metabolic markers are missing.';
}

function buildMetabolicDetail(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
  metabolicSummary: MetabolicSummary,
): string {
  const primaryText = [
    describeAnalyte('HCO3', values.HCO3, metabolicSummary.primaryStates.HCO3, ri.HCO3),
    describeAnalyte('BEecf', values.BEecf, metabolicSummary.primaryStates.BEecf, ri.BEecf),
  ].join(' ');

  const tco2Text = metabolicSummary.includesTCO2
    ? ` ${describeAnalyte('TCO2', values.TCO2, metabolicSummary.tco2State, ri.TCO2)} TCO2 is optional context and does not outvote HCO3/base excess.`
    : '';

  return `${primaryText}${tco2Text} ${describeMetabolicContext(metabolicSummary)}`;
}

function describePrimaryProcess(
  result: VenousBloodGasInterpretation,
  usedPHPositionTiebreaker: boolean,
): string {
  if (result.primaryProcess === 'INDETERMINATE') {
    return 'pH direction and component changes do not point to one process.';
  }

  if (result.primaryProcess === 'NO_PRIMARY_PROCESS') {
    return 'pH, pCO2, and metabolic markers are within their reference intervals.';
  }

  if (result.primaryProcess === 'MIXED') {
    return 'Respiratory and metabolic components both move pH in the same abnormal direction.';
  }

  if (usedPHPositionTiebreaker) {
    return 'pH is within RI, so the side of the RI was used to choose the most likely primary process.';
  }

  if (result.notes.includes('PH_DRIVEN_METABOLIC_PATTERN')) {
    return 'Abnormal pH with pCO2 not driving that pH points most strongly to a metabolic process, even when metabolic markers are borderline or within RI.';
  }

  return 'pH direction matches the assigned primary process.';
}

function describeCompensationStatus(result: VenousBloodGasInterpretation): string {
  if (result.compensationStatus === 'NO_COMPENSATION') {
    return 'The expected compensating component is still within RI.';
  }

  if (result.compensationStatus === 'PARTIAL_COMPENSATION') {
    return 'The opposing component is shifted in the expected compensatory direction.';
  }

  if (result.compensationStatus === 'COMPLETE_COMPENSATION') {
    return 'pH is within RI while both components are shifted in a compatible compensated pattern.';
  }

  if (result.compensationStatus === 'NOT_APPLICABLE') {
    return 'Compensation is not assigned for mixed patterns.';
  }

  return 'Compensation cannot be assigned from this pattern.';
}

function buildInterpretationDetails(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
  result: VenousBloodGasInterpretation,
  pHState: DirectionState,
  metabolicSummary: MetabolicSummary,
  usedPHPositionTiebreaker: boolean,
): VenousBloodGasInterpretationDetail[] {
  return [
    {
      label: 'pH',
      value: acidBaseLabels[result.acidBaseStatus],
      detail: describeAnalyte('pH', values.pH, pHState, ri.pH),
    },
    {
      label: 'Respiratory',
      value: componentLabels[result.respiratoryComponent],
      detail: `${describeAnalyte('PvCO2', values.PvCO2, compareToRi(values.PvCO2, ri.PvCO2), ri.PvCO2)} ${describeRespiratoryContext(result.acidBaseStatus, result.respiratoryComponent)}`,
    },
    {
      label: 'Metabolic',
      value: componentLabels[result.metabolicComponent],
      detail: buildMetabolicDetail(values, ri, metabolicSummary),
    },
    {
      label: 'Primary',
      value: disorderLabels[result.disorder],
      detail: describePrimaryProcess(result, usedPHPositionTiebreaker),
    },
    {
      label: 'Compensation',
      value: compensationLabels[result.compensationStatus],
      detail: describeCompensationStatus(result),
    },
  ];
}

function expectedDogPvCO2ForPrimaryMetabolic(
  HCO3: number,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): number {
  const deltaHCO3 = HCO3 - midpoint(ri.HCO3);
  return midpoint(ri.PvCO2) + 0.7 * deltaHCO3;
}

function assessDogRespiratoryResponseToMetabolic(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): VenousBloodGasNote | 'INDETERMINATE' {
  if (values.PvCO2 == null || values.HCO3 == null) return 'INDETERMINATE';

  const expected = expectedDogPvCO2ForPrimaryMetabolic(values.HCO3, ri);
  const delta = values.PvCO2 - expected;

  if (Math.abs(delta) <= 3) return 'RESPIRATORY_RESPONSE_APPROPRIATE';
  if (delta > 3) return 'RESPIRATORY_RESPONSE_ABOVE_EXPECTED';
  return 'RESPIRATORY_RESPONSE_BELOW_EXPECTED';
}

function expectedDogHCO3ForPrimaryRespiratory(
  PvCO2: number,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): { acute: number; chronic: number } {
  const deltaPvCO2 = PvCO2 - midpoint(ri.PvCO2);

  if (deltaPvCO2 >= 0) {
    return {
      acute: midpoint(ri.HCO3) + 0.15 * deltaPvCO2,
      chronic: midpoint(ri.HCO3) + 0.35 * deltaPvCO2,
    };
  }

  return {
    acute: midpoint(ri.HCO3) + 0.25 * deltaPvCO2,
    chronic: midpoint(ri.HCO3) + 0.55 * deltaPvCO2,
  };
}

function assessDogMetabolicResponseToRespiratory(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): VenousBloodGasNote | 'INDETERMINATE' {
  if (values.PvCO2 == null || values.HCO3 == null) return 'INDETERMINATE';

  const { acute, chronic } = expectedDogHCO3ForPrimaryRespiratory(values.PvCO2, ri);

  if (Math.abs(values.HCO3 - acute) <= 2 || Math.abs(values.HCO3 - chronic) <= 2) {
    return 'METABOLIC_RESPONSE_APPROPRIATE';
  }
  if (values.HCO3 > Math.max(acute, chronic) + 2) return 'METABOLIC_RESPONSE_ABOVE_EXPECTED';
  if (values.HCO3 < Math.min(acute, chronic) - 2) return 'METABOLIC_RESPONSE_BELOW_EXPECTED';
  return 'INDETERMINATE';
}

function addOptionalVenousNotes(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
  acidBaseStatus: AcidBaseStatus,
  respiratoryComponent: ComponentState,
  metabolicComponent: ComponentState,
  notes: VenousBloodGasNote[],
): void {
  if (values.PvO2 == null) return;

  notes.push('VENOUS_OXYGEN_NOT_INTERPRETED');

  const PvO2State = compareToRi(values.PvO2, ri.PvO2);
  if (
    PvO2State === 'HIGH' &&
    respiratoryComponent === 'LOW' &&
    acidBaseStatus !== 'ACIDEMIA' &&
    metabolicComponent === 'LOW'
  ) {
    notes.push('POSSIBLE_AIR_CONTAMINATION');
  }
}

function addDogOrCatCompensationNote(
  species: Species,
  notes: VenousBloodGasNote[],
  dogNote: VenousBloodGasNote | 'INDETERMINATE',
): void {
  if (species === 'dog') {
    if (dogNote !== 'INDETERMINATE') notes.push(dogNote);
  } else {
    notes.push('QUALITATIVE_COMPENSATION_ASSESSMENT');
  }
}

export function interpretVenousBloodGas(
  species: Species,
  values: VenousBloodGasValues,
): VenousBloodGasInterpretation {
  const ri = VENOUS_BLOOD_GAS_REFERENCE_RANGES[species];
  const notes: VenousBloodGasNote[] = [];
  let usedPHPositionTiebreaker = false;

  const pHState = compareToRi(values.pH, ri.pH);
  const respiratoryComponent = compareToRi(values.PvCO2, ri.PvCO2);
  const metabolicSummary = summarizeMetabolicComponent(values, ri);
  const metabolicComponent = metabolicSummary.component;
  const pHNormalPosition = getPHNormalPosition(values.pH, ri.pH);

  const result: VenousBloodGasInterpretation = {
    respiratoryComponent,
    metabolicComponent,
    acidBaseStatus: pHState === 'LOW' ? 'ACIDEMIA' : pHState === 'HIGH' ? 'ALKALEMIA' : 'WITHIN_RI',
    primaryProcess: 'INDETERMINATE',
    disorder: 'INDETERMINATE',
    compensationStatus: 'INDETERMINATE',
    notes,
    details: [],
  };

  if (metabolicComponent === 'DISCORDANT' || metabolicSummary.tco2Discordant) {
    notes.push('METABOLIC_COMPONENT_DISCORDANT');
  }

  if (pHState === 'LOW') {
    if (respiratoryComponent === 'HIGH' && metabolicComponent === 'LOW') {
      result.primaryProcess = 'MIXED';
      result.disorder = 'MIXED_ACIDOSIS_PATTERN';
      result.compensationStatus = 'NOT_APPLICABLE';
    } else if (metabolicComponent === 'LOW') {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ACIDOSIS';

      if (respiratoryComponent === 'LOW') {
        result.compensationStatus = 'PARTIAL_COMPENSATION';
        addDogOrCatCompensationNote(species, notes, assessDogRespiratoryResponseToMetabolic(values, ri));
      } else if (respiratoryComponent === 'NORMAL') {
        result.compensationStatus = 'NO_COMPENSATION';
      } else if (respiratoryComponent === 'HIGH') {
        result.primaryProcess = 'MIXED';
        result.disorder = 'MIXED_ACIDOSIS_PATTERN';
        result.compensationStatus = 'NOT_APPLICABLE';
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (respiratoryComponent === 'HIGH') {
      result.primaryProcess = 'RESPIRATORY';
      result.disorder = 'RESPIRATORY_ACIDOSIS';

      if (metabolicComponent === 'HIGH') {
        result.compensationStatus = 'PARTIAL_COMPENSATION';
        addDogOrCatCompensationNote(species, notes, assessDogMetabolicResponseToRespiratory(values, ri));
      } else if (metabolicComponent === 'NORMAL') {
        result.compensationStatus = 'NO_COMPENSATION';
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (metabolicComponent === 'NORMAL' && (respiratoryComponent === 'LOW' || respiratoryComponent === 'NORMAL')) {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ACIDOSIS';
      result.compensationStatus = respiratoryComponent === 'LOW' ? 'PARTIAL_COMPENSATION' : 'NO_COMPENSATION';
      notes.push('PH_DRIVEN_METABOLIC_PATTERN');
    } else {
      notes.push('PRIMARY_PROCESS_UNCERTAIN');
    }
  } else if (pHState === 'HIGH') {
    if (respiratoryComponent === 'LOW' && metabolicComponent === 'HIGH') {
      result.primaryProcess = 'MIXED';
      result.disorder = 'MIXED_ALKALOSIS_PATTERN';
      result.compensationStatus = 'NOT_APPLICABLE';
    } else if (metabolicComponent === 'HIGH') {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ALKALOSIS';

      if (respiratoryComponent === 'HIGH') {
        result.compensationStatus = 'PARTIAL_COMPENSATION';
        addDogOrCatCompensationNote(species, notes, assessDogRespiratoryResponseToMetabolic(values, ri));
      } else if (respiratoryComponent === 'NORMAL') {
        result.compensationStatus = 'NO_COMPENSATION';
      } else if (respiratoryComponent === 'LOW') {
        result.primaryProcess = 'MIXED';
        result.disorder = 'MIXED_ALKALOSIS_PATTERN';
        result.compensationStatus = 'NOT_APPLICABLE';
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (respiratoryComponent === 'LOW') {
      result.primaryProcess = 'RESPIRATORY';
      result.disorder = 'RESPIRATORY_ALKALOSIS';

      if (metabolicComponent === 'LOW') {
        result.compensationStatus = 'PARTIAL_COMPENSATION';
        addDogOrCatCompensationNote(species, notes, assessDogMetabolicResponseToRespiratory(values, ri));
      } else if (metabolicComponent === 'NORMAL') {
        result.compensationStatus = 'NO_COMPENSATION';
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (metabolicComponent === 'NORMAL' && (respiratoryComponent === 'HIGH' || respiratoryComponent === 'NORMAL')) {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ALKALOSIS';
      result.compensationStatus = respiratoryComponent === 'HIGH' ? 'PARTIAL_COMPENSATION' : 'NO_COMPENSATION';
      notes.push('PH_DRIVEN_METABOLIC_PATTERN');
    } else {
      notes.push('PRIMARY_PROCESS_UNCERTAIN');
    }
  } else {
    if (respiratoryComponent === 'NORMAL' && metabolicComponent === 'NORMAL') {
      result.primaryProcess = 'NO_PRIMARY_PROCESS';
      result.disorder = 'NO_ACID_BASE_DISORDER';
      result.compensationStatus = 'NOT_APPLICABLE';
    } else if (respiratoryComponent === 'HIGH' && metabolicComponent === 'NORMAL') {
      result.primaryProcess = 'RESPIRATORY';
      result.disorder = 'RESPIRATORY_ACIDOSIS';
      result.compensationStatus = 'NO_COMPENSATION';
      notes.push('PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY');
    } else if (respiratoryComponent === 'LOW' && metabolicComponent === 'NORMAL') {
      result.primaryProcess = 'RESPIRATORY';
      result.disorder = 'RESPIRATORY_ALKALOSIS';
      result.compensationStatus = 'NO_COMPENSATION';
      notes.push('PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY');
    } else if (respiratoryComponent === 'NORMAL' && metabolicComponent === 'LOW') {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ACIDOSIS';
      result.compensationStatus = 'NO_COMPENSATION';
      notes.push('PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY');
    } else if (respiratoryComponent === 'NORMAL' && metabolicComponent === 'HIGH') {
      result.primaryProcess = 'METABOLIC';
      result.disorder = 'METABOLIC_ALKALOSIS';
      result.compensationStatus = 'NO_COMPENSATION';
      notes.push('PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY');
    } else if (respiratoryComponent === 'HIGH' && metabolicComponent === 'HIGH') {
      result.compensationStatus = 'COMPLETE_COMPENSATION';

      if (pHNormalPosition === 'LOW_NORMAL') {
        result.primaryProcess = 'RESPIRATORY';
        result.disorder = 'RESPIRATORY_ACIDOSIS';
        usedPHPositionTiebreaker = true;
        addDogOrCatCompensationNote(species, notes, assessDogMetabolicResponseToRespiratory(values, ri));
      } else if (pHNormalPosition === 'HIGH_NORMAL') {
        result.primaryProcess = 'METABOLIC';
        result.disorder = 'METABOLIC_ALKALOSIS';
        usedPHPositionTiebreaker = true;
        addDogOrCatCompensationNote(species, notes, assessDogRespiratoryResponseToMetabolic(values, ri));
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (respiratoryComponent === 'LOW' && metabolicComponent === 'LOW') {
      result.compensationStatus = 'COMPLETE_COMPENSATION';

      if (pHNormalPosition === 'LOW_NORMAL') {
        result.primaryProcess = 'METABOLIC';
        result.disorder = 'METABOLIC_ACIDOSIS';
        usedPHPositionTiebreaker = true;
        addDogOrCatCompensationNote(species, notes, assessDogRespiratoryResponseToMetabolic(values, ri));
      } else if (pHNormalPosition === 'HIGH_NORMAL') {
        result.primaryProcess = 'RESPIRATORY';
        result.disorder = 'RESPIRATORY_ALKALOSIS';
        usedPHPositionTiebreaker = true;
        addDogOrCatCompensationNote(species, notes, assessDogMetabolicResponseToRespiratory(values, ri));
      } else {
        notes.push('PRIMARY_PROCESS_UNCERTAIN');
      }
    } else if (respiratoryComponent === 'HIGH' && metabolicComponent === 'LOW') {
      result.primaryProcess = 'MIXED';
      result.disorder = 'MIXED_ACIDOSIS_PATTERN';
      result.compensationStatus = 'NOT_APPLICABLE';
    } else if (respiratoryComponent === 'LOW' && metabolicComponent === 'HIGH') {
      result.primaryProcess = 'MIXED';
      result.disorder = 'MIXED_ALKALOSIS_PATTERN';
      result.compensationStatus = 'NOT_APPLICABLE';
    } else {
      notes.push('PRIMARY_PROCESS_UNCERTAIN');
    }
  }

  addOptionalVenousNotes(values, ri, result.acidBaseStatus, respiratoryComponent, metabolicComponent, notes);
  result.details = buildInterpretationDetails(values, ri, result, pHState, metabolicSummary, usedPHPositionTiebreaker);

  return result;
}
