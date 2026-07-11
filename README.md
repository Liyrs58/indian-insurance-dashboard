# Indian Insurance Market Dashboard

Market-terminal dashboard for Indian insurance industry data.
Parses IRDAI Flash Figures, Life Council, and GIC source files into ranked
insurer tables, comparable-period views, trend charts, HHI concentration
analysis, and scheduled NSE stock snapshots for listed insurers.

**Live:** https://liyrs58.github.io/indian-insurance-dashboard/

## What This Demonstrates

| Area | What It Shows |
|------|---------------|
| **Data Engineering** | Python pipeline parses Excel/PDF source files → validated JSON with schema enforcement, duplicate detection, period-type labelling, and source-hygiene audit metadata |
| **Frontend Architecture** | Market-terminal grid layout, TradingView LightweightCharts, Tabulator tables, persistent watchlist monitor, keyboard-driven navigation, responsive down to 500px |
| **Data Refresh Integration** | NSE stock prices fetched every hour via GitHub Actions, auto-refreshed in-browser every 5 minutes |
| **Testing & Quality** | Node contract tests plus Playwright browser smoke coverage for data integrity, source quality, label leakage, interaction fixes, desktop layout, and mobile audit behavior |
| **CI/CD** | GitHub Actions → GitHub Pages: auto-deploy on push + hourly scheduled stock refresh |

## Preview

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Validation

```bash
npm test
npm run test:browser
node --check js/dashboard.js
python3 -m py_compile data/parse_irdai.py data/fetch_stocks.py
```

The parser stores source freshness, selected report months, validation issues,
source caveats, and parser hygiene decisions in `data/irdai-processed.json`
under `_meta`. The dashboard shows a snapshot status with validation tier
instead of a live-feed claim.

Watchlist selections are stored locally in `localStorage` under
`irdai_watchlist`. Use the star column or assistant commands such as
`watch LIC`, `unwatch LIC`, and `watchlist`.

Alert thresholds are stored locally in `localStorage` under
`irdai_alert_config`. Use assistant commands such as `alert config`, `set alert growth 12`,
`set alert share 0.75`, and `reset alerts` to tune watchlist severity rules
without editing code.

The assistant also supports command-line mnemonics for faster terminal-style
navigation. Press `Ctrl+K` to focus the command line and show available commands,
then use entries such as `TOPLIFE`, `TOPNL`, `TOPALL`, `MKT`, `FIND LIC`,
`WLIST`, `ALERTS`, `AUDIT`, `LINK`, `EXPORTCSV`, and `EXPORTAUDIT`. Recent commands are stored in
`localStorage` under `irdai_command_history` and can be recalled with
`ArrowUp` / `ArrowDown`.

Use `LINK` to generate a shareable workspace URL hash, including the active
view, selected month, and chart period, such as
`#view=nonlife&month=2026-06&period=3m`.

The primary terminal view keys are live: `F1` opens overview, `F2` opens life,
`F3` opens non-life, and `F4` opens segment comparison. Number keys `1`-`4`
remain available as fallback shortcuts.

Saved view presets are stored locally in `localStorage` under
`irdai_saved_views`. Use commands such as `save view nonlife desk`, `load view
nonlife desk`, `views`, and `delete view nonlife desk`.

Use `export audit` in the assistant to download a Markdown audit pack covering
snapshot metadata, validation status, source hygiene, active scope, and local
watchlist alerts.

## Data Pipeline

```bash
python3 -m pip install -r data/requirements.txt
python3 data/parse_irdai.py
python3 data/fetch_stocks.py
```

Headline market totals use the latest shared life/non-life month only. Segment
pages can show newer segment-specific data, such as June 2026 non-life figures,
when a matching life report is not yet available locally.

## Data Sources
- General Insurance Council flash figures
- IRDAI monthly business figures archive
- Life Insurance Council new business performance archive
- IRDAI handbook and public sector statistics
- Yahoo Finance-compatible NSE stock quote endpoints

## Stack
- HTML/CSS market-terminal UI
- [TradingView LightweightCharts](https://tradingview.github.io/lightweight-charts/) — Interactive area/line charts
- [Tabulator](https://tabulator.info/) — Sortable/filterable data tables
- IBM Plex Mono — Monospaced UI font
- Clearbit Logo API — Company logos in detail popups
- Python (parse_irdai.py, fetch_stocks.py) — Data pipeline
- GitHub Actions — Scheduled hourly stock refresh + auto-deploy to GitHub Pages
