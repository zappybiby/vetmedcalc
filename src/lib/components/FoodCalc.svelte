<script lang="ts">
  import { PET_FOOD_CANS } from '@defs';
  import type { PetFoodCanDef, Species } from '@defs';
  import { buildFoodFeedingPlan, formatCanPortion, type FoodFeedingPlan } from '../helpers/food';
  import { patient, type Patient } from '../stores/patient';

  const DEFAULT_INTERVAL_HOURS = 6;
  const DEFAULT_RER_FACTOR = 1.0;

  const speciesOptions: readonly { value: Species; label: string }[] = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' },
  ];

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let selectedSpecies: Species = 'dog';
  $: selectedSpecies = p.species || 'dog';

  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  let rerFactor: number | '' = DEFAULT_RER_FACTOR;
  let intervalHours: number | '' = DEFAULT_INTERVAL_HOURS;
  let customKcalPerCan: number | '' = '';
  let customKcalInput: HTMLInputElement;

  function numeric(value: number | '' | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    return num.toFixed(digits);
  }

  function fmtWhole(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return Math.round(Number(value)).toString();
  }

  function selectSpecies(species: Species): void {
    patient.update(prev => prev.species === species ? prev : { ...prev, species });
  }

  function focusCustomKcal(): void {
    customKcalInput?.focus();
  }

  function foodBrandRank(food: PetFoodCanDef): number {
    if (food.name.startsWith("Hill's ")) return 0;
    if (food.name.startsWith('Royal Canin ')) return 1;
    if (food.name.startsWith('Purina ')) return 2;
    return 3;
  }

  let rerFactorValue: number | null = null;
  let intervalHoursValue: number | null = null;
  let customKcalPerCanValue: number | null = null;
  $: rerFactorValue = numeric(rerFactor);
  $: intervalHoursValue = numeric(intervalHours);
  $: customKcalPerCanValue = numeric(customKcalPerCan);

  let foods: readonly PetFoodCanDef[] = [];
  $: foods = PET_FOOD_CANS
    .filter(food => food.species === selectedSpecies || food.species === 'both')
    .sort((a, b) => foodBrandRank(a) - foodBrandRank(b));

  let issues: string[] = [];
  $: {
    const next: string[] = [];

    if (weightKg == null) {
      next.push('Enter a patient weight to calculate calories.');
    }
    if (rerFactorValue != null && rerFactorValue <= 0) {
      next.push('RER factor must be greater than 0.');
    }
    if (intervalHoursValue != null && intervalHoursValue <= 0) {
      next.push('Interval hours must be greater than 0.');
    }

    issues = next;
  }

  let plans: FoodFeedingPlan[] = [];
  $: plans = (
    weightKg != null &&
    rerFactorValue != null &&
    intervalHoursValue != null &&
    issues.length === 0
  )
    ? foods.map(food => buildFoodFeedingPlan({
        weightKg,
        rerFactor: rerFactorValue,
        intervalHours: intervalHoursValue,
        food,
      }))
    : [];

  let firstPlan: FoodFeedingPlan | undefined;
  $: firstPlan = plans[0];

  let customPlan: FoodFeedingPlan | null = null;
  $: customPlan = (
    weightKg != null &&
    rerFactorValue != null &&
    intervalHoursValue != null &&
    customKcalPerCanValue != null &&
    customKcalPerCanValue > 0 &&
    issues.length === 0
  )
    ? buildFoodFeedingPlan({
        weightKg,
        rerFactor: rerFactorValue,
        intervalHours: intervalHoursValue,
        food: {
          id: 'custom',
          name: 'Custom',
          canSize: '',
          species: 'both',
          kcalPerCan: customKcalPerCanValue,
        },
      })
    : null;
</script>

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="Food calculator">
  <div class="grid min-w-0 gap-2 sm:gap-3">
    <div class="ui-card min-w-0 p-2.5 sm:p-4">
      <h2 class="text-[13px] font-black uppercase tracking-wide text-slate-200 sm:text-sm">Inputs</h2>

      <div class="mt-2 grid gap-2 min-[360px]:grid-cols-2 sm:mt-3 sm:gap-3 xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div class="grid min-w-0 gap-1.5 sm:gap-2">
          <div class="ui-label" id="food-species-label">Species</div>
          <div class="grid min-w-0 grid-cols-2 gap-1.5" role="group" aria-labelledby="food-species-label">
            {#each speciesOptions as option (option.value)}
              <button
                type="button"
                class={`rounded-lg border px-3 py-2 text-sm font-extrabold transition-colors ${selectedSpecies === option.value ? 'border-sky-400/70 bg-sky-400/15 text-slate-100 shadow-[inset_0_2px_0_rgba(127,192,229,0.55)]' : 'border-slate-700/50 bg-surface-sunken text-slate-300 hover:border-slate-600/70 hover:text-slate-100'}`}
                aria-pressed={selectedSpecies === option.value}
                on:click={() => selectSpecies(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <label class="grid gap-1.5 sm:gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">RER factor</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.01"
            bind:value={rerFactor}
            inputmode="decimal"
            placeholder="e.g., 1.0"
          />
        </label>

        <label class="grid gap-1.5 sm:gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Interval (hours)</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.25"
            bind:value={intervalHours}
            inputmode="decimal"
            placeholder="e.g., 6"
          />
        </label>
      </div>

      {#if issues.length}
        <div class="mt-2 rounded-lg border border-amber-300/30 bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-100 sm:mt-3">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}
    </div>

    {#if firstPlan}
      <div class="ui-card min-w-0 overflow-hidden">
        <div class="grid gap-px bg-slate-800/70 p-px sm:gap-1.5 sm:bg-transparent sm:p-2 min-[860px]:grid-cols-2 min-[1540px]:grid-cols-3">
          <article class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 bg-surface-sunken px-2.5 py-1.5 text-sm text-slate-200 sm:rounded-lg sm:border sm:border-slate-700/40">
            <div class="flex min-w-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center rounded-md border border-sky-400/35 bg-sky-400/10 px-2 text-xs font-black uppercase tracking-wide text-slate-100"
                on:click={focusCustomKcal}
              >
                Custom
              </button>
              <input
                bind:this={customKcalInput}
                class="field-control h-8 max-w-[7.25rem] px-2 py-1 text-right text-sm font-black tabular-nums"
                type="number"
                min="0"
                step="1"
                bind:value={customKcalPerCan}
                inputmode="decimal"
                aria-label="Custom kcal/can"
                placeholder="kcal/can"
              />
            </div>

            <div class="row-span-2 self-center rounded-md border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-right">
              <div class="whitespace-nowrap text-[15px] font-black leading-tight tabular-nums text-slate-100">
                {customPlan ? formatCanPortion(customPlan.roundedCansPerInterval) : '—'}
              </div>
              <div class="mt-0.5 whitespace-nowrap text-[10px] leading-tight tabular-nums text-slate-400">
                {#if customPlan}{fmt(customPlan.exactCansPerInterval, 2)} exact{:else}<span aria-hidden="true">&nbsp;</span>{/if}
              </div>
            </div>

            <div class="min-w-0 text-[11px] leading-tight tabular-nums text-slate-400">
              {#if customPlan}
                <span>{fmtWhole(customPlan.roundedKcalPerInterval)} kcal/feed</span>
              {:else}
                <span aria-hidden="true">&nbsp;</span>
              {/if}
            </div>
          </article>

          {#each plans as plan (plan.food.id)}
            <article class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 bg-surface-sunken px-2.5 py-1.5 text-sm text-slate-200 sm:rounded-lg sm:border sm:border-slate-700/40">
              <div class="min-w-0">
                <span class="break-words font-semibold leading-tight text-slate-100">{plan.food.name}</span>
                <span class="ml-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-400">{plan.food.canSize}</span>
              </div>

              <div class="row-span-2 self-center rounded-md border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-right">
                <div class="whitespace-nowrap text-[15px] font-black leading-tight tabular-nums text-slate-100">{formatCanPortion(plan.roundedCansPerInterval)}</div>
                <div class="mt-0.5 whitespace-nowrap text-[10px] leading-tight tabular-nums text-slate-400">{fmt(plan.exactCansPerInterval, 2)} exact</div>
              </div>

              <div class="min-w-0 text-[11px] leading-tight tabular-nums text-slate-400">
                <span>{fmtWhole(plan.food.kcalPerCan)} kcal/can</span>
                <span class="mx-1 text-slate-600">/</span>
                <span>{fmtWhole(plan.roundedKcalPerInterval)} kcal/feed</span>
              </div>
            </article>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>
