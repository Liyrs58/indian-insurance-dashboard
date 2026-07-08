#!/usr/bin/env python3
"""Fetch stock prices from Yahoo Finance for listed insurers."""
import json, requests, time, os

TICKERS = [
    'HDFCLIFE.NS', 'ICICIPRULI.NS', 'SBILIFE.NS', 'ICICIGI.NS',
    'NIACL.NS', 'STARHEALTH.NS', 'BAJAJFINSV.NS', 'DIGIT.NS',
    'KOTAKBANK.NS',
]

YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/{t}?range=1d&interval=1d'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}

def fetch_price(ticker):
    try:
        url = YAHOO_URL.format(t=ticker)
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None, f'HTTP {r.status_code}'
        d = r.json()
        meta = d.get('chart', {}).get('result', [{}])[0].get('meta', {})
        price = meta.get('regularMarketPrice')
        currency = meta.get('currency', 'INR')
        exchange = meta.get('exchangeName', '')
        return {
            'price': price,
            'currency': currency,
            'exchange': exchange,
        }, None
    except Exception as e:
        return None, str(e)

def main():
    output_path = os.path.join(os.path.dirname(__file__), 'stock-prices.json')
    results = {}
    for t in TICKERS:
        data, err = fetch_price(t)
        if data:
            results[t] = data
            print(f'  {t}: {data["price"]} {data["currency"]}')
        else:
            print(f'  {t}: ERROR {err}')
        time.sleep(0.5)
    with open(output_path, 'w') as f:
        json.dump({'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'prices': results}, f, indent=2)
    print(f'\nSaved {len(results)} prices to {output_path}')

if __name__ == '__main__':
    main()
