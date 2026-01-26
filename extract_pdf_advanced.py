#!/usr/bin/env python3
"""
Advanced HS code extraction using pdfplumber
"""

import pdfplumber
import json
import re
from pathlib import Path
from collections import defaultdict

def extract_hs_codes_advanced(pdf_path):
    """Extract HS codes using pdfplumber for better table detection"""
    
    print(f"📄 Opening PDF with pdfplumber: {pdf_path}")
    
    hs_codes = []
    hs_codes_set = set()
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"📊 Total pages: {total_pages}")
            
            for page_num, page in enumerate(pdf.pages, 1):
                # Try to extract tables first
                try:
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            for row in table:
                                # Check if first column is 8-digit code
                                if row and len(row) > 0:
                                    cell = str(row[0]).strip() if row[0] else ""
                                    if re.match(r'^\d{8}$', cell):
                                        code = cell
                                        # Combine remaining columns as description
                                        desc_parts = []
                                        for col in row[1:]:
                                            if col:
                                                desc_parts.append(str(col).strip())
                                        
                                        description = ' '.join(desc_parts)
                                        
                                        if code not in hs_codes_set and len(description) > 0:
                                            hs_codes_set.add(code)
                                            
                                            # Extract keywords
                                            words = description.split()
                                            keywords = []
                                            for w in words:
                                                if len(w) > 3 and w.lower() not in ['the', 'and', 'with', 'from', 'other']:
                                                    keywords.append(w)
                                            keywords = keywords[:7]
                                            
                                            hs_codes.append({
                                                "code": code,
                                                "description": description[:300],
                                                "keywords": keywords
                                            })
                except:
                    pass
                
                # Also try text extraction
                text = page.extract_text()
                if text:
                    # Find 8-digit patterns in text
                    pattern = r'^(\d{8})\s+(.+?)$'
                    for match in re.finditer(pattern, text, re.MULTILINE):
                        code = match.group(1)
                        description = match.group(2).strip()
                        
                        # Clean description
                        description = ' '.join(description.split())
                        
                        if code not in hs_codes_set and len(description) > 3:
                            hs_codes_set.add(code)
                            
                            words = description.split()
                            keywords = []
                            for w in words:
                                if len(w) > 3 and w.lower() not in ['the', 'and', 'with', 'from', 'other']:
                                    keywords.append(w)
                            keywords = keywords[:7]
                            
                            hs_codes.append({
                                "code": code,
                                "description": description[:300],
                                "keywords": keywords
                            })
                
                if page_num % 50 == 0:
                    print(f"  Page {page_num}/{total_pages} - Found {len(hs_codes)} codes so far...")
            
            print(f"✅ PDF processing complete")
    
    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return None
    
    return hs_codes

def main():
    workspace_dir = Path(r"c:\Users\ajayv\Desktop\HS CODE TEST")
    pdf_path = workspace_dir / "Customs Tariff of India.pdf"
    output_path = workspace_dir / "hs-codes-database.json"
    
    print("=" * 60)
    print("ADVANCED HS CODE EXTRACTION FROM PDF")
    print("=" * 60)
    
    # Extract codes
    hs_codes = extract_hs_codes_advanced(str(pdf_path))
    
    if not hs_codes:
        print("⚠️ No HS codes found")
        return
    
    print(f"\n📊 Extracted codes: {len(hs_codes)}")
    
    # Show sample
    print("\n📋 Sample codes:")
    for code_item in hs_codes[:10]:
        print(f"  {code_item['code']}: {code_item['description'][:70]}...")
    
    # Create database
    database = {
        "metadata": {
            "source": "Customs Tariff of India",
            "extraction_date": "2026-01-26",
            "total_codes": len(hs_codes),
            "version": "1.0",
            "extraction_method": "pdfplumber with table and text extraction"
        },
        "codes": hs_codes
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(database, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Database created: {output_path}")
        print(f"📊 Total codes: {len(hs_codes)}")
        return len(hs_codes)
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return 0

if __name__ == "__main__":
    main()
