#!/usr/bin/env python3
import pandas as pd
import openpyxl
import json
from datetime import datetime
import os
import re

# Hindi to English mapping for non-life insurers
NON_LIFE_NAMES = {
    'एको जनरल इंश्योरेंस लिमिटेड': 'Acko General Insurance',
    'बजाज जनरल इंश्योरेंस लिमिटेड': 'Bajaj Allianz General Insurance',
    'बजाज एलियांज जनरल इंश्योरेंस लिमिटेड': 'Bajaj Allianz General Insurance',
    'चोलमांडलम एमएस जनरल इंश्योरेंस कंपनी लिमिटेड': 'Cholamandalam MS General Insurance',
    'जनरली सेंट्रल इंश्योरेंस कंपनी लिमिटेड': 'General Central Insurance',
    'गो डिजिट जनरल इंश्योरेंस लिमिटेड': 'Go Digit General Insurance',
    'एचडीएफसी एर्गो जनरल इंश्योरेंस कंपनी लिमिटेड': 'HDFC ERGO General Insurance',
    'आईसीआईसीआई लोम्बार्ड जनरल इंश्योरेंस कंपनी लिमिटेड': 'ICICI Lombard General Insurance',
    'इफको-टोकियो जनरल इंश्योरेंस कंपनी लिमिटेड': 'IFFCO-Tokio General Insurance',
    'क्षेमा जनरल इंश्योरेंस कंपनी लिमिटेड': 'Kshema General Insurance',
    'लिबर्टी जनरल इंश्योरेंस लिमिटेड': 'Liberty General Insurance',
    'मैग्मा जनरल इंश्योरेंस लिमिटेड': 'Magma General Insurance',
    'नेशनल इंश्योरेंस कंपनी लिमिटेड': 'National Insurance Company',
    'नवी जनरल इंश्योरेंस लिमिटेड': 'Navi General Insurance',
    'रहेजा क्यूबीई जनरल इंश्योरेंस कंपनी लिमिटेड': 'Raheja QBE General Insurance',
    'इंडसइंड जनरल इंश्योरेंस कंपनी लिमिटेड': 'IndusInd General Insurance',
    'रॉयल सुंदरम जनरल इंश्योरेंस कंपनी लिमिटेड': 'Royal Sundaram General Insurance',
    'एसबीआई जनरल इंश्योरेंस कंपनी लिमिटेड': 'SBI General Insurance',
    'श्रीराम जनरल इंश्योरेंस कंपनी लिमिटेड': 'Shriram General Insurance',
    'टाटा एआईजी जनरल इंश्योरेंस कंपनी लिमिटेड': 'Tata AIG General Insurance',
    'न्यू इंडिया एश्योरेंस कंपनी लिमिटेड': 'New India Assurance',
    'ओरिएंटल इंश्योरेंस कंपनी लिमिटेड': 'Oriental Insurance',
    'यूनाइटेड इंडिया इंश्योरेंस कंपनी लिमिटेड': 'United India Insurance',
    'यूनिवर्सल सोपो जनरल इंश्योरेंस कंपनी लिमिटेड': 'Universal Sompo General Insurance',
    'जूनो जनरल इंश्योरेंस कंपनी लिमिटेड': 'Zuno General Insurance',
    'ज्यूरिक कोटक जनरल इंश्योरेंस कंपनी लिमिटेड': 'Zurich Kotak General Insurance',
    'आदित्य बिड़ला हेल्थ इंश्योरेंस कंपनी लिमिटेड': 'Aditya Birla Health Insurance',
    'केयर हेल्थ इंश्योरेंस लिमिटेड': 'Care Health Insurance',
    'मनीपालसिग्ना हेल्थ इंश्योरेंस कंपनी लिमिटेड': 'ManipalCigna Health Insurance',
    'निवा बूपा हेल्थ इंश्योरेंस कंपनी लिमिटेड': 'Niva Bupa Health Insurance',
    'रिलायंस हेल्थ इंश्योरेंस लिमिटेड*': 'Reliance Health Insurance',
    'स्टार हेल्थ & एलाइड इंश्योरेंस कंपनी लिमिटेड': 'Star Health & Allied Insurance',
    'नारायणा हेल्थ इंश्योरेंस लिमिटेड': 'Narayana Health Insurance',
    'गैलेक्सी हेल्थ इंश्योरेंस कंपनी लिमिटेड': 'Galaxy Health Insurance',
    'एग्रीकल्चर इंश्योरेंस कम्पनी ऑफ इंडिया लिमिटेड': 'Agriculture Insurance Company of India',
    'ईसीजीसी लिमिटेड': 'ECGC Limited',
    # Additional mappings for names found in the data
    'रिलायंस जनरल इंश्योरेंस कंपनी लिमिटेड': 'Reliance General Insurance',
    'यूनिवर्सल सोम्पो जनरल इंश्योरेंस कंपनी लिमिटेड': 'Universal Sompo General Insurance',
    'एमजीआईजी जनरल इंश्योरेंस कंपनी लिमिटेड': 'Magma General Insurance',
    'एनआईसी लिमिटेड': 'National Insurance Company',
    'यूआईजी लिमिटेड': 'United India Insurance',
    'ओआईसी लिमिटेड': 'Oriental Insurance',
    'न्यू इंडिया एश्योरेंस कंपनी लिमिटेड': 'New India Assurance',
    'निवा बूपा हेल्थ इंश्योरेंस कंपनी लिमिटेड': 'Niva Bupa Health Insurance',
    'एचडीएफसी एर्गो जनरल इंश्योरेंस कंपनी लिमिटेड': 'HDFC ERGO General Insurance',
    'स्टार हेल्थ एंड एलाइड इंश्योरेंस कंपनी लिमिटेड': 'Star Health & Allied Insurance',
    # More variations found in actual data
    'बजाज एलियांज जनरल इंश्योरेंस कंपनी लिमिटेड': 'Bajaj Allianz General Insurance',
    'रिलायंस जनरल इंश्योरेंस': 'Reliance General Insurance',
    'बजाज एलियांज जनरल इंश्योरेंस': 'Bajaj Allianz General Insurance',
    'नारायना हेल्थ इंश्योरेंस लिमिटेड': 'Narayana Health Insurance',
}

# Hindi to English mapping for life insurers
LIFE_NAMES = {
    'एको लाइफ इंश्योरेंस लिमिटेड': 'Acko Life Insurance',
    'आदित्य बिड़ला सन लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Aditya Birla Sun Life Insurance',
    'एजियास फेडरल लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Ageas Federal Life Insurance',
    'अवीवा लाइफ इंश्योरेंस कंपनी इंडिया लिमिटेड': 'Aviva Life Insurance',
    'बजाज आलियांज लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Bajaj Allianz Life Insurance',
    'बंधन लाइफ इंश्योरेंस लिमिटेड': 'Bandhan Life Insurance',
    '\nभारती एक्सा लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Bharti AXA Life Insurance',
    'भारती एक्सा लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Bharti AXA Life Insurance',
    'एचडीएफसी लाइफ इंश्योरेंस कंपनी लिमिटेड': 'HDFC Life Insurance',
    'आईसीआईसीआई प्रुडेंशियल लाइफ इंश्योरेंस कंपनी लिमिटेड': 'ICICI Prudential Life Insurance',
    'इंडियाफर्स्ट लाइफ इंश्योरेंस कंपनी लिमिटेड': 'IndiaFirst Life Insurance',
    'कोटक महिंद्रा लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Kotak Mahindra Life Insurance',
    'कोटक लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Kotak Life Insurance',
    'एलआईसी (भारतीय जीवन बीमा निगम)': 'LIC',
    'भारतीय जीवन बीमा निगम': 'LIC',
    'एक्सिस मैक्स लाइफ इंश्योरेंस लिमिटेड': 'Max Life Insurance',
    'मैक्स लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Max Life Insurance',
    'एमपीएल लाइफ इंश्योरेंस कंपनी लिमिटेड': 'MPL Life Insurance',
    'पीएनबी मेटलाइफ इंडिया इंश्योरेंस कंपनी लिमिटेड': 'PNB MetLife India Insurance',
    'पीएनबी मेटलाइफ इंश्योरेंस कंपनी लिमिटेड': 'PNB MetLife Insurance',
    'प्राइम एशिया लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Prime Asia Life Insurance',
    'प्रामेरिका लाइफ इंश्योरेंस लिमिटेड': 'Pramerica Life Insurance',
    'इंडसइंड निप्पॉन लाइफ इंश्योरेंस कंपनी लिमिटेड': 'IndusInd Nippon Life Insurance',
    'सहारा लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Sahara Life Insurance',
    'एसबीआई लाइफ इंश्योरेंस कंपनी लिमिटेड': 'SBI Life Insurance',
    'श्रीराम लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Shriram Life Insurance',
    'स्टार यूनियन दाई-इची लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Star Union Dai-ichi Life Insurance',
    'टाटा एआईए लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Tata AIA Life Insurance',
    'फ्यूचर जनरली इंडिया लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Future Generali India Life Insurance',
    'रिलायंस निप्पॉन लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Reliance Nippon Life Insurance',
    # Additional mappings for names found in actual data
    'केनरा एचएसबीसी लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Canara HSBC Life Insurance',
    'क्रेडिटएक्सेस लाइफ इंश्योरेंस लिमिटेड': 'CreditAccess Life Insurance',
    'एडलवाइस लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Edelweiss Life Insurance',
    'जनरली सेंट्रल लाइफ इंश्योरेंस कंपनी लिमिटेड': 'Generali Central Life Insurance',
    'गो डिजिट लाइफ इंश्योरेंस लिमिटेड': 'Go Digit Life Insurance',
    'आईसीआईसीआई प्रूडेंशियल लाइफ इंश्योरेंस कंपनी लिमिटेड': 'ICICI Prudential Life Insurance',
}

def parse_month_from_filename(filename):
    """Extract month from filename like NonLife_GDP_March2026.xlsx"""
    month_map = {
        'january': '01', 'jan': '01',
        'february': '02', 'feb': '02',
        'march': '03', 'mar': '03',
        'april': '04', 'apr': '04',
        'may': '05',
        'june': '06', 'jun': '06',
        'july': '07', 'jul': '07',
        'august': '08', 'aug': '08',
        'september': '09', 'sep': '09',
        'october': '10', 'oct': '10',
        'november': '11', 'nov': '11',
        'december': '12', 'dec': '12'
    }
    
    # Try to find month and year in filename
    filename_lower = filename.lower()
    
    for month_name, month_num in month_map.items():
        if month_name in filename_lower:
            # Find year (4 digits)
            year_match = re.search(r'(\d{4})', filename)
            if year_match:
                return f"{year_match.group(1)}-{month_num}"
    
    return None

def safe_float(value, default=0):
    """Safely convert a value to float"""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Try to extract number from string
        try:
            # Remove commas and spaces
            cleaned = value.replace(',', '').replace(' ', '')
            if cleaned:
                return float(cleaned)
        except:
            pass
    return default

def parse_non_life_excel(filepath, filename):
    """Parse non-life Excel file and extract insurer data"""
    wb = openpyxl.load_workbook(filepath, read_only=True)
    ws = wb[wb.sheetnames[0]]
    
    month = parse_month_from_filename(filename)
    if not month:
        print(f"Warning: Could not parse month from {filename}")
        return None
    
    insurers = []
    total_premium_cr = 0
    total_growth_pct = 0
    
    for i, row in enumerate(ws.iter_rows(max_row=100, values_only=True)):
        # Data rows start from row 12 (index 11)
        if i >= 11:
            # Check if it's a data row (has serial number in column A)
            serial = row[0]
            if serial and isinstance(serial, (int, float)) and serial > 0:
                hindi_name = str(row[1]).strip() if row[1] else ''
                # Remove any leading/trailing whitespace and newlines
                hindi_name = re.sub(r'\s+', ' ', hindi_name).strip()
                
                # Get premium values with safe conversion
                cumulative_2025_26 = safe_float(row[4])
                cumulative_2024_25 = safe_float(row[5])
                
                # Calculate growth
                if cumulative_2024_25 > 0:
                    growth_pct = ((cumulative_2025_26 - cumulative_2024_25) / cumulative_2024_25) * 100
                else:
                    growth_pct = 0
                
                # Map to English name
                english_name = translate_hindi_name(hindi_name, NON_LIFE_NAMES)
                
                # Clean up the name
                english_name = english_name.replace('लिमिटेड', 'Limited').replace('कंपनी', 'Company')
                
                insurers.append({
                    'name': english_name,
                    'premium_cr': round(cumulative_2025_26, 2),
                    'market_share_pct': 0,  # Will be calculated later
                    'yoy_growth_pct': round(growth_pct, 2)
                })
                
                total_premium_cr += cumulative_2025_26
        
        # Stop at total row
        if row[1] and 'कुल योग' in str(row[1]):
            break
    
    # Calculate market shares
    if total_premium_cr > 0:
        for insurer in insurers:
            insurer['market_share_pct'] = round((insurer['premium_cr'] / total_premium_cr) * 100, 2)
    
    # Calculate total growth as weighted average of individual growth rates
    if total_premium_cr > 0 and insurers:
        total_growth = sum(i['premium_cr'] * i['yoy_growth_pct'] for i in insurers)
        total_growth_pct = total_growth / total_premium_cr
    
    wb.close()
    
    return {
        'month': month,
        'insurers': insurers,
        'total_premium_cr': round(total_premium_cr, 2),
        'total_growth_pct': round(total_growth_pct, 2)
    }

def translate_hindi_name(hindi_name, name_mapping):
    """Try to translate Hindi name to English using partial matching"""
    # First try exact match
    if hindi_name in name_mapping:
        return name_mapping[hindi_name]
    
    # Try partial matching
    for hindi, english in name_mapping.items():
        # Check if the key contains the input or vice versa
        if hindi in hindi_name or hindi_name in hindi:
            return english
    
    # Try to match by common insurance company name patterns
    common_patterns = {
        'एलआईसी': 'LIC',
        'लिमिटेड': 'Limited',
        'कंपनी': 'Company',
        'इंश्योरेंस': 'Insurance',
        'लाइफ': 'Life',
    }
    
    # Return the original name if no translation found
    return hindi_name

def parse_life_excel(filepath, filename):
    """Parse life Excel file and extract insurer data"""
    wb = openpyxl.load_workbook(filepath, read_only=True)
    ws = wb[wb.sheetnames[0]]
    
    month = parse_month_from_filename(filename)
    if not month:
        print(f"Warning: Could not parse month from {filename}")
        return None
    
    insurers = []
    total_premium_cr = 0
    total_growth_pct = 0
    
    # Life insurance data rows are every 7 rows (main row + 6 sub-rows for premium types)
    # Main rows are at: 4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95, 102, 109, 116, 123, 130, 137, 144, 151, 158, 165, 179
    main_rows = [4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95, 102, 109, 116, 123, 130, 137, 144, 151, 158, 165, 179]
    
    for i, row in enumerate(ws.iter_rows(max_row=200, values_only=True), 1):
        # Only process main data rows
        if i not in main_rows:
            continue
        
        # Data rows have serial number in column A
        serial = row[0]
        if serial and isinstance(serial, (int, float)) and serial > 0:
            hindi_name = str(row[1]).strip() if row[1] else ''
            hindi_name = re.sub(r'\s+', ' ', hindi_name).strip()
            
            # For life insurance:
            # Column C (index 2): March 2025 monthly premium
            # Column D (index 3): March 2026 monthly premium
            # Column E (index 4): Growth rate %
            # Column F (index 5): March 2025 cumulative premium
            # Column G (index 6): March 2026 cumulative premium
            # Column H (index 7): Growth rate %
            # Column I (index 8): Market share %
            
            premium_cumulative_2026 = safe_float(row[6])  # Column G
            premium_cumulative_2025 = safe_float(row[5])  # Column F
            market_share = safe_float(row[8])  # Column I
            
            # Calculate YoY growth
            if premium_cumulative_2025 > 0:
                growth_pct = ((premium_cumulative_2026 - premium_cumulative_2025) / premium_cumulative_2025) * 100
            else:
                growth_pct = 0
            
            # Map to English name
            english_name = translate_hindi_name(hindi_name, LIFE_NAMES)
            
            # Clean up the name
            english_name = english_name.replace('लिमिटेड', 'Limited').replace('कंपनी', 'Company')
            
            # Market share in Excel is already in percentage format
            # (e.g., 2.74 means 2.74%, not 0.0274)
            market_share_pct = round(market_share, 2)
            
            # Only add if premium is > 0 (skip rows with 0 premium)
            if premium_cumulative_2026 > 0:
                insurers.append({
                    'name': english_name,
                    'premium_cr': round(premium_cumulative_2026, 2),
                    'market_share_pct': market_share_pct,
                    'yoy_growth_pct': round(growth_pct, 2)
                })
                
                total_premium_cr += premium_cumulative_2026
    
    # Calculate total growth
    if total_premium_cr > 0 and len(insurers) > 0:
        # Sum all growth rates weighted by premium
        total_growth = sum(i['premium_cr'] * i['yoy_growth_pct'] for i in insurers)
        total_growth_pct = total_growth / total_premium_cr if total_premium_cr > 0 else 0
    
    wb.close()
    
    return {
        'month': month,
        'insurers': insurers,
        'total_premium_cr': round(total_premium_cr, 2),
        'total_growth_pct': round(total_growth_pct, 2)
    }

def main():
    data_dir = '/Users/rudra/Documents/New OpenCode Project/insurance-dashboard/data/irdai-excel'
    output_file = '/Users/rudra/Documents/New OpenCode Project/insurance-dashboard/data/irdai-processed.json'
    existing_file = '/Users/rudra/Documents/New OpenCode Project/insurance-dashboard/data/irdai-data.json'
    
    # Read existing data if available
    existing_data = {}
    if os.path.exists(existing_file):
        with open(existing_file, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    
    non_life_data = []
    life_data = []
    
    # Process all Excel files
    for filename in os.listdir(data_dir):
        if filename.endswith('.xlsx'):
            filepath = os.path.join(data_dir, filename)
            print(f"Processing: {filename}")
            
            if 'NonLife' in filename:
                data = parse_non_life_excel(filepath, filename)
                if data:
                    non_life_data.append(data)
                    print(f"  Found {len(data['insurers'])} insurers, Total: {data['total_premium_cr']} Cr")
            elif 'Life' in filename:
                data = parse_life_excel(filepath, filename)
                if data:
                    life_data.append(data)
                    print(f"  Found {len(data['insurers'])} insurers, Total: {data['total_premium_cr']} Cr")
    
    # Sort by month
    non_life_data.sort(key=lambda x: x['month'])
    life_data.sort(key=lambda x: x['month'])
    
    # Get all available months
    all_months = sorted(set([d['month'] for d in non_life_data] + [d['month'] for d in life_data]))
    
    # Calculate summary from latest data
    latest_non_life = non_life_data[-1] if non_life_data else None
    latest_life = life_data[-1] if life_data else None
    
    total_market_premium = 0
    life_premium = 0
    non_life_premium = 0
    
    if latest_non_life:
        non_life_premium = latest_non_life['total_premium_cr']
    if latest_life:
        life_premium = latest_life['total_premium_cr']
    
    total_market_premium = life_premium + non_life_premium
    
    # Create output JSON
    output_data = {
        "_meta": {
            "source": "IRDAI Flash Figures",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "months_available": all_months,
            "notes": "Data extracted from IRDAI flash figures Excel files"
        },
        "non_life": {
            "monthly_data": non_life_data
        },
        "life": {
            "monthly_data": life_data
        },
        "summary": {
            "total_market_premium_cr": round(total_market_premium, 2),
            "life_premium_cr": round(life_premium, 2),
            "non_life_premium_cr": round(non_life_premium, 2),
            "insurance_penetration_pct": existing_data.get('market_overview', {}).get('insurance_penetration', {}).get('value', 3.7),
            "insurance_density_usd": existing_data.get('market_overview', {}).get('insurance_density', {}).get('value', 92),
            "global_penetration_avg_pct": 7.0
        }
    }
    
    # Merge with existing data if available
    if existing_data:
        # Keep existing data that's not in the new file
        for key in existing_data:
            if key not in output_data:
                output_data[key] = existing_data[key]
    
    # Write output JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\nData saved to: {output_file}")
    print(f"Total non-life insurers: {len(latest_non_life['insurers']) if latest_non_life else 0}")
    print(f"Total life insurers: {len(latest_life['insurers']) if latest_life else 0}")
    print(f"Total market premium: {total_market_premium:.2f} Cr")

if __name__ == '__main__':
    main()
