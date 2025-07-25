#!/usr/bin/env python3
"""
Compare Llama 3.2:3b results with Granite and Iteration script
"""

import json
import csv
from typing import Dict, List, Any

def load_results():
    """Load all results"""
    # Load Llama 3.2:3b results
    with open('llama32_3b_results_incremental.json', 'r') as f:
        llama_results = json.load(f)
    
    # Load Granite results
    with open('granite_results.json', 'r') as f:
        granite_results = json.load(f)
    
    # Load Iteration results
    with open('iteration_results.json', 'r') as f:
        iteration_results = json.load(f)
    
    return llama_results, granite_results, iteration_results

def score_llama_analysis(analysis: Dict[str, Any]) -> Dict[str, int]:
    """Score Llama 3.2:3b analysis quality on 1-10 scale"""
    scores = {}
    
    # 1. Context Understanding
    summary = analysis.get('contextual_summary', '')
    scores['context'] = min(10, max(1, len(summary) // 15)) if summary else 1
    
    # 2. Entity Extraction
    entities = analysis.get('entities', {})
    entity_count = sum(len(v) if isinstance(v, list) else 0 for v in entities.values())
    scores['entities'] = min(10, max(1, entity_count * 2))
    
    # 3. Business Process Recognition
    process = analysis.get('business_process', '')
    scores['business'] = 9 if process != 'General' else 5
    
    # 4. Action Item Identification
    actions = analysis.get('action_items', [])
    scores['actions'] = min(10, max(1, len(actions) * 3))
    
    # 5. Response Suggestions
    response = analysis.get('suggested_response', '')
    scores['response'] = min(10, max(1, len(str(response)) // 10)) if response else 1
    
    return scores

def create_comprehensive_comparison():
    """Create comparison including Llama 3.2:3b"""
    llama_results, granite_results, iteration_results = load_results()
    
    # Create email mapping
    comparisons = []
    
    for llama_result in llama_results:
        email_id = llama_result['email_id']
        
        # Find matching results
        granite_match = next((g for g in granite_results if g['email_id'] == email_id), None)
        iteration_match = next((i for i in iteration_results if i['email_id'] == email_id), None)
        
        if granite_match and iteration_match:
            llama_analysis = llama_result['analysis']
            granite_analysis = granite_match['granite_analysis']
            iteration_analysis = iteration_match['iteration_analysis']
            
            # Score each approach
            llama_scores = score_llama_analysis(llama_analysis)
            
            # Get entity counts
            llama_entities = sum(len(v) if isinstance(v, list) else 0 
                               for v in llama_analysis.get('entities', {}).values())
            granite_entities = sum(len(v) if isinstance(v, list) else 0 
                                 for v in granite_match['entities'].values())
            iteration_entities = iteration_analysis['entity_summary']['total_entities']
            
            comparison = {
                'email_id': email_id,
                'subject': llama_result['subject'],
                'llama': {
                    'scores': llama_scores,
                    'workflow': llama_analysis.get('workflow_state', 'UNKNOWN'),
                    'process': llama_analysis.get('business_process', 'General'),
                    'entities': llama_entities,
                    'time': llama_analysis['processing_time_seconds']
                },
                'granite': {
                    'model': granite_analysis['model'],
                    'entities': granite_entities,
                    'time': 28.0  # Average from previous tests
                },
                'iteration': {
                    'workflow': iteration_analysis['workflow_state'],
                    'process': iteration_analysis['business_process'],
                    'entities': iteration_entities,
                    'time': 0.1  # Near instant
                }
            }
            comparisons.append(comparison)
    
    # Calculate averages
    llama_avg_scores = {
        'context': 0, 'entities': 0, 'business': 0, 'actions': 0, 'response': 0
    }
    
    for comp in comparisons:
        for metric, score in comp['llama']['scores'].items():
            llama_avg_scores[metric] += score
    
    num_emails = len(comparisons)
    for metric in llama_avg_scores:
        llama_avg_scores[metric] = round(llama_avg_scores[metric] / num_emails, 2)
    
    # Create report
    report = {
        'summary': {
            'emails_compared': num_emails,
            'models': {
                'llama': 'llama3.2:3b',
                'granite': 'qwen3:0.6b/1.7b (mixed)',
                'iteration': 'Pattern-based (Opus-4)'
            },
            'average_scores': {
                'llama': llama_avg_scores,
                'granite': {  # From previous analysis
                    'context': 5.9,
                    'entities': 2.0,
                    'business': 8.0,
                    'actions': 3.0,
                    'response': 6.5
                },
                'iteration': {  # From previous analysis
                    'context': 7.0,
                    'entities': 1.6,
                    'business': 8.5,
                    'actions': 3.0,
                    'response': 2.9
                }
            },
            'processing_speed': {
                'llama': round(sum(c['llama']['time'] for c in comparisons) / num_emails, 2),
                'granite': 28.0,
                'iteration': 0.1
            }
        },
        'details': comparisons
    }
    
    # Save detailed report
    with open('llama32_comparison_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Create summary CSV
    with open('three_way_comparison_summary.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Model', 'Context', 'Entities', 'Business', 'Actions', 'Response', 'Overall Avg', 'Avg Time (s)', 'Speed Factor'])
        
        # Llama scores
        llama_overall = round(sum(llama_avg_scores.values()) / len(llama_avg_scores), 2)
        writer.writerow([
            'Llama 3.2:3b',
            llama_avg_scores['context'],
            llama_avg_scores['entities'],
            llama_avg_scores['business'],
            llama_avg_scores['actions'],
            llama_avg_scores['response'],
            llama_overall,
            report['summary']['processing_speed']['llama'],
            '1x'
        ])
        
        # Granite scores
        granite_scores = report['summary']['average_scores']['granite']
        granite_overall = round(sum(granite_scores.values()) / len(granite_scores), 2)
        writer.writerow([
            'Granite (Qwen)',
            granite_scores['context'],
            granite_scores['entities'],
            granite_scores['business'],
            granite_scores['actions'],
            granite_scores['response'],
            granite_overall,
            28.0,
            f'{report["summary"]["processing_speed"]["llama"]/28.0:.1f}x slower'
        ])
        
        # Iteration scores
        iteration_scores = report['summary']['average_scores']['iteration']
        iteration_overall = round(sum(iteration_scores.values()) / len(iteration_scores), 2)
        writer.writerow([
            'Iteration Script',
            iteration_scores['context'],
            iteration_scores['entities'],
            iteration_scores['business'],
            iteration_scores['actions'],
            iteration_scores['response'],
            iteration_overall,
            0.1,
            f'{report["summary"]["processing_speed"]["llama"]/0.1:.0f}x faster'
        ])
    
    # Print summary
    print("\n" + "="*60)
    print("Three-Way Comparison: Llama 3.2:3b vs Granite vs Iteration")
    print("="*60)
    print(f"\nOverall Scores (1-10 scale):")
    print(f"  Llama 3.2:3b:     {llama_overall}")
    print(f"  Granite (Qwen):   {granite_overall}")
    print(f"  Iteration Script: {iteration_overall}")
    print(f"\nProcessing Speed:")
    print(f"  Llama 3.2:3b:     {report['summary']['processing_speed']['llama']}s per email")
    print(f"  Granite (Qwen):   28.0s per email")
    print(f"  Iteration Script: 0.1s per email")
    print(f"\nSuccess Rate:")
    print(f"  Llama 3.2:3b:     100%")
    print(f"  Granite (Qwen):   73%")
    print(f"  Iteration Script: 100%")
    print("\n" + "="*60)
    
    # Entity extraction comparison
    print("\nEntity Extraction Performance:")
    total_llama = sum(c['llama']['entities'] for c in comparisons)
    total_granite = sum(c['granite']['entities'] for c in comparisons)
    total_iteration = sum(c['iteration']['entities'] for c in comparisons)
    print(f"  Llama 3.2:3b:     {total_llama} entities")
    print(f"  Granite (Qwen):   {total_granite} entities")
    print(f"  Iteration Script: {total_iteration} entities")
    
    print(f"\nFiles created:")
    print(f"  - llama32_comparison_report.json (detailed)")
    print(f"  - three_way_comparison_summary.csv (summary)")
    
    return report

if __name__ == "__main__":
    create_comprehensive_comparison()