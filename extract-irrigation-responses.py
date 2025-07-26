#!/usr/bin/env python3
"""
Extract and analyze irrigation specialist responses from test data
"""

import json
import re
from datetime import datetime
from pathlib import Path

def extract_business_info(response: str) -> dict:
    """Extract business-related information from response"""
    lower_response = response.lower()
    
    info = {
        'has_location_mention': bool(re.search(r'spartanburg|29301|south carolina|\bsc\b', lower_response)),
        'has_problem_understanding': bool(re.search(r'root.*damage|root.*intrusion|root.*crack|root.*leak', lower_response)),
        'has_search_suggestions': bool(re.search(r'google|search|find|directory|yellow pages|angie|homeadvisor|thumbtack', lower_response)),
        'has_cost_info': bool(re.search(r'\$\d+|cost|price|fee|charge|estimate|quote', lower_response)),
        'has_contact_methods': bool(re.search(r'call|phone|email|website|contact', lower_response)),
        'has_business_names': bool(re.search(r'irrigation.*(?:specialist|contractor|company|service)|plumb', lower_response)),
        'has_licensing_info': bool(re.search(r'licens|insur|certif|bond', lower_response)),
        'has_local_resources': bool(re.search(r'local|near|area|surrounding', lower_response)),
        'cost_ranges': re.findall(r'\$\d+(?:\.\d{2})?(?:\s*-\s*\$?\d+(?:\.\d{2})?)?', response),
        'phone_numbers': re.findall(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', response),
        'websites': re.findall(r'(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?', response),
    }
    
    # Calculate business value score
    info['business_value_score'] = sum([
        info['has_location_mention'] * 2,  # Location is critical
        info['has_problem_understanding'] * 1.5,
        info['has_search_suggestions'] * 1,
        info['has_cost_info'] * 1.5,
        info['has_contact_methods'] * 1,
        info['has_business_names'] * 1,
        info['has_licensing_info'] * 0.5,
        info['has_local_resources'] * 1,
        len(info['cost_ranges']) * 0.5,
        len(info['phone_numbers']) * 2,  # Actual phone numbers are very valuable
        len(info['websites']) * 1.5,
    ])
    
    return info

def analyze_response_quality(response: str) -> dict:
    """Analyze the quality and structure of the response"""
    
    # Check for structured response elements
    has_numbered_list = bool(re.search(r'^\s*\d+\.', response, re.MULTILINE))
    has_bullet_points = bool(re.search(r'^\s*[-•*]', response, re.MULTILINE))
    has_sections = bool(re.search(r'^#{1,3}\s+.+$', response, re.MULTILINE))
    
    # Check for actionable steps
    action_words = ['search', 'find', 'call', 'contact', 'visit', 'check', 'ask', 'get', 'request', 'compare']
    action_count = sum(1 for word in action_words if word in response.lower())
    
    # Check for specific recommendations
    recommendation_phrases = [
        'i recommend', 'i suggest', 'you should', 'try to', 'make sure',
        'be sure to', 'don\'t forget', 'important to', 'best to'
    ]
    recommendation_count = sum(1 for phrase in recommendation_phrases if phrase in response.lower())
    
    # Response length analysis
    word_count = len(response.split())
    
    return {
        'has_structure': has_numbered_list or has_bullet_points or has_sections,
        'has_numbered_list': has_numbered_list,
        'has_bullet_points': has_bullet_points,
        'has_sections': has_sections,
        'action_count': action_count,
        'recommendation_count': recommendation_count,
        'word_count': word_count,
        'is_comprehensive': word_count > 150 and (has_numbered_list or has_bullet_points),
        'readability_score': min(100, (
            (has_numbered_list or has_bullet_points) * 20 +
            min(action_count * 10, 30) +
            min(recommendation_count * 10, 20) +
            (20 if 100 < word_count < 500 else 10)
        ))
    }

def compare_to_expected_response():
    """Return the expected response structure based on GROUP_2B requirements"""
    
    return {
        'expected_elements': [
            'Specific mention of Spartanburg, SC or ZIP 29301',
            'Understanding of root damage problem',
            'Local search strategies (Google Maps, directories)',
            'Specific business names or services',
            'Cost ranges for initial visit ($50-$150)',
            'Questions to ask providers',
            'Licensing/insurance verification',
            'Contact methods (phone, website)',
            'Travel/service area confirmation',
            'Urgency assessment'
        ],
        'ideal_structure': """
1. Finding Local Specialists:
   - Search "irrigation repair Spartanburg SC 29301"
   - Check Angie's List, HomeAdvisor, or Thumbtack
   - Call local landscaping companies for referrals

2. What to Look For:
   - Licensed irrigation contractors
   - Experience with root damage repairs
   - Insurance coverage
   - Local references

3. Typical Costs:
   - Service call: $75-$150
   - Root damage repair: $200-$500
   - Parts: $50-$200 depending on damage

4. Questions to Ask:
   - "Do you handle root intrusion repairs?"
   - "What's your service call fee?"
   - "Do you warranty your work?"
   - "When can you come out?"
        """
    }

def generate_analysis_report():
    """Generate a comprehensive analysis report"""
    
    report = []
    report.append("# Irrigation Specialist Response Analysis")
    report.append(f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("\n## Analysis Framework\n")
    
    expected = compare_to_expected_response()
    
    report.append("### Expected Response Elements")
    for element in expected['expected_elements']:
        report.append(f"- {element}")
    
    report.append("\n### Ideal Response Structure")
    report.append("```")
    report.append(expected['ideal_structure'].strip())
    report.append("```")
    
    report.append("\n## Scoring Methodology\n")
    report.append("### Business Value Components")
    report.append("- **Location Awareness** (2x weight): Mentions Spartanburg, SC, or ZIP")
    report.append("- **Problem Understanding** (1.5x): References root damage specifically")
    report.append("- **Cost Information** (1.5x): Provides price ranges or estimates")
    report.append("- **Contact Methods** (1x): Suggests how to reach providers")
    report.append("- **Search Strategies** (1x): Explains how to find services")
    report.append("- **Phone Numbers** (2x each): Actual contact numbers")
    report.append("- **Websites** (1.5x each): Specific web resources")
    
    report.append("\n### Quality Metrics")
    report.append("- **Structure**: Uses lists, bullets, or sections")
    report.append("- **Action Words**: Contains actionable verbs")
    report.append("- **Recommendations**: Includes specific suggestions")
    report.append("- **Comprehensiveness**: 150-500 words with structure")
    
    return "\n".join(report)

def main():
    """Main analysis function"""
    
    # Load test data if available
    data_file = Path("data/extracted_iems_data.json")
    
    if data_file.exists():
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        print(f"Loaded {len(data.get('models', []))} model responses")
        
        # Analyze each model's response
        results = []
        for model_data in data.get('models', []):
            model_name = model_data.get('model', 'Unknown')
            response = model_data.get('response', '')
            
            if response:
                business_info = extract_business_info(response)
                quality_info = analyze_response_quality(response)
                
                results.append({
                    'model': model_name,
                    'business_info': business_info,
                    'quality_info': quality_info,
                    'overall_score': business_info['business_value_score'] + quality_info['readability_score'] / 10
                })
        
        # Sort by overall score
        results.sort(key=lambda x: x['overall_score'], reverse=True)
        
        # Generate report
        report = generate_analysis_report()
        
        # Add results
        report += "\n\n## Model Performance Analysis\n"
        
        for i, result in enumerate(results, 1):
            report += f"\n### {i}. {result['model']}"
            report += f"\n**Overall Score**: {result['overall_score']:.1f}\n"
            
            bi = result['business_info']
            report += "\n**Business Value Elements**:"
            report += f"\n- Location mentioned: {'✅' if bi['has_location_mention'] else '❌'}"
            report += f"\n- Problem understanding: {'✅' if bi['has_problem_understanding'] else '❌'}"
            report += f"\n- Search suggestions: {'✅' if bi['has_search_suggestions'] else '❌'}"
            report += f"\n- Cost information: {'✅' if bi['has_cost_info'] else '❌'}"
            report += f"\n- Contact methods: {'✅' if bi['has_contact_methods'] else '❌'}"
            
            if bi['cost_ranges']:
                report += f"\n- Cost ranges found: {', '.join(bi['cost_ranges'])}"
            if bi['phone_numbers']:
                report += f"\n- Phone numbers: {len(bi['phone_numbers'])}"
            if bi['websites']:
                report += f"\n- Websites: {len(bi['websites'])}"
            
            qi = result['quality_info']
            report += f"\n\n**Response Quality**:"
            report += f"\n- Structured: {'✅' if qi['has_structure'] else '❌'}"
            report += f"\n- Action words: {qi['action_count']}"
            report += f"\n- Recommendations: {qi['recommendation_count']}"
            report += f"\n- Word count: {qi['word_count']}"
            report += f"\n- Readability: {qi['readability_score']}/100"
            
        # Save report
        report_file = f"IRRIGATION_ANALYSIS_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"\nAnalysis report saved to: {report_file}")
        
        # Print summary
        print("\n" + "="*60)
        print("SUMMARY - Top 3 Models by Business Value")
        print("="*60)
        for i, result in enumerate(results[:3], 1):
            print(f"{i}. {result['model']}: {result['overall_score']:.1f} points")
    
    else:
        # Generate just the framework report
        report = generate_analysis_report()
        
        report_file = "IRRIGATION_ANALYSIS_FRAMEWORK.md"
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"Analysis framework saved to: {report_file}")
        print("\nNo test data found. Run the irrigation test first to generate data.")

if __name__ == "__main__":
    main()