import { writable } from 'svelte/store';

export type Species = 'dog' | 'cat';
export type Patient = {
  weightKg: number | null;
  species: Species | '';
  name: string;
};

const initialPatient: Patient = { weightKg: null, species: '', name: '' };

export const patient = writable<Patient>(initialPatient);
