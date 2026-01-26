#!/usr/bin/env python3
"""
Extract HS codes from Customs Tariff of India PDF
Creates hs-codes-database.json with structured data
"""

import PyPDF2
import json
import re
import os
from pathlib import Path

def extract_hs_codes_from_pdf(pdf_path):
    """Extract HS codes and descriptions from PDF"""
    
    print(f"📄 Opening PDF: {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF not found: {pdf_path}")
        return None
    
    all_text = ""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)
            print(f"📊 Total pages: {num_pages}")
            
            for page_num, page in enumerate(pdf_reader.pages, 1):
                text = page.extract_text()
                all_text += text + "\n"
                if page_num % 10 == 0:
                    print(f"  Processed {page_num}/{num_pages} pages...")
        
        print(f"✅ PDF text extracted ({len(all_text)} characters)")
    except Exception as e:
        print(f"❌ Error reading PDF: {e}")
        return None
    
    # Extract HS codes - 8 digit codes with descriptions
    hs_codes = []
    hs_codes_set = set()  # To avoid duplicates
    
    # Split into lines for line-by-line processing
    lines = all_text.split('\n')
    
    print(f"📄 Processing {len(lines)} lines...")
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            i += 1
            continue
        
        # Check if line contains an 8-digit code at the beginning or after minimal whitespace
        # Pattern: starts with 8 digits, optional whitespace, then description
        code_match = re.match(r'^(\d{8})[\s\-–]+(.*?)$', line)
        
        if code_match:
            code = code_match.group(1)
            description = code_match.group(2).strip()
            
            # Avoid duplicates
            if code not in hs_codes_set:
                # Collect continuation lines if description is short
                j = i + 1
                while j < len(lines) and len(description) < 100:
                    next_line = lines[j].strip()
                    
                    # Stop if next line is another HS code
                    if re.match(r'^\d{8}', next_line):
                        break
                    
                    # Stop if line appears to be a header or page number
                    if next_line.isdigit() or len(next_line) < 3:
                        j += 1
                        continue
                    
                    # Add line to description
                    if not re.match(r'^[a-z]\)', next_line):  # Skip sub-items
                        description += ' ' + next_line
                    
                    j += 1
                
                # Clean up description
                description = ' '.join(description.split())
                
                # Keep if description is reasonable length
                if len(description) > 5 and len(description) < 500:
                    hs_codes_set.add(code)
                    
                    # Extract keywords - important words from description
                    words = description.split()
                    keywords = []
                    for w in words:
                        if len(w) > 3 and w.lower() not in ['the', 'and', 'with', 'from', 'other']:
                            keywords.append(w)
                    keywords = keywords[:7]  # Top 7 keywords
                    
                    hs_codes.append({
                        "code": code,
                        "description": description[:300],  # Limit to 300 chars
                        "keywords": keywords
                    })
        
        i += 1
    
    print(f"✅ Found {len(hs_codes)} HS codes")
    
    return hs_codes

def create_database(hs_codes, output_path):
    """Create JSON database file"""
    
    if not hs_codes:
        print("❌ No HS codes extracted!")
        return False
    
    database = {
        "metadata": {
            "source": "Customs Tariff of India",
            "extraction_date": "2026-01-26",
            "total_codes": len(hs_codes),
            "version": "1.0"
        },
        "codes": hs_codes
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(database, f, indent=2, ensure_ascii=False)
        print(f"✅ Database created: {output_path}")
        return True
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False

def main():
    # Find PDF file
    workspace_dir = Path("c:\\Users\\ajayv\\Desktop\\HS CODE TEST")
    pdf_path = workspace_dir / "Customs Tariff of India.pdf"
    output_path = workspace_dir / "hs-codes-database.json"
    
    print("=" * 60)
    print("HS CODE EXTRACTION FROM PDF")
    print("=" * 60)
    
    # Extract codes
    hs_codes = extract_hs_codes_from_pdf(str(pdf_path))
    
    if not hs_codes:
        print("❌ Failed to extract HS codes")
        return
    
    print(f"\n📊 Extracted codes: {len(hs_codes)}")
    
    # Show sample
    if hs_codes:
        print("\n📋 Sample codes:")
        for code_item in hs_codes[:5]:
            print(f"  {code_item['code']}: {code_item['description'][:70]}...")
    
    # Create database
    if create_database(hs_codes, str(output_path)):
        print(f"\n✅ SUCCESS!")
        print(f"📁 File: {output_path}")
        print(f"📊 Total codes: {len(hs_codes)}")
    else:
        print("❌ Failed to create database")

if __name__ == "__main__":
    main()
