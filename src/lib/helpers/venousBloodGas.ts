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
export type VenousBloodGasConfidence = 'STANDARD' | 'MODERATE' | 'LOW';
export type VenousBloodGasNote =
  | 'METABOLIC_COMPONENT_DISCORDANT'
  | 'PRIMARY_PROCESS_UNCERTAIN'
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

export type VenousBloodGasInterpretation = {
  acidBaseStatus: AcidBaseStatus;
  respiratoryComponent: ComponentState;
  metabolicComponent: ComponentState;
  primaryProcess: PrimaryProcess;
  disorder: Disorder;
  compensationStatus: CompensationStatus;
  notes: VenousBloodGasNote[];
  confidence: VenousBloodGasConfidence;
};

type DirectionState = 'LOW' | 'NORMAL' | 'HIGH' | 'MISSING';
type PHNormalPosition = 'LOW_NORMAL' | 'MID_NORMAL' | 'HIGH_NORMAL' | 'OUTSIDE_RI';

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

function summarizeMetabolicComponent(
  values: VenousBloodGasValues,
  ri: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>,
): { component: ComponentState; strength: VenousBloodGasConfidence } {
  const states: DirectionState[] = [
    compareToRi(values.HCO3, ri.HCO3),
    compareToRi(values.BEecf, ri.BEecf),
  ];

  if (values.TCO2 != null) {
    states.push(compareToRi(values.TCO2, ri.TCO2));
  }

  const filtered = states.filter((state) => state !== 'MISSING');
  if (filtered.length === 0) {
    return { component: 'MISSING', strength: 'LOW' };
  }

  const lowCount = filtered.filter((state) => state === 'LOW').length;
  const highCount = filtered.filter((state) => state === 'HIGH').length;
  const normalCount = filtered.filter((state) => state === 'NORMAL').length;

  if (lowCount > 0 && highCount > 0) return { component: 'DISCORDANT', strength: 'LOW' };
  if (lowCount >= 2) return { component: 'LOW', strength: 'STANDARD' };
  if (highCount >= 2) return { component: 'HIGH', strength: 'STANDARD' };
  if (normalCount >= 2) return { component: 'NORMAL', strength: 'STANDARD' };
  if (lowCount === 1) return { component: 'LOW', strength: 'MODERATE' };
  if (highCount === 1) return { component: 'HIGH', strength: 'MODERATE' };
  return { component: 'NORMAL', strength: 'MODERATE' };
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
    confidence: 'LOW',
  };

  if (metabolicComponent === 'DISCORDANT') {
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

  if (result.primaryProcess === 'INDETERMINATE' || metabolicComponent === 'DISCORDANT') {
    result.confidence = 'LOW';
  } else if (
    species === 'cat' &&
    (result.compensationStatus === 'PARTIAL_COMPENSATION' || result.compensationStatus === 'COMPLETE_COMPENSATION')
  ) {
    result.confidence = 'MODERATE';
  } else if (usedPHPositionTiebreaker || metabolicSummary.strength === 'MODERATE') {
    result.confidence = 'MODERATE';
  } else {
    result.confidence = 'STANDARD';
  }

  return result;
}
