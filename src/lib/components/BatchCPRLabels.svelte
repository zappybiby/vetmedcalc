<script lang="ts">
  import type { Species } from '@defs';
  import {
    computeCprLabel,
    renderCprLabelMarkup,
    CPR_LABEL_PRINT_STYLES,
    type CPRLabelPatient,
  } from '../labels/cprLabel';

  type FieldKey = 'name' | 'species' | 'weight';

  type BatchRow = {
    id: number;
    name: string;
    species: Species | '';
    weight: string;
  };

  const fieldOrder: readonly FieldKey[] = ['name', 'species', 'weight'];
  const speciesOptions: readonly { value: Species; label: string }[] = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' },
  ];

  let rowId = 0;
  const createRow = (): BatchRow => ({ id: rowId++, name: '', species: '', weight: '' });

  let rows: BatchRow[] = [createRow(), createRow()];

  const isRowBlank = (row: BatchRow) => !row.name.trim() && !row.species && !row.weight.trim();

  function ensureTrailingBlankRow() {
    if (!rows.length) {
      rows = [createRow(), createRow()];
      return;
    }
    const last = rows[rows.length - 1];
    if (!isRowBlank(last)) {
      rows = [...rows, createRow()];
    }
  }

  function updateRow(index: number, field: FieldKey, value: string) {
    rows = rows.map((row, i) => {
      if (i !== index) return row;
      if (field === 'species') {
        return { ...row, species: value as Species | '' };
      }
      return { ...row, [field]: value };
    });
    ensureTrailingBlankRow();
  }

  function parseWeight(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100) / 100;
  }

  function rowToPatient(row: BatchRow): CPRLabelPatient | null {
    const weightKg = parseWeight(row.weight);
    if (!weightKg || !row.species) return null;
    return {
      name: row.name.trim(),
      species: row.species,
      weightKg,
    };
  }

  $: printablePatients = rows
    .map(rowToPatient)
    .filter((patient): patient is CPRLabelPatient => patient != null);

  $: canPrint = printablePatients.length > 0;

  function focusCell(rowIndex: number, fieldIndex: number) {
    const selector = `[data-row="${rowIndex}"][data-field="${fieldIndex}"]`;
    const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  }

  function handleKeyNav(event: KeyboardEvent, rowIndex: number, fieldIndex: number) {
    const key = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    const field = fieldOrder[fieldIndex];
    if (field === 'species' && (key === 'ArrowUp' || key === 'ArrowDown')) {
      return; // preserve native select behavior for species options
    }

    event.preventDefault();

    let nextRow = rowIndex;
    let nextField = fieldIndex;

    if (key === 'ArrowLeft') {
      nextField = fieldIndex - 1;
      if (nextField < 0) {
        nextField = fieldOrder.length - 1;
        nextRow = rowIndex - 1;
      }
    } else if (key === 'ArrowRight') {
      nextField = fieldIndex + 1;
      if (nextField >= fieldOrder.length) {
        nextField = 0;
        nextRow = rowIndex + 1;
      }
    } else if (key === 'ArrowUp') {
      nextRow = rowIndex - 1;
    } else if (key === 'ArrowDown') {
      nextRow = rowIndex + 1;
    }

    if (nextRow < 0 || nextRow >= rows.length) return;
    focusCell(nextRow, nextField);
  }

  function printAll() {
    if (!canPrint) return;

    const iframe = document.createElement('iframe');
    iframe.title = 'Batch CPR Labels Print';
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return;
    }

    const pages = printablePatients
      .map(patient => {
        const ctx = computeCprLabel(patient);
        const markup = renderCprLabelMarkup(ctx);
        return `<div class="label-page"><div class="label-sheet">${markup}</div></div>`;
      })
      .join('');

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>Batch CPR Labels</title>
<style>${CPR_LABEL_PRINT_STYLES}</style>
</head><body class="print-mode-batch">${pages}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
      }, 0);
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    setTimeout(() => {
      win.print();
      cleanup();
    }, 100);
  }
</script>

<section class="grid gap-4" aria-label="Batch CPR Labels">
  <header class="flex flex-col gap-1">
    <div class="text-sm font-black uppercase tracking-wide text-slate-100">Batch CPR Labels</div>
    <p class="m-0 text-xs text-slate-400">
      Enter patient details row by row. A fresh row appears automatically so you can stay on the keyboard.
    </p>
  </header>

  <div class="ui-card grid gap-4 p-4">
    <div class="grid gap-2">
      <div class="grid grid-cols-[2fr_1fr_1fr] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span>Patient Name</span>
        <span>Species</span>
        <span>Weight (kg)</span>
      </div>

      <div class="grid gap-2">
        {#each rows as row, index (row.id)}
          <div class="grid grid-cols-[2fr_1fr_1fr] items-center gap-3">
            <input
              class="field-control"
              type="text"
              placeholder="Patient name"
              autocomplete="off"
              spellcheck={false}
              data-row={index}
              data-field={0}
              value={row.name}
              on:input={(event) => updateRow(index, 'name', event.currentTarget.value)}
              on:keydown={(event) => handleKeyNav(event, index, 0)}
            />

            <select
              class="field-select"
              data-row={index}
              data-field={1}
              value={row.species}
              on:change={(event) => updateRow(index, 'species', event.currentTarget.value)}
              on:keydown={(event) => handleKeyNav(event, index, 1)}
            >
              <option value="">Species</option>
              {#each speciesOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>

            <input
              class="field-control"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              placeholder="0.0"
              data-row={index}
              data-field={2}
              value={row.weight}
              on:input={(event) => updateRow(index, 'weight', event.currentTarget.value)}
              on:keydown={(event) => handleKeyNav(event, index, 2)}
            />
          </div>
        {/each}
      </div>
    </div>

    <div class="text-center">
      <button class="ui-button px-4 py-2 font-bold uppercase tracking-wide" on:click={printAll} disabled={!canPrint}>
        Print All Labels ({printablePatients.length})
      </button>
    </div>
  </div>
</section>
