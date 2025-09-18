<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import {
    buildNorEpiDextroseViewModel,
    type NorEpiDextroseViewModel,
  } from '../viewmodels/norEpiDextroseViewModel';

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let targetDose: number | '' = 0.1;
  let pumpRate: number | '' = 1;
  let durationHr: number | '' = 24;

  let vm: NorEpiDextroseViewModel | null = null;
  $: vm = buildNorEpiDextroseViewModel({
    patient: p,
    targetDoseMcgPerKgMin: targetDose,
    pumpRateMlPerHr: pumpRate,
    durationHr,
  });

  const alertBase = 'rounded-lg border-2 px-3 py-2 font-bold';
  const defaultAlert = 'border-slate-200 bg-surface text-slate-200';
  const alertStyles: Record<string, string> = {
    warn: 'border-amber-300 border-dashed bg-amber-900/60 text-amber-100',
    info: 'border-sky-300 bg-sky-950/60 text-sky-100'
  };
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="NorEpi + Dextrose CRI Calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">NorEpi + Dextrose CRI</header>

  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="dose">Target dose (mcg/kg/min)</label>
      <input
        id="dose"
        class="field-control"
        type="number"
        min="0"
        step="0.01"
        bind:value={targetDose}
      />
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="rate">Pump rate (mL/hr)</label>
      <input
        id="rate"
        class="field-control"
        type="number"
        min="0"
        step="0.01"
        bind:value={pumpRate}
      />
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="duration">Planned duration (hr)</label>
      <input
        id="duration"
        class="field-control"
        type="number"
        min="0"
        step="0.1"
        bind:value={durationHr}
      />
    </div>
  </div>

  <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 text-slate-200 shadow-panel">
    <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Mixture Plan</h3>

    {#if vm}
      {#if vm.alerts?.length}
        <div class="mt-3 grid gap-2" aria-live="polite">
          {#each vm.alerts as a}
            <div class={`${alertBase} ${alertStyles[a.severity] ?? defaultAlert}`}>{a.message}</div>
          {/each}
        </div>
      {/if}

      {#if vm.drawCards.length}
        <div class="mt-4 space-y-4">
          <div class="rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <div class="text-xs font-black uppercase tracking-wide text-slate-300">Draw Volumes</div>
            <div class="mt-3 grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              {#each vm.drawCards as card}
                <div class="rounded-lg border border-slate-200 bg-surface p-4">
                  <div class="text-sm font-black uppercase tracking-wide text-slate-300">{card.title}</div>
                  <div class="mt-2 text-lg font-black tabular-nums text-slate-100">{card.volumeText}</div>
                  <div class="text-sm tabular-nums text-slate-300">
                    in <span class="inline-flex items-center rounded-full border border-slate-200 bg-surface-sunken px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-200">{card.syringeText}</span>
                    {#if card.fills}
                      <span class="ml-2 font-semibold text-amber-500">· {card.fills} fills</span>
                    {/if}
                    {#if card.tickText}
                      <span class="ml-2 text-slate-400">({card.tickText})</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <div class="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-surface p-4">
              <div class="text-sm font-black uppercase tracking-wide text-slate-300">Result</div>
              <div class="grid items-center gap-x-4 gap-y-2 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
                <div class="text-slate-300">Total volume</div>
                <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.totalVolumeText}</div>
                <div class="text-slate-300">Pump rate</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.pumpRateText}</div>
                <div class="text-slate-300">Planned duration</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.plannedDurationText}</div>
                <div class="text-slate-300">Delivered duration</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.deliveredDurationText}</div>
              </div>
              <div class="h-px bg-slate-700" role="presentation"></div>
              <div class="grid items-center gap-x-4 gap-y-2 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
                <div class="text-slate-300">Target dose</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.targetDoseText}</div>
                <div class="text-slate-300">Delivered dose</div>
                <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.deliveredDoseText}</div>
                <div class="text-slate-300">Final NorEpi concentration</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.finalNorEpiConcText}</div>
                <div class="text-slate-300">Final Dextrose</div>
                <div class="text-right tabular-nums text-slate-100">{vm.resultCard.finalDextroseText}</div>
              </div>
            </div>
          </div>

          {#if vm.roundingDetail}
            <details class="rounded-lg border border-slate-200 bg-surface-sunken p-4 text-slate-200">
              <summary class="flex cursor-pointer items-center justify-between text-sm font-black uppercase tracking-wide text-slate-200">
                <span>{vm.roundingDetail.title}</span>
                <span class="text-xs text-slate-400">▾</span>
              </summary>
              <table class="mt-3 w-full table-fixed border-collapse text-sm">
                <tbody>
                  {#each vm.roundingDetail.rows as r}
                    <tr>
                      <th class="py-1 pr-3 text-left font-semibold text-slate-300">{r.label}</th>
                      <td class="py-1 text-right font-semibold tabular-nums text-slate-100">
                        {r.value}
                        {#if r.subnote}
                          <div class="mt-1 text-xs text-slate-400">{r.subnote}</div>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </details>
          {/if}
        </div>
      {:else}
        <p class="mt-3 text-sm text-slate-400">Unable to build a mixture with these settings.</p>
      {/if}
    {:else}
      <p class="mt-3 text-sm text-slate-400">Enter patient weight, dose, pump rate, and duration to see the plan.</p>
    {/if}
  </div>
</section>
