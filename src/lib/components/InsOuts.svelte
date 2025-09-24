<script lang="ts">
  import { patient, type Patient } from '../stores/patient';

  const HOURS_WINDOW = 4;

  // Patient context
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;
  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  // Inputs
  let insFourHours: number | '' = '';
  let urineFourHours: number | '' = '';
  let maintenanceRate: number | '' = 2.5;
  let insensibleAllowance: number | '' = 15;
  let replacementFraction: number | '' = 0.5;

  function numeric(value: number | '' | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value: number | null | undefined, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    return num.toFixed(digits);
  }

  function fmtSigned(value: number | null | undefined, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return fmt(0, digits);
    const rounded = fmt(num, digits);
    if (rounded === '—') return '—';
    return num > 0 ? `+${rounded}` : rounded;
  }

  function fmtInt(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) return '—';
    return Math.round(Number(value)).toLocaleString();
  }

  // Core numbers
  let totalInsMl: number | null = null;
  let totalOutMl: number | null = null;
  let maintRate: number | null = null;
  let insensPerKgDay: number | null = null;
  let fractionRaw: number | null = null;
  let fraction: number | null = null;
  $: totalInsMl = numeric(insFourHours);
  $: totalOutMl = numeric(urineFourHours);
  $: maintRate = numeric(maintenanceRate);
  $: insensPerKgDay = numeric(insensibleAllowance);
  $: fractionRaw = numeric(replacementFraction);
  $: fraction = fractionRaw == null ? null : Math.min(Math.max(fractionRaw, 0), 1);

  // Derived rates
  let insMlPerHr: number | null = null;
  let insMlPerKgHr: number | null = null;
  let outMlPerHr: number | null = null;
  let outMlPerKgHr: number | null = null;
  let netMlPerHr: number | null = null;
  let balanceDescriptor = '—';
  let urinePerKgHr: number | null = null;
  let aggressiveRate: number | null = null;
  let balancedRate: number | null = null;
  let conservativeRate: number | null = null;

  $: insMlPerHr = totalInsMl == null ? null : totalInsMl / HOURS_WINDOW;
  $: insMlPerKgHr = insMlPerHr == null || !weightKg ? null : insMlPerHr / weightKg;

  $: outMlPerHr = totalOutMl == null ? null : totalOutMl / HOURS_WINDOW;
  $: outMlPerKgHr = outMlPerHr == null || !weightKg ? null : outMlPerHr / weightKg;

  $: netMlPerHr = insMlPerHr == null || outMlPerHr == null ? null : insMlPerHr - outMlPerHr;
  $: balanceDescriptor = netMlPerHr == null
    ? '—'
    : netMlPerHr > 0
      ? 'Input > output'
      : netMlPerHr < 0
        ? 'Input < output'
        : 'Input = output';

  $: urinePerKgHr = totalOutMl == null || !weightKg ? null : totalOutMl / (HOURS_WINDOW * weightKg);

  // Adjustment strategies
  $: aggressiveRate = weightKg && maintRate != null && totalOutMl != null
    ? Math.round((maintRate * weightKg) + (totalOutMl / HOURS_WINDOW))
    : null;

  $: balancedRate = weightKg && insensPerKgDay != null && totalOutMl != null
    ? Math.round(((insensPerKgDay / 24) * weightKg) + (totalOutMl / HOURS_WINDOW))
    : null;

  $: conservativeRate = weightKg && maintRate != null && totalOutMl != null && fraction != null
    ? Math.round((maintRate * weightKg) + fraction * (totalOutMl / HOURS_WINDOW))
    : null;
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="Ins and outs calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">Ins / Outs</header>

  <div class="grid min-w-0 gap-4">
    <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-card">
      <div class="grid min-w-0 gap-4 md:grid-cols-2 md:divide-x md:divide-slate-800">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-200">Inputs (last 4 hours)</h2>
          <div class="mt-3 grid gap-3">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid ins (mL)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                bind:value={insFourHours}
                inputmode="decimal"
                placeholder="e.g., 400"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Urine output (mL)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                bind:value={urineFourHours}
                inputmode="decimal"
                placeholder="e.g., 320"
              />
            </label>

            <div class="grid min-w-0 gap-2 rounded-lg border border-slate-700/60 bg-surface-sunken p-3 text-sm text-slate-300">
              <div class="font-semibold uppercase tracking-wide text-slate-300">Patient weight</div>
              <div class="text-lg font-black text-slate-100">
                {#if weightKg}
                  {weightKg.toFixed(2)} kg
                {:else}
                  Enter weight in Patient panel
                {/if}
              </div>
            </div>
          </div>
        </div>

        <div class="min-w-0 md:pl-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-200">Adjustment parameters</h2>
          <div class="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Maintenance rate (mL/kg/hr)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                step="0.1"
                bind:value={maintenanceRate}
                inputmode="decimal"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Insensible allowance (mL/kg/day)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                bind:value={insensibleAllowance}
                inputmode="decimal"
              />
            </label>

            <label class="grid gap-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Replacement fraction (0–1)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                max="1"
                step="0.05"
                bind:value={replacementFraction}
                inputmode="decimal"
              />
              <span class="text-xs text-slate-400">Use 0.5–0.75 for typical conservative replacement.</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="grid min-w-0 gap-4">
      <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-panel">
        <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Fluid summary</h3>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid ins</header>
            <dl class="mt-3 grid gap-3 text-sm text-slate-300">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</dt>
                <dd class="mt-1 text-right text-lg font-black text-slate-100">
                  <span class="tabular-nums">{fmt(insMlPerHr)}</span>
                  <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</dt>
                <dd class="mt-1 text-right text-lg font-black text-slate-100">
                  <span class="tabular-nums">{fmt(insMlPerKgHr)}</span>
                  <span class="ml-1 text-sm font-semibold text-slate-300">mL/kg/hr</span>
                </dd>
              </div>
            </dl>
          </article>

          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid outs</header>
            <dl class="mt-3 grid gap-3 text-sm text-slate-300">
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</dt>
                <dd class="mt-1 text-right text-lg font-black text-slate-100">
                  <span class="tabular-nums">{fmt(outMlPerHr)}</span>
                  <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</dt>
                <dd class="mt-1 text-right text-lg font-black text-slate-100">
                  <span class="tabular-nums">{fmt(outMlPerKgHr)}</span>
                  <span class="ml-1 text-sm font-semibold text-slate-300">mL/kg/hr</span>
                </dd>
              </div>
            </dl>
          </article>

          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Net balance</header>
            <div class="mt-3 space-y-3 text-sm text-slate-300">
              <div class="text-right text-sm font-semibold uppercase tracking-wide text-slate-100">{balanceDescriptor}</div>
              <div class="flex items-baseline justify-between gap-2">
                <span>Δ mL/hr</span>
                <span class="text-right text-lg font-black text-slate-100">
                  <span class="tabular-nums">{fmtSigned(netMlPerHr)}</span>
                  <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-panel">
        <div class="flex flex-col gap-1 border-b border-slate-700/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Next 4 hour adjustments</h3>
          <div class="text-xs text-slate-400">
            {#if urinePerKgHr != null}
              UOP (U) = {fmt(urinePerKgHr)} mL/kg/hr
            {:else}
              Provide weight and urine volume to compute UOP
            {/if}
          </div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Aggressive replacement</header>
            <div class="mt-2 text-2xl font-black tabular-nums text-slate-100">{fmtInt(aggressiveRate)}<span class="ml-1 text-base font-semibold text-slate-300">mL/hr</span></div>
            <p class="mt-2 text-xs text-slate-400 leading-snug">Full UOP replacement + maintenance.</p>
            <div class="mt-2 font-mono text-xs leading-tight text-slate-400">(Maint * k) + (L / 4)</div>
          </article>

          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Balanced replacement</header>
            <div class="mt-2 text-2xl font-black tabular-nums text-slate-100">{fmtInt(balancedRate)}<span class="ml-1 text-base font-semibold text-slate-300">mL/hr</span></div>
            <p class="mt-2 text-xs text-slate-400 leading-snug">Insensible allowance + full UOP.</p>
            <div class="mt-2 font-mono text-xs leading-tight text-slate-400">((Insens / 24) * k) + (L / 4)</div>
          </article>

          <article class="min-w-0 rounded-lg border border-slate-200 bg-surface-sunken p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Conservative replacement</header>
            <div class="mt-2 text-2xl font-black tabular-nums text-slate-100">{fmtInt(conservativeRate)}<span class="ml-1 text-base font-semibold text-slate-300">mL/hr</span></div>
            <p class="mt-2 text-xs text-slate-400 leading-snug">Maintenance + fractional UOP (f = {fmt(fraction, 2)}).</p>
            <div class="mt-2 font-mono text-xs leading-tight text-slate-400">(Maint * k) + f * (L / 4)</div>
          </article>
        </div>
      </div>
    </div>
  </div>
</section>
