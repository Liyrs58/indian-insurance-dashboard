# Indian Insurance Market Dashboard

Bloomberg-terminal style dashboard for Indian insurance industry data.
Pulls monthly IRDAI flash figures, renders interactive terminal UI with
sorted tables, trend charts, concentration analysis, and live NSE stock prices.

**Live:** https://liyrs58.github.io/indian-insurance-dashboard/

## Preview

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Data Sources
- IRDAI Monthly Flash Figures (Life & Non-Life)
- IRDAI Handbook of Indian Insurance Statistics
- Company annual filings
- Yahoo Finance (NSE stock prices for listed insurers)

## Stack
- HTML/CSS (Bloomberg terminal theme with CRT scanline overlay)
- [TradingView LightweightCharts](https://tradingview.github.io/lightweight-charts/) — Interactive area/line charts
- [Tabulator](https://tabulator.info/) — Sortable/filterable data tables
- IBM Plex Mono — Monospaced UI font
- Clearbit Logo API — Company logos in detail popups
- Python (parse_irdai.py, fetch_stocks.py) — Data pipeline
- GitHub Actions — Auto-deploy to GitHub Pages
