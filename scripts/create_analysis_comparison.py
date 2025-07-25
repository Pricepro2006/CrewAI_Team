#!/usr/bin/env python3
"""
Create comprehensive comparison between Granite3.3:2b and Iteration Script analysis
"""

import json
import csv
from typing import Dict, List, Any

def load_results():
    """Load both sets of results"""
    with open('granite_results.json', 'r') as f:
        granite_results = json.load(f)
    
    with open('iteration_results.json', 'r') as f:
        iteration_results = json.load(f)
    
    return granite_results, iteration_results

def calculate_entity_accuracy(granite_entities: Dict, iteration_entities: Dict) -> Dict[str, float]:
    """Calculate entity extraction accuracy between approaches"""
    accuracy = {}
    
    # Count total entities found by each approach
    granite_total = sum(len(v) if isinstance(v, list) else 0 for v in granite_entities.values())
    iteration_total = sum(len(v) if isinstance(v, list) else 0 for v in iteration_entities.values())
    
    # Compare specific entity types
    for entity_type in ['po_numbers', 'quote_numbers', 'case_numbers', 'part_numbers']:
        granite_set = set(granite_entities.get(entity_type, []))
        
        # Map iteration entities to granite format
        if entity_type == 'po_numbers':
            iteration_set = set([q for q in iteration_entities.get('quotes', []) if q.startswith('PO-')])
        elif entity_type == 'quote_numbers':
            iteration_set = set([q for q in iteration_entities.get('quotes', []) if not q.startswith('PO-')])
        elif entity_type == 'part_numbers':
            iteration_set = set(iteration_entities.get('skus', []))
        else:
            iteration_set = set(iteration_entities.get(entity_type, []))
        
        # Calculate overlap
        if len(granite_set) > 0 or len(iteration_set) > 0:
            overlap = len(granite_set.intersection(iteration_set))
            total_unique = len(granite_set.union(iteration_set))
            accuracy[entity_type] = (overlap / total_unique) * 100 if total_unique > 0 else 0
        else:
            accuracy[entity_type] = 100  # Both found nothing
    
    return {
        'entity_accuracy': accuracy,
        'granite_total': granite_total,
        'iteration_total': iteration_total
    }

def score_analysis_quality(granite_analysis: Dict, iteration_analysis: Dict) -> Dict[str, int]:
    """Score analysis quality on 1-10 scale"""
    scores = {}
    
    # 1. Context Understanding (based on summary/workflow detection)
    granite_context = len(granite_analysis.get('contextual_summary', ''))
    iteration_workflow = iteration_analysis.get('workflow_state', '') != 'NEW'
    
    scores['context_granite'] = min(10, max(1, granite_context // 20)) if granite_context > 0 else 1
    scores['context_iteration'] = 8 if iteration_workflow else 6
    
    # 2. Entity Extraction (based on total entities found)
    granite_entities = granite_analysis.get('action_details', [])
    granite_entity_count = len(granite_entities) if granite_entities else 0
    iteration_entity_count = iteration_analysis.get('entity_summary', {}).get('total_entities', 0)
    
    scores['entities_granite'] = min(10, max(1, granite_entity_count * 2))
    scores['entities_iteration'] = min(10, max(1, iteration_entity_count))
    
    # 3. Business Process Recognition
    granite_has_business_impact = bool(granite_analysis.get('business_impact'))
    iteration_has_process = iteration_analysis.get('business_process', '') != 'General'
    
    scores['business_granite'] = 8 if granite_has_business_impact else 5
    scores['business_iteration'] = 9 if iteration_has_process else 4
    
    # 4. Action Item Identification
    granite_actions = len(granite_analysis.get('action_details', []))
    iteration_urgency = len(iteration_analysis.get('urgency_indicators', []))
    
    scores['actions_granite'] = min(10, max(1, granite_actions * 3))
    scores['actions_iteration'] = min(10, max(1, iteration_urgency * 2)) if iteration_urgency > 0 else 3
    
    # 5. Response Suggestions
    granite_response = len(granite_analysis.get('suggested_response', ''))
    iteration_categories = len(iteration_analysis.get('categories', []))
    
    scores['response_granite'] = min(10, max(1, granite_response // 15)) if granite_response > 0 else 1
    scores['response_iteration'] = min(10, max(1, iteration_categories * 3)) if iteration_categories else 2
    
    return scores

def create_comparison_report():
    """Create comprehensive comparison report"""
    granite_results, iteration_results = load_results()
    
    # Create email mapping
    email_map = {}
    for g_result in granite_results:
        email_id = g_result['email_id']
        email_map[email_id] = {'granite': g_result}
    
    for i_result in iteration_results:
        email_id = i_result['email_id']
        if email_id in email_map:
            email_map[email_id]['iteration'] = i_result
    
    # Generate comparisons
    comparisons = []
    overall_scores = {
        'granite': {'context': 0, 'entities': 0, 'business': 0, 'actions': 0, 'response': 0},
        'iteration': {'context': 0, 'entities': 0, 'business': 0, 'actions': 0, 'response': 0}
    }
    
    for email_id, data in email_map.items():
        if 'granite' in data and 'iteration' in data:
            granite = data['granite']
            iteration = data['iteration']
            
            # Calculate entity accuracy
            entity_comparison = calculate_entity_accuracy(
                granite['entities'], 
                iteration['iteration_analysis']['entities']
            )
            
            # Score analysis quality
            scores = score_analysis_quality(
                granite['granite_analysis'],
                iteration['iteration_analysis']
            )
            
            # Add to overall scores
            overall_scores['granite']['context'] += scores['context_granite']
            overall_scores['granite']['entities'] += scores['entities_granite']
            overall_scores['granite']['business'] += scores['business_granite']
            overall_scores['granite']['actions'] += scores['actions_granite']
            overall_scores['granite']['response'] += scores['response_granite']
            
            overall_scores['iteration']['context'] += scores['context_iteration']
            overall_scores['iteration']['entities'] += scores['entities_iteration']
            overall_scores['iteration']['business'] += scores['business_iteration']
            overall_scores['iteration']['actions'] += scores['actions_iteration']
            overall_scores['iteration']['response'] += scores['response_iteration']
            
            comparisons.append({
                'email_id': email_id,
                'subject': granite['subject'],
                'granite_model': granite['granite_analysis']['model'],
                'granite_summary': granite['granite_analysis']['contextual_summary'][:100] if granite['granite_analysis']['contextual_summary'] else 'N/A',
                'iteration_workflow': iteration['iteration_analysis']['workflow_state'],
                'iteration_process': iteration['iteration_analysis']['business_process'],
                'entity_accuracy': entity_comparison['entity_accuracy'],
                'granite_entities_total': entity_comparison['granite_total'],
                'iteration_entities_total': entity_comparison['iteration_total'],
                'scores': scores
            })
    
    # Calculate averages
    num_emails = len(comparisons)
    for approach in overall_scores:
        for metric in overall_scores[approach]:
            overall_scores[approach][metric] = round(overall_scores[approach][metric] / num_emails, 2)
    
    # Create summary report
    report = {
        'comparison_summary': {
            'total_emails_compared': num_emails,
            'granite_models_used': list(set([c['granite_model'] for c in comparisons])),
            'overall_scores': overall_scores
        },
        'detailed_comparisons': comparisons,
        'methodology': {
            'scoring_scale': '1-10 scale per metric',
            'metrics': [
                'Context Understanding - How well each approach understands email context',
                'Entity Extraction - Accuracy and completeness of business entity extraction', 
                'Business Process Recognition - Identification of relevant business processes',
                'Action Item Identification - Recognition of required actions',
                'Response Suggestions - Quality of suggested responses'
            ]
        }
    }
    
    # Save detailed report
    with open('analysis_comparison_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Create summary CSV
    with open('analysis_comparison_summary.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Email ID', 'Subject', 'Granite Model', 'Granite Summary Score', 'Iteration Workflow Score', 
                        'Granite Entities', 'Iteration Entities', 'Entity Accuracy %'])
        
        for comp in comparisons:
            avg_granite_score = round((comp['scores']['context_granite'] + comp['scores']['entities_granite'] + 
                                     comp['scores']['business_granite'] + comp['scores']['actions_granite'] + 
                                     comp['scores']['response_granite']) / 5, 1)
            avg_iteration_score = round((comp['scores']['context_iteration'] + comp['scores']['entities_iteration'] + 
                                       comp['scores']['business_iteration'] + comp['scores']['actions_iteration'] + 
                                       comp['scores']['response_iteration']) / 5, 1)
            
            avg_entity_accuracy = round(sum(comp['entity_accuracy'].values()) / len(comp['entity_accuracy']) if comp['entity_accuracy'] else 0, 1)
            
            writer.writerow([
                comp['email_id'],
                comp['subject'][:50],
                comp['granite_model'],
                avg_granite_score,
                avg_iteration_score,
                comp['granite_entities_total'],
                comp['iteration_entities_total'],
                avg_entity_accuracy
            ])
    
    print(f"Comparison report created for {num_emails} emails")
    print("Files created:")
    print("- analysis_comparison_report.json (detailed)")
    print("- analysis_comparison_summary.csv (summary)")
    print("\nOverall Average Scores (1-10 scale):")
    print("Granite3.3:2b approach:")
    for metric, score in overall_scores['granite'].items():
        print(f"  {metric.capitalize()}: {score}")
    print("Iteration script approach:")
    for metric, score in overall_scores['iteration'].items():
        print(f"  {metric.capitalize()}: {score}")

if __name__ == "__main__":
    create_comparison_report()