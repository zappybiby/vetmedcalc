<script lang="ts">
  import { onMount } from 'svelte';
  import logoDark from '../../assets/branding/vetmedcalc-logo-dark.svg';
  import logoLight from '../../assets/branding/vetmedcalc-logo-light.svg';

  function getLogoSeason(date: Date) {
    const month = date.getMonth() + 1;
    if (month === 12) return 'christmas';
    if (month === 11 && date.getDate() >= 17) return 'thanksgiving';
    return 'regular';
  }

  let season = getLogoSeason(new Date());

  onMount(() => {
    let timer: number;

    function updateAtLocalMidnight() {
      const now = new Date();
      season = getLogoSeason(now);

      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(updateAtLocalMidnight, midnight.getTime() - now.getTime());
    }

    updateAtLocalMidnight();
    return () => window.clearTimeout(timer);
  });
</script>

<svg
  class="brand-logo"
  width="1208"
  height="356"
  viewBox="0 0 1208 356"
  role="img"
  aria-label="Brian's VetMedCalc"
  data-season={season}
>
  <image class="brand-logo-dark" href={logoDark} width="1208" height="356" />
  <image class="brand-logo-light" href={logoLight} width="1208" height="356" />

  {#if season === 'thanksgiving'}
    <defs>
      <path
        id="brand-maple-leaf"
        d="M-3-27h6v8h5v8l12-7v8l7-2v6l-8 10h6v5l-14 7H3v11h-6V16h-8L-25 9V4h6l-8-10v-6l7 2v-8l12 7v-8h5Z"
      />
      <g id="brand-pointed-leaf">
        <path d="M10-26l3 7 5 2 2 7 4 4-2 9-6 8-7 4H3l-6 10-6-3 5-10h-7l-7-5-3-8 3-8 7-6 7-3Z" />
        <path d="M-4 12 9-17M2-1l-9-5" fill="none" stroke-opacity=".65" />
      </g>
    </defs>
    <g stroke="#713d2f" stroke-width="3" stroke-linejoin="round">
      <use href="#brand-pointed-leaf" transform="translate(534 123) rotate(-40)" fill="#e67c48" />
      <use href="#brand-maple-leaf" transform="translate(678 77) rotate(18)" fill="#f0ad45" />
      <use href="#brand-maple-leaf" transform="translate(1042 90) rotate(-20)" fill="#d76356" />
      <use href="#brand-pointed-leaf" transform="translate(1148 132) rotate(35)" fill="#f0ad45" />
    </g>

    <g transform="translate(805 -11) scale(6) rotate(-6 11 10)">
      <path fill="#778293" d="M6 0h9v1h1v3h1v4h3v1h1v3H1v-1H0V9h1V8h3V4h1V1h1Z" />
      <path fill="#252634" d="M6 1h9v3h1v5h4v2H1V9h4V4h1Z" />
      <path fill="#444657" d="M6 1h8v1H7v4H6Z" />
      <path fill="#8d5840" d="M5 6h11v3H5Z" />
      <path fill="#ffc565" fill-rule="evenodd" d="M9 5h5v5H9Zm1.5 1.5v2h2v-2Z" />
    </g>
  {:else if season === 'christmas'}
    <defs>
      <path
        id="brand-snowflake"
        d="M0-24v48M-24 0h48M-7-21l7 7 7-7M-7 21l7-7 7 7M-21-7l7 7-7 7M21-7l-7 7 7 7"
      />
      <path id="brand-small-snowflake" d="M0-15v30M-15 0h30M-8-8 8 8M8-8-8 8" />
    </defs>
    <g class="snowflakes" fill="none" stroke-width="6" stroke-linecap="square" stroke-linejoin="round">
      <use href="#brand-small-snowflake" x="534" y="123" />
      <use href="#brand-snowflake" x="678" y="77" />
      <use href="#brand-snowflake" x="1042" y="90" />
      <use href="#brand-small-snowflake" x="1148" y="132" />
    </g>

    <g transform="translate(790 -43) scale(7) rotate(-7 12 13)">
      <path fill="#812936" d="M7 2h6v1h2v1h2v2h1v2h1v4H5V9h1V6H5v1H4v3H0V7h1V5h1V4h2V3h3Z" />
      <path fill="#d83d4c" d="M7 3h6v1h2v1h1v2h1v3H6V8h1V6H5v1H3v2H1V7h1V5h2V4h3Z" />
      <path fill="#f36266" d="M7 3h5v1H8v1H5v1H3V5h1V4h3Z" />
      <path fill="#7e879c" d="M6 10h12v1h1v3h-1v1H6v-1H5v-3h1ZM0 8h3v1h1v3H3v1H0v-1h-1V9h1Z" />
      <path fill="#f8faff" d="M6 11h12v3H6ZM0 9h3v3H0Z" />
    </g>
  {:else}
    <path
      class="emphasis"
      d="M992.5,76.32C984.87,75.65 984,75.21 984,71.98L984,69 987.94,69.00C990.11,69 992.16,68.55 992.5,68.00C993.5,66.38 1000.7,66.78 1001.36,68.50C1001.72,69.44 1003.25,70 1005.47,70.00L1009,70 1009,73.50L1009,77 1002.75,76.83C999.31,76.74 994.7,76.51 992.5,76.32ZM972.67,55.33C971.28,53.94 972.03,49.81 973.75,49.34C974.71,49.08 976.62,47.34 978,45.46C979.38,43.59 980.86,42.04 981.29,42.03C981.72,42.01 983.77,40.16 985.85,37.92L989.61,33.84 993.06,34.17L996.5,34.5 996.81,37.76C997.03,40.04 996.64,41.2 995.52,41.63C994.63,41.97 992.14,43.99 989.99,46.13C987.84,48.26 985.61,50 985.04,50.00C984.47,50 984,50.67 984,51.50C984,52.33 983.31,53 982.47,53.00C981.63,53 980.68,53.67 980.36,54.50C979.78,56.01 973.98,56.64 972.67,55.33ZM952.36,39.49C951.71,37.79 952.75,29.56 953.94,27.10C954.36,26.22 955.55,23.75 956.59,21.61C957.62,19.47 958.48,17.04 958.48,16.22C958.51,13.99 961.34,12.62 964.35,13.37L967,14.04 967,17.90C967,20.11 966.36,22.29 965.5,23.00C964.67,23.68 964,24.75 964,25.38C964,26 962.42,29.77 960.48,33.75C957.85,39.19 956.47,41 954.95,41.00C953.84,41 952.68,40.32 952.36,39.49Z"
      fill-rule="evenodd"
    />
  {/if}
</svg>

<style>
  .brand-logo {
    overflow: visible;
  }

  .emphasis {
    fill: #38bdf8;
  }

  .snowflakes {
    stroke: #a0ddf7;
  }

  :global(:root[data-theme='light']) .emphasis {
    fill: #007dba;
  }

  :global(:root[data-theme='light']) .snowflakes {
    stroke: #4284ad;
  }
</style>
