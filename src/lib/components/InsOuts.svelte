<script lang="ts">
  import { patient, type Patient } from '../stores/patient';

  const DEFAULT_HOURS_WINDOW = 4;

  // Patient context
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;
  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  // Inputs
  let hoursWindow: number | '' = DEFAULT_HOURS_WINDOW;
  let insMl: number | '' = '';
  let urineOutMl: number | '' = '';

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

  function fmtCompact(value: number | null | undefined, maxDigits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    const rounded = Number(num.toFixed(maxDigits));
    return rounded.toString();
  }

  function fmtSigned(value: number | null | undefined, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return fmt(0, digits);
    const rounded = fmt(num, digits);
    if (rounded === '—') return '—';
    return num > 0 ? `+${rounded}` : rounded;
  }

  // Core numbers
  let windowHours: number | null = null;
  let totalInsMl: number | null = null;
  let totalOutMl: number | null = null;
  $: windowHours = numeric(hoursWindow);
  $: totalInsMl = numeric(insMl);
  $: totalOutMl = numeric(urineOutMl);

  // Derived rates
  let insMlPerHr: number | null = null;
  let insMlPerKgHr: number | null = null;
  let outMlPerHr: number | null = null;
  let outMlPerKgHr: number | null = null;
  let netMlPerHr: number | null = null;
  let balanceDescriptor = '—';

  $: insMlPerHr = totalInsMl == null || windowHours == null || windowHours <= 0 ? null : totalInsMl / windowHours;
  $: insMlPerKgHr = insMlPerHr == null || !weightKg ? null : insMlPerHr / weightKg;

  $: outMlPerHr = totalOutMl == null || windowHours == null || windowHours <= 0 ? null : totalOutMl / windowHours;
  $: outMlPerKgHr = outMlPerHr == null || !weightKg ? null : outMlPerHr / weightKg;

  $: netMlPerHr = insMlPerHr == null || outMlPerHr == null ? null : insMlPerHr - outMlPerHr;
  $: balanceDescriptor = netMlPerHr == null
    ? '—'
    : netMlPerHr > 0
      ? 'Input > output'
      : netMlPerHr < 0
        ? 'Input < output'
        : 'Input = output';
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="Ins and outs calculator">
  <div class="grid min-w-0 gap-4">
    <div class="ui-card min-w-0 p-4">
      <div class="grid min-w-0 gap-4 md:grid-cols-2 md:divide-x md:divide-slate-800">
        <div class="min-w-0 md:col-span-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-200">
            Inputs (last {fmtCompact(windowHours)} {windowHours === 1 ? 'hour' : 'hours'})
          </h2>
          <div class="mt-3 grid gap-3">
            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid ins (mL)</span>
              <input
                class="field-control"
                type="number"
                min="0"
                step="1"
                bind:value={insMl}
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
                bind:value={urineOutMl}
                inputmode="decimal"
                placeholder="e.g., 320"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Duration (hours)</span>
              <input
                class="field-control"
                type="number"
                min="0.25"
                step="0.25"
                bind:value={hoursWindow}
                inputmode="decimal"
              />
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="grid min-w-0 gap-4">
      <div class="ui-card min-w-0 p-4">
        <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Fluid summary</h3>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article class="ui-inset min-w-0 p-4">
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

          <article class="ui-inset min-w-0 p-4">
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

          <article class="ui-inset min-w-0 p-4">
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

    </div>
  </div>
</section>
