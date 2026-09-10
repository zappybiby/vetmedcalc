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
  let copiedFoodId: string | null = null;
  let copyingFoodId: string | null = null;
  let copyMessage = '';
  let fallbackNote = '';
  let copyContext = '';

  // A copied note describes one specific set of patient and feeding inputs.
  $: {
    const nextContext = JSON.stringify([p.name, selectedSpecies, weightKg, rerFactor, intervalHours, customKcalPerCan]);
    if (copyContext !== nextContext) {
      copyContext = nextContext;
      copiedFoodId = null;
      copyingFoodId = null;
      copyMessage = '';
      fallbackNote = '';
    }
  }

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

  function feedingNote(plan: FoodFeedingPlan): string {
    const species = selectedSpecies === 'cat' ? 'Cat' : 'Dog';
    const patientDescription = [p.name.trim(), species, `${plan.weightKg} kg`].filter(Boolean).join(', ');
    const foodDescription = plan.food.id === 'custom' ? 'Custom food' : plan.food.name;
    const canDescription = [plan.food.canSize, `${plan.food.kcalPerCan} kcal/can`].filter(Boolean).join('; ');

    return `Nutrition: ${patientDescription}. ${foodDescription} (${canDescription}): ` +
      `${formatCanPortion(plan.roundedCansPerInterval)} every ${plan.intervalHours} hr ` +
      `(~${fmtWhole(plan.roundedKcalPerInterval)} kcal/feed). ` +
      `RER factor ${plan.rerFactor}; target ${fmtWhole(plan.targetKcalPerDay)} kcal/day. ` +
      `Calculated amount: ${fmt(plan.exactCansPerInterval, 2)} cans/feed before portion rounding.`;
  }

  async function copyNote(plan: FoodFeedingPlan): Promise<void> {
    const note = feedingNote(plan);
    const context = copyContext;
    copiedFoodId = null;
    copyingFoodId = plan.food.id;
    copyMessage = '';
    fallbackNote = '';

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(note);
      if (context !== copyContext) return;
      copiedFoodId = plan.food.id;
      copyMessage = `Copied ${plan.food.id === 'custom' ? 'custom food' : plan.food.name} feeding note.`;
    } catch {
      if (context !== copyContext) return;
      fallbackNote = note;
      copyMessage = 'Clipboard unavailable. Select and copy the note below.';
    } finally {
      if (context === copyContext) copyingFoodId = null;
    }
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

  let displayedPlans: FoodFeedingPlan[] = [];
  $: displayedPlans = customPlan ? [customPlan, ...plans] : plans;
</script>

<section class="ui-tool-stack text-slate-200" aria-label="Food calculator">
  <div class="ui-card min-w-0 overflow-hidden">
    <div class="ui-card-padding">
      <div class="grid grid-cols-2 items-end gap-2 sm:gap-3 md:grid-cols-4">
        <div class="grid min-w-0 gap-1.5">
          <div class="ui-label" id="food-species-label">Species</div>
          <div class="grid min-w-0 grid-cols-2 gap-1.5" role="group" aria-labelledby="food-species-label">
            {#each speciesOptions as option (option.value)}
              <button
                type="button"
                class="ui-choice"
                aria-pressed={selectedSpecies === option.value}
                on:click={() => selectSpecies(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <label class="grid gap-1.5">
          <span class="ui-label">RER factor</span>
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

        <label class="grid gap-1.5">
          <span class="ui-label">Interval (hours)</span>
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

        <label class="grid min-w-0 gap-1.5">
          <span class="ui-label">Custom food <span class="normal-case">(kcal/can)</span></span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="1"
            bind:value={customKcalPerCan}
            inputmode="decimal"
            aria-label="Custom kcal/can"
            placeholder="Optional"
          />
        </label>
      </div>

      {#if issues.length}
        <div class="mt-2 ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100 sm:mt-3">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}

      {#if firstPlan}
        <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:mt-3" aria-label="Feeding target">
          <span><span class="font-bold">Target</span> {fmtWhole(firstPlan.targetKcalPerDay)} kcal/day</span>
          <span>{fmtWhole(firstPlan.kcalPerInterval)} kcal every {intervalHoursValue} hr</span>
        </p>
      {/if}

      <p role="status" aria-live="polite" class:mt-2={copyMessage !== ''} class="ui-meta">{copyMessage}</p>
      {#if fallbackNote}
        <label class="mt-2 grid gap-1.5">
          <span class="ui-label">Feeding note</span>
          <textarea
            class="field-control min-h-32 resize-y text-sm leading-relaxed"
            readonly
            value={fallbackNote}
            on:focus={(event) => event.currentTarget.select()}
          ></textarea>
        </label>
      {/if}
    </div>

    {#if firstPlan}
      <table class="food-table w-full table-fixed border-t ui-rule text-left text-sm" aria-label="Food portions">
        <colgroup>
          <col class="food-name-column" />
          <col class="food-portion-column" />
          <col class="hidden md:table-column" />
          <col class="hidden md:table-column" />
          <col class="food-copy-column" />
        </colgroup>
        <thead class="bg-surface-sunken">
          <tr>
            <th scope="col" class="ui-label">Food</th>
            <th scope="col" class="ui-label">Per feeding</th>
            <th scope="col" class="ui-label hidden md:table-cell">Exact <span class="normal-case">(cans)</span></th>
            <th scope="col" class="ui-label hidden md:table-cell"><span class="normal-case">kcal/feed</span></th>
            <th scope="col" class="food-copy-cell ui-label"><span class="md:sr-only">Note</span></th>
          </tr>
        </thead>
        <tbody class="ui-table-rows">
          {#each displayedPlans as plan (plan.food.id)}
            <tr>
              <th scope="row" class="font-normal">
                <div class="break-words font-semibold leading-snug text-slate-100">{plan.food.id === 'custom' ? 'Custom food' : plan.food.name}</div>
                <div class="mt-0.5 ui-meta-compact tabular-nums">
                  {#if plan.food.canSize}{plan.food.canSize} · {/if}{fmtWhole(plan.food.kcalPerCan)} kcal/can
                </div>
              </th>
              <td>
                <div class="ui-row-value leading-snug">{formatCanPortion(plan.roundedCansPerInterval)}</div>
                <div class="mt-1 ui-meta-compact tabular-nums md:hidden">{fmt(plan.exactCansPerInterval, 2)} exact</div>
                <div class="mt-1 ui-meta-compact tabular-nums md:hidden">{fmtWhole(plan.roundedKcalPerInterval)} kcal/feed</div>
              </td>
              <td class="hidden tabular-nums md:table-cell">{fmt(plan.exactCansPerInterval, 2)}</td>
              <td class="hidden tabular-nums md:table-cell">{fmtWhole(plan.roundedKcalPerInterval)}</td>
              <td class="food-copy-cell">
                <button
                  type="button"
                  class="ui-button min-h-9 min-w-9 whitespace-nowrap px-2"
                  aria-label={`Copy note for ${plan.food.id === 'custom' ? 'custom food' : plan.food.name}`}
                  title={copiedFoodId === plan.food.id ? 'Copied feeding note' : 'Copy feeding note'}
                  disabled={copyingFoodId !== null}
                  on:click={() => copyNote(plan)}
                >
                  <svg class="h-4 w-4 md:hidden" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                    {#if copiedFoodId === plan.food.id}
                      <path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round" />
                    {:else}
                      <rect x="7" y="6" width="10" height="11" rx="1.5" />
                      <path d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7" />
                    {/if}
                  </svg>
                  <span class="hidden md:inline">{copiedFoodId === plan.food.id ? 'Copied' : 'Copy note'}</span>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

<style>
  .food-table th,
  .food-table td {
    padding: 0.5rem 0.625rem;
    vertical-align: top;
  }

  .food-table thead th {
    padding-top: 0.625rem;
    padding-bottom: 0.625rem;
    line-height: 1.25;
  }

  .food-name-column {
    width: 58%;
  }

  .food-copy-column {
    width: 3rem;
  }

  .food-table .food-copy-cell {
    padding-right: 0.375rem;
    padding-left: 0.375rem;
    text-align: center;
  }

  @media (min-width: 768px) {
    .food-table th,
    .food-table td {
      padding-right: 0.75rem;
      padding-left: 0.75rem;
      vertical-align: middle;
    }

    .food-name-column {
      width: 43%;
    }

    .food-portion-column {
      width: 18%;
    }

    .food-copy-column {
      width: 7rem;
    }

    .food-table .food-copy-cell {
      padding-right: 0.75rem;
      padding-left: 0.75rem;
      text-align: right;
    }
  }
</style>
