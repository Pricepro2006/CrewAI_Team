/**
 * NLP Result Display Component
 * Intelligent display of NLP processing results with confidence indicators
 * and actionable suggestions for the Walmart Grocery Agent
 */

import React, { useMemo } from 'react';
import { 
  Brain, 
  Target, 
  TrendingUp, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  Lightbulb,
  Package,
  DollarSign
} from 'lucide-react';
import { NLPResult, SuggestedAction, WalmartProduct } from '../types/WalmartTypes';
import './NLPInterface.css';

interface NLPResultDisplayProps {
  result: NLPResult;
  onActionClick?: (action: SuggestedAction) => void;
  onProductClick?: (product: WalmartProduct) => void;
  className?: string;
}

export const NLPResultDisplay: React.FC<NLPResultDisplayProps> = ({
  result,
  onActionClick,
  onProductClick,
  className = ''
}) => {
  // Confidence level categorization
  const confidenceLevel = useMemo(() => {
    if (result.confidence >= 0.8) return 'high';
    if (result.confidence >= 0.6) return 'medium';
    return 'low';
  }, [result.confidence]);

  // Intent icon mapping
  const getIntentIcon = (intentType: string) => {
    switch (intentType) {
      case 'search': return <Target size={20} />;
      case 'add_to_cart': return <ShoppingCart size={20} />;
      case 'compare': return <TrendingUp size={20} />;
      case 'price_check': return <DollarSign size={20} />;
      case 'availability': return <Package size={20} />;
      case 'nutrition': return <Lightbulb size={20} />;
      case 'substitute': return <ArrowRight size={20} />;
      default: return <Brain size={20} />;
    }
  };

  // Entity type styling
  const getEntityStyle = (entityType: string) => {
    const styles = {
      product: 'entity-product',
      brand: 'entity-brand',
      category: 'entity-category',
      price: 'entity-price',
      quantity: 'entity-quantity',
      store: 'entity-store'
    };
    return styles[entityType as keyof typeof styles] || 'entity-default';
  };

  // Action button styling
  const getActionStyle = (actionType: string) => {
    const styles = {
      search: 'action-search',
      add_to_cart: 'action-cart',
      view_product: 'action-view',
      compare: 'action-compare',
      set_alert: 'action-alert'
    };
    return styles[actionType as keyof typeof styles] || 'action-default';
  };

  return (
    <div className={`nlp-result-display ${className}`}>
      {/* Result Header */}
      <div className="result-header">
        <div className="result-title">
          <div className="intent-icon">
            {getIntentIcon(result.intent.type)}
          </div>
          <div className="intent-info">
            <h3 className="intent-title">
              {result.intent.type.replace('_', ' ').toUpperCase()}
            </h3>
            <p className="processed-query">{result.processedQuery}</p>
          </div>
        </div>
        
        <div className={`confidence-indicator confidence-${confidenceLevel}`}>
          <div className="confidence-icon">
            {confidenceLevel === 'high' ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
          </div>
          <span className="confidence-text">
            {Math.round(result.confidence * 100)}% confident
          </span>
        </div>
      </div>

      {/* Entities Section */}
      {result.entities && result.entities.length > 0 && (
        <div className="entities-section">
          <h4 className="section-title">
            <Brain size={16} />
            Understanding
          </h4>
          <div className="entities-list">
            {result.entities.map((entity, index) => (
              <div
                key={index}
                className={`entity-item ${getEntityStyle(entity.type)}`}
              >
                <span className="entity-type">{entity.type}</span>
                <span className="entity-value">{entity.value}</span>
                <span className="entity-confidence">
                  {Math.round(entity.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Matches Section */}
      {result.productMatches && result.productMatches.length > 0 && (
        <div className="product-matches-section">
          <h4 className="section-title">
            <Package size={16} />
            Product Matches
          </h4>
          <div className="product-matches-grid">
            {result.productMatches.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="product-match-card"
                onClick={() => onProductClick?.(product)}
              >
                <div className="product-image">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/api/placeholder/80/80';
                    }}
                  />
                  {product.savings && product.savings > 0 && (
                    <div className="savings-badge">
                      Save ${product.savings.toFixed(2)}
                    </div>
                  )}
                </div>
                
                <div className="product-info">
                  <h5 className="product-name">{product.name}</h5>
                  <div className="product-pricing">
                    <span className="current-price">${product.price.toFixed(2)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="original-price">
                        ${product.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="product-meta">
                    <span className={`stock-status ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                    <span className="product-category">{product.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {result.productMatches.length > 6 && (
            <div className="view-more-products">
              <button className="view-more-button">
                View {result.productMatches.length - 6} more products
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Suggested Actions Section */}
      {result.suggestedActions && result.suggestedActions.length > 0 && (
        <div className="actions-section">
          <h4 className="section-title">
            <Lightbulb size={16} />
            Suggested Actions
          </h4>
          <div className="actions-grid">
            {result.suggestedActions.map((action, index) => (
              <button
                key={index}
                className={`action-button ${getActionStyle(action.type)}`}
                onClick={() => onActionClick?.(action)}
              >
                <div className="action-content">
                  <span className="action-label">{action.label}</span>
                  <span className="action-confidence">
                    {Math.round(action.confidence * 100)}% match
                  </span>
                </div>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clarification Section */}
      {result.clarificationNeeded && result.clarificationQuestions && (
        <div className="clarification-section">
          <h4 className="section-title">
            <AlertCircle size={16} />
            Need More Information
          </h4>
          <div className="clarification-content">
            <p className="clarification-message">
              I need a bit more information to help you better:
            </p>
            <ul className="clarification-questions">
              {result.clarificationQuestions.map((question, index) => (
                <li key={index} className="clarification-question">
                  {question}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Low Confidence Warning */}
      {confidenceLevel === 'low' && (
        <div className="low-confidence-warning">
          <AlertCircle size={16} />
          <div className="warning-content">
            <span className="warning-title">Uncertain Result</span>
            <span className="warning-message">
              Try being more specific or rephrase your question for better results.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};