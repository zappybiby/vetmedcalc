import { writable } from 'svelte/store';

export type Species = 'dog' | 'cat';
export type Patient = {
  weightKg: number | null;
  species: Species | '';
  name: string;
};

const STORAGE_KEY = 'vmc.patient';

function createPatientStore() {
  // lazy read so SSR-safe if you later adopt it
  const initial: Patient = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Patient;
    } catch {}
    return { weightKg: null, species: '', name: '' };
  })();

  const store = writable<Patient>(initial);
  store.subscribe((v) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
  });
  return store;
}

export const patient = createPatientStore();
