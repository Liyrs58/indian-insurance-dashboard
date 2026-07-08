# Session Memory — 08 July 2026

## What We Built

### Insurance Dashboard (Bloomberg Terminal Style)
- `index.html` — Main dashboard page (Bloomberg terminal UI: IBM Plex Mono, amber/navy, CRT scanline)
- `css/bloomberg.css` — Dark theme Bloomberg-style CSS (IBM Plex Mono, amber(#ff9900)/navy(#07080a) palette)
- `js/dashboard.js` — All dashboard logic (LightweightCharts, Tabulator.js, command bar, keyboard shortcuts)
- `data/irdai-processed.json` — Parsed IRDAI data from Excel files (monthly insurer-level premiums, market shares, YoY growth)
- `data/irdai-excel/` — 9 raw IRDAI Excel files (Non-Life Dec 2025, Jan-Mar 2026, May 2026; Life Jan-Mar 2026, May 2026)
- `data/parse_irdai.py` — Python script to parse Excel files into processed JSON
- `agents/multi_agent_system.py` — 3-agent crew (Ravi/Data Scientist, Priya/Strategist, Arjun/Writer)
- **Terminal Features:**
  - Top nav bar with keyboard shortcuts (`1`, `2`, `3`, `4`, F1-F4)
  - Scrolling ticker tape with animated prices
  - KPI strip (Total Market, Life, Non-Life, Penetration, Density, Players)
  - Tabulator.js table (sortable, searchable, row click → detail popup with company profile)
  - Panel tabs: TABLE | CONCENTRATION | MOVERS (lazy-rendered HHI + gainers/losers)
  - Interactive trend chart (TradingView LightweightCharts: area series, crosshair, multi-series compare view)
  - Filter buttons: ALL / LIFE / NON-LIFE + EMA overlay toggle
  - Bottom panel tabs: INSIGHTS | TOP PLAYERS | PENETRATION
  - Command bar (`help`, `1-4`, `search <name>`, `Ctrl+R`, `Esc`)
  - Company enrichment DB: 31 insurers profiled (group, founded, ticker, rating, specialties, description)
  - CRT scanline overlay + blinking status dot
- **Status:** Live at http://localhost:8080

### Insurance Terminal Integration (Next.js Bloomberg Clone)
- `insurance-terminal/components/bloomberg/views/insurance-view.tsx` — IRDAI insurance view (KPI strip, tabbed overview/life/non-life, tables, trend charts)
- `insurance-terminal/public/data/irdai-processed.json` — Data file for terminal
- Navigation: `I` key or `INSR` button
- View subtitle: "IRDAI · INDIAN INSURANCE"
- Build passes, dev server runs on port 3000

### Multi-Agent System (CrewAI-Style)
- `agents/multi_agent_system.py` — 3-agent crew (Data Scientist → Strategy Consultant → Report Writer)
- Runs on OpenRouter (GPT-4o-mini)
- Generates executive briefs from IRDAI data
- Fallback to local analysis mode when no API key available
- `data/analysis_summary.md` — Generated market summary

### Paytm Growth Management Intern — Application Materials
- `output/paytm-growth-cv.pdf` — Tailored CV (1 page, 196 KB)
- `output/paytm-growth-management-intern-insur-cover.pdf` — Cover letter (1 page, 63 KB)
- Report: `reports/002-paytm-growth-management-intern-2026-07-08.md`
- Score: 3.0/5 — Decent fallback, Noida home-city

## Deployment
- **GitHub Repo:** `github.com/Liyrs58/indian-insurance-dashboard` (public)
- **GitHub Pages:** `https://liyrs58.github.io/indian-insurance-dashboard/`
- **GitHub Actions:** `.github/workflows/deploy.yml` — Auto-deploys on push to main

## Bugs Fixed (Jul 8)
1. **HHI/Concentration tab** — Now populated with Life HHI (3858.9 = HIGHLY CONCENTRATED), Non-Life HHI (656.2 = COMPETITIVE), top 5 contributors by market share, per-insurer squared share
2. **Movers tab** — Shows top 5 fastest-growing (Narayana Health +1665%, Galaxy Health +320%) and bottom 5 fastest-shrinking (AIC -421%, Kshema -95%)
3. **Resize listener duplicate** — Changed to single `resizeHandler` var with `removeEventListener` before re-adding
4. **Chart series leak** — Changed `chartSeries` from single var to `chartSeries[]` array; all series (including compare view's 2-series) tracked and removed on cleanup
5. **chartType not synced** — `renderView()` now maps view→chartType and syncs active filter button class; `renderedTabs = {}` reset on view switch for fresh lazy render
6. **Company enrichment** — `COMPANY_DB` with 31 insurers (group, founded, ticker, rating, specialties, desc); fuzzy `lookupCompany()`; row click → enriched popup

## Bug Fixes & Enhancements (Jul 8)
1. **HHI/Concentration tab** — Life HHI 3858.9 (HIGHLY CONCENTRATED), Non-Life HHI 656.2 (COMPETITIVE), top 5 contributors
2. **Movers tab** — Top 5 gainers, bottom 5 losers, segment colored
3. **Resize listener** — Single handler, `removeEventListener` before re-add
4. **Chart series leak** — `chartSeries[]` array, all series tracked and cleaned
5. **chartType sync** — View→chartType mapping, button state sync, tab reset
6. **Company enrichment** — 31 insurers in `COMPANY_DB`; fuzzy `lookupCompany()`; row click → enriched popup
7. **EMA toggle** — Button wired; calculates 3-period EMA on current data; toggles overlay line; resets on view switch
8. **Stock price integration** — `data/fetch_stocks.py` fetches 8 NSE prices via Yahoo Finance; `stock-prices.json` loaded at startup; displayed in popup and scrolling ticker
9. **GitHub Actions** — Deploy workflow now runs `fetch_stocks.py` (Python step) before uploading artifact

## Latest Enhancements (Jul 8)

| # | Feature | Detail |
|---|---------|--------|
| 1 | **Loading skeleton** | Animated pulse overlay on KPI, table, chart, insights while data loads |
| 2 | **Chart zoom/pan** | `handleScroll` + `handleScale` enabled on LightweightCharts; FIT button resets view |
| 3 | **Ticker interleaved** | Shows life (green) + non-life (cyan) insurers alternating, plus NSE stock prices (amber) |
| 4 | **Export CSV** | `export` command downloads visible table as CSV file |
| 5 | **Company logos** | Clearbit logo API in detail popup; 20 domains mapped, fallback for others |
| 6 | **HHI/Movers per-view** | Lazy-render tracked per view (`currentView + '-hhi'`) — no re-render on tab switch |
| 7 | **README fixed** | Matches actual stack (LightweightCharts, Tabulator, IBM Plex Mono, Clearbit) |

## Next Steps
- Run multi-agent analysis on latest data
- Evaluate Ogury Learning Internship (12 months)
