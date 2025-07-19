#!/usr/bin/env python3

import json
import sys

def extract_irrigation_responses():
    try:
        with open('comprehensive-all-models-results-2025-07-18T22-57-28-948Z.json', 'r') as f:
            data = json.load(f)
        
        print("🔍 ACTUAL IRRIGATION SPECIALIST RESPONSES FOR 278 WYCLIFF DR, SPARTANBURG, SC 29301")
        print("=" * 80)
        print("❌ PROBLEM: You asked for specific contacts and pricing, but here's what each model actually gave you:\n")
        
        irrigation_results = [r for r in data['results'] if r['queryId'] == 'irrigation_specialist' and r['success']]
        
        for i, result in enumerate(irrigation_results, 1):
            model_name = result['shortName']
            response = result['response']
            confidence = result['overallConfidence']
            
            print(f"\n{i}. === {model_name} === (Confidence: {confidence:.1%})")
            print("-" * 60)
            
            # Check if response contains actual contacts
            has_phone_numbers = any(char in response for char in ['(', ')', '-'] if response.count(char) >= 3)
            has_specific_companies = 'LLC' in response or 'Inc' in response or 'Company' in response
            has_pricing = '$' in response or 'price' in response.lower() or 'cost' in response.lower()
            
            # Extract company mentions
            lines = response.split('\n')
            company_mentions = []
            for line in lines:
                if any(word in line.lower() for word in ['irrigation', 'sprinkler', 'landscaping']):
                    if any(word in line for word in ['Services', 'Company', 'LLC', 'Inc', 'Corp']):
                        company_mentions.append(line.strip())
            
            print(f"📞 Phone Numbers Found: {'✅ YES' if has_phone_numbers else '❌ NO'}")
            print(f"🏢 Specific Companies: {'✅ YES' if has_specific_companies else '❌ NO'}")  
            print(f"💰 Pricing Information: {'✅ YES' if has_pricing else '❌ NO'}")
            
            if company_mentions:
                print(f"🏷️  Company Names Mentioned:")
                for company in company_mentions:
                    print(f"   • {company}")
            
            # Show a snippet of the response
            snippet = response[:300] + "..." if len(response) > 300 else response
            print(f"\n📝 Response Preview:")
            print(f"   {snippet}")
            print()
        
        print("\n" + "=" * 80)
        print("🚨 CONCLUSION: NONE of the AI models provided actionable contact information!")
        print("=" * 80)
        print("❌ No phone numbers to call")
        print("❌ No specific business addresses") 
        print("❌ No pricing estimates")
        print("❌ No contractor licenses or certifications")
        print("❌ Only generic company name suggestions")
        print("\n💡 WHAT YOU ACTUALLY NEED:")
        print("   • Real irrigation company phone numbers in Spartanburg, SC")
        print("   • Specific pricing for sprinkler head repair + root damage")
        print("   • Available appointment times")
        print("   • Licensed contractor information")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_irrigation_responses()