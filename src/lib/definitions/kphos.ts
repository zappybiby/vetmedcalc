export const KPHOS_PHOS_MMOL_PER_ML = 3;
export const KPHOS_K_MEQ_PER_ML = 4.4;
export const KCL_K_MEQ_PER_ML = 2;

export type KPhosBaseFluidId = 'norm-r' | 'plasma-lyte-148' | 'isolyte-s' | 'normal-saline';

export type KPhosBaseFluid = {
  id: KPhosBaseFluidId;
  label: string;
  nativeKMeqPerL: number;
  nativePhosMmolPerL: number;
};

export const KPHOS_BASE_FLUIDS: readonly KPhosBaseFluid[] = [
  { id: 'norm-r', label: 'Norm-R', nativeKMeqPerL: 5, nativePhosMmolPerL: 0 },
  { id: 'plasma-lyte-148', label: 'Plasma-Lyte 148', nativeKMeqPerL: 5, nativePhosMmolPerL: 0 },
  { id: 'isolyte-s', label: 'Isolyte S pH 7.4', nativeKMeqPerL: 5, nativePhosMmolPerL: 0.5 },
  { id: 'normal-saline', label: '0.9% NaCl', nativeKMeqPerL: 0, nativePhosMmolPerL: 0 },
];

export function getKPhosBaseFluid(id: KPhosBaseFluidId): KPhosBaseFluid {
  return KPHOS_BASE_FLUIDS.find((fluid) => fluid.id === id) ?? KPHOS_BASE_FLUIDS[0];
}
