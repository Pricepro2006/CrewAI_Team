/**
 * Walmart Substitution Manager Component
 * Smart product substitution suggestions with preference learning
 */

import React, { useState, useEffect } from 'react';
import {
  Repeat,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  Info,
  Settings,
  Star,
  Package,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Filter,
  ChevronDown,
  Heart,
  Ban,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Label } from '../../../components/ui/label.js';
import { Switch } from '../../../components/ui/switch.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs.js';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group.js';
import { Checkbox } from '../../../components/ui/checkbox.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip.js';
import { cn, formatPrice } from '../../lib/utils.js';
import { useGroceryStore } from '../../store/groceryStore.js';
import { useCart } from '../../hooks/useCart.js';
import { getNumericPrice } from '../../../utils/walmart-product.js';
import type { WalmartProduct, SubstitutionOptions, DietaryFilter, AllergenType } from '../../../types/walmart-grocery.js';

interface WalmartSubstitutionManagerProps {
  product?: WalmartProduct;
  onSelectSubstitution?: (substitute: WalmartProduct) => void;
  showPreferences?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface SubstitutionSuggestion {
  id: string;
  walmartId: string;
  name: string;
  brand?: string;
  price: number;
  thumbnailUrl?: string;
  inStock?: boolean;
  availability?: { inStock: boolean };
  reason: string;
  matchScore: number;
  priceDifference: number;
  isPreferred?: boolean;
  nutritionComparison?: {
    calories: { original: number; substitute: number };
    protein: { original: number; substitute: number };
    sugar: { original: number; substitute: number };
  };
}

interface SubstitutionPreferences {
  autoSubstitute: boolean;
  preferredBrands: string[];
  avoidBrands: string[];
  priceRange: 'cheaper' | 'similar' | 'any';
  priorityFactors: ('price' | 'brand' | 'nutrition' | 'organic')[];
  dietaryRestrictions: string[];
  allergens: string[];
}

const SubstitutionCard: React.FC<{
  original: WalmartProduct;
  suggestion: SubstitutionSuggestion;
  onSelect: (product: SubstitutionSuggestion) => void;
  onFeedback: (productId: string, positive: boolean) => void;
  isSelected?: boolean;
}> = ({ original, suggestion, onSelect, onFeedback, isSelected = false }) => {
  // Handle ProductPrice type properly for price calculations
  const originalPrice = getNumericPrice(original.price);
  const suggestionPrice = suggestion.price; // Already a number
  const priceDiff = suggestionPrice - originalPrice;
  const priceDiffPercent = (priceDiff / originalPrice) * 100;
  
  return (
    <div
      className={cn(
        "relative border rounded-lg p-4 transition-all cursor-pointer",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50",
        suggestion.isPreferred && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={() => onSelect(suggestion)}
    >
      {/* Preferred badge */}
      {suggestion.isPreferred && (
        <Badge className="absolute -top-2 -right-2 gap-1">
          <Star className="h-3 w-3" />
          Preferred
        </Badge>
      )}
      
      <div className="flex items-start gap-3">
        {/* Product image */}
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100">
          {suggestion.thumbnailUrl ? (
            <img
              src={suggestion.thumbnailUrl}
              alt={suggestion.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-full w-full p-3 text-gray-400" />
          )}
          {!(suggestion.inStock || suggestion.availability?.inStock) && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-xs text-white font-medium">Out of Stock</span>
            </div>
          )}
        </div>
        
        {/* Product details */}
        <div className="flex-1 space-y-2">
          <div>
            <h4 className="font-medium line-clamp-1">{suggestion.name}</h4>
            {suggestion.brand && (
              <p className="text-sm text-muted-foreground">{suggestion.brand}</p>
            )}
          </div>
          
          {/* Price comparison */}
          <div className="flex items-center gap-3">
            <span className="font-medium">{formatPrice(suggestionPrice)}</span>
            {priceDiff !== 0 && (
              <Badge
                variant={priceDiff < 0 ? "success" : "secondary"}
                className="text-xs"
              >
                {priceDiff < 0 ? '−' : '+'}
                {formatPrice(Math.abs(priceDiff))} ({Math.abs(priceDiffPercent).toFixed(0)}%)
              </Badge>
            )}
          </div>
          
          {/* Match reason */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>{suggestion.reason}</span>
          </div>
          
          {/* Match score */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${suggestion.matchScore}%` }}
              />
            </div>
            <span className="text-xs font-medium">{suggestion.matchScore}% match</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onFeedback(suggestion.id, true);
                  }}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Good substitute</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onFeedback(suggestion.id, false);
                  }}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poor substitute</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Nutrition comparison */}
      {suggestion.nutritionComparison && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium mb-2">Nutrition Comparison</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Calories</span>
              <p className={cn(
                "font-medium",
                suggestion.nutritionComparison.calories.substitute < 
                suggestion.nutritionComparison.calories.original
                  ? "text-green-600"
                  : "text-red-600"
              )}>
                {suggestion.nutritionComparison.calories.substitute}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Protein</span>
              <p className={cn(
                "font-medium",
                suggestion.nutritionComparison.protein.substitute > 
                suggestion.nutritionComparison.protein.original
                  ? "text-green-600"
                  : "text-orange-600"
              )}>
                {suggestion.nutritionComparison.protein.substitute}g
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Sugar</span>
              <p className={cn(
                "font-medium",
                suggestion.nutritionComparison.sugar.substitute < 
                suggestion.nutritionComparison.sugar.original
                  ? "text-green-600"
                  : "text-red-600"
              )}>
                {suggestion.nutritionComparison.sugar.substitute}g
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="h-5 w-5 text-primary" />
        </div>
      )}
    </div>
  );
};

export const WalmartSubstitutionManager: React.FC<WalmartSubstitutionManagerProps> = ({
  product,
  onSelectSubstitution,
  showPreferences = true,
  compactMode = false,
  className,
}) => {
  const { preferences, updatePreferences } = useGroceryStore();
  const { addItem } = useCart();
  
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<string | null>(null);
  const [substitutionPrefs, setSubstitutionPrefs] = useState<SubstitutionPreferences>({
    autoSubstitute: true,
    preferredBrands: preferences.preferredBrands || preferences.favorite_brands || [],
    avoidBrands: [],
    priceRange: 'similar',
    priorityFactors: ['price', 'brand'],
    dietaryRestrictions: preferences.dietaryRestrictions || preferences.dietary_preferences || [],
    allergens: preferences.allergens || [],
  });
  const [filterCategory, setFilterCategory] = useState<'all' | 'preferred' | 'cheaper' | 'healthier'>('all');
  
  // Mock substitution suggestions

  const mockSuggestions: SubstitutionSuggestion[] = product ? [
    {
      id: 'sub-1',
      walmartId: 'sub-wm-1',
      name: `${product.brand || 'Store Brand'} ${typeof product.category === 'string' ? product.category : 'Product'} Alternative`,
      brand: 'Great Value',
      price: getNumericPrice(product.price) * 0.85,
      thumbnailUrl: product.thumbnailUrl,
      inStock: true,
      availability: { inStock: true },
      reason: 'Similar product, lower price',
      matchScore: 92,
      priceDifference: -getNumericPrice(product.price) * 0.15,
      isPreferred: true,
      nutritionComparison: {
        calories: { original: 120, substitute: 110 },
        protein: { original: 3, substitute: 4 },
        sugar: { original: 12, substitute: 10 },
      },
    },
    {
      id: 'sub-2',
      walmartId: 'sub-wm-2',
      name: `Organic ${product.name}`,
      brand: 'Nature Valley',
      price: getNumericPrice(product.price) * 1.2,
      thumbnailUrl: product.thumbnailUrl,
      inStock: true,
      availability: { inStock: true },
      reason: 'Organic option available',
      matchScore: 85,
      priceDifference: getNumericPrice(product.price) * 0.2,
      nutritionComparison: {
        calories: { original: 120, substitute: 115 },
        protein: { original: 3, substitute: 5 },
        sugar: { original: 12, substitute: 8 },
      },
    },
    {
      id: 'sub-3',
      walmartId: 'sub-wm-3',
      name: `Premium ${typeof product.category === 'string' ? product.category : 'Product'}`,
      brand: product.brand || 'Premium Brand',
      price: getNumericPrice(product.price) * 1.1,
      thumbnailUrl: product.thumbnailUrl,
      inStock: true,
      availability: { inStock: true },
      reason: 'Same brand, different size',
      matchScore: 88,
      priceDifference: getNumericPrice(product.price) * 0.1,
    },
  ] : [];
  
  const filteredSuggestions = mockSuggestions.filter(sub => {
    switch (filterCategory) {
      case 'preferred':
        return sub.isPreferred;
      case 'cheaper':
        return sub.priceDifference < 0;
      case 'healthier':
        return sub.nutritionComparison && 
               sub.nutritionComparison.calories.substitute < sub.nutritionComparison.calories.original;
      default:
        return true;
    }
  });
  
  const handleSelectSubstitution = (substitute: SubstitutionSuggestion) => {
    setSelectedSubstitute(substitute.id);
    if (onSelectSubstitution) {
      // Convert SubstitutionSuggestion to WalmartProduct for callback
      const productToSelect: WalmartProduct = {
        id: substitute.id,
        walmartId: substitute.walmartId,
        name: substitute.name,
        brand: substitute.brand || 'Generic',
        category: 'General',
        description: '',
        price: substitute.price,
        images: [],
        availability: substitute.availability || { inStock: true },
        metadata: { source: 'manual' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnailUrl: substitute.thumbnailUrl,
        inStock: substitute.inStock ?? true
      };
      onSelectSubstitution(productToSelect);
    } else {
      // Convert for cart
      const productForCart: WalmartProduct = {
        id: substitute.id,
        walmartId: substitute.walmartId,
        name: substitute.name,
        brand: substitute.brand || 'Generic',
        category: 'General',
        description: '',
        price: substitute.price,
        images: [],
        availability: substitute.availability || { inStock: true },
        metadata: { source: 'manual' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnailUrl: substitute.thumbnailUrl,
        inStock: substitute.inStock ?? true
      };
      addItem(productForCart);
    }
  };
  
  const handleFeedback = (productId: string, positive: boolean) => {
    // In a real app, this would update the ML model
    console.log(`Feedback for ${productId}: ${positive ? 'positive' : 'negative'}`);
  };
  
  const handleSavePreferences = () => {
    updatePreferences({
      preferredBrands: substitutionPrefs.preferredBrands,
      favorite_brands: substitutionPrefs.preferredBrands, // Support both property names
      dietaryRestrictions: substitutionPrefs.dietaryRestrictions as DietaryFilter[],
      dietary_preferences: substitutionPrefs.dietaryRestrictions as DietaryFilter[], // Support both property names
      allergens: substitutionPrefs.allergens as AllergenType[],
    });
    setShowPreferencesDialog(false);
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Substitutions
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {filteredSuggestions.length} options
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {!product ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a product to see substitution options
            </p>
          ) : filteredSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No substitutions available
            </p>
          ) : (
            <div className="space-y-2">
              {filteredSuggestions.slice(0, 2).map(sub => (
                <button
                  key={sub.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                    selectedSubstitute === sub.id
                      ? "bg-primary/10 border border-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleSelectSubstitution(sub)}
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(sub.price)} • {sub.reason}
                    </p>
                  </div>
                  {sub.isPreferred && (
                    <Star className="h-3 w-3 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Smart Substitutions
              {product && (
                <Badge variant="outline" className="ml-2">
                  for {product.name}
                </Badge>
              )}
            </CardTitle>
            
            {showPreferences && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreferencesDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!product ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium mb-1">No product selected</p>
              <p className="text-sm text-muted-foreground">
                Select a product to see smart substitution suggestions
              </p>
            </div>
          ) : (
            <>
              {/* Original product */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
                      {product.thumbnailUrl ? (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.name}
                          className="h-full w-full object-cover rounded"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(getNumericPrice(product.price))} • Original selection
                      </p>
                    </div>
                  </div>
                  {!(product.inStock || product.availability?.inStock) && (
                    <Badge variant="destructive">Out of Stock</Badge>
                  )}
                </div>
              </div>
              
              {/* Filter tabs */}
              <Tabs value={filterCategory} onValueChange={(value: string) => setFilterCategory(value as 'all' | 'preferred' | 'cheaper' | 'healthier')}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">
                    All ({mockSuggestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="preferred" className="text-xs">
                    Preferred
                  </TabsTrigger>
                  <TabsTrigger value="cheaper" className="text-xs">
                    Cheaper
                  </TabsTrigger>
                  <TabsTrigger value="healthier" className="text-xs">
                    Healthier
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Substitution suggestions */}
              <div className="space-y-3">
                {filteredSuggestions.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No substitutions match your current filter
                    </p>
                  </div>
                ) : (
                  filteredSuggestions.map(suggestion => (
                    <SubstitutionCard
                      key={suggestion.id}
                      original={product}
                      suggestion={suggestion}
                      onSelect={handleSelectSubstitution}
                      onFeedback={handleFeedback}
                      isSelected={selectedSubstitute === suggestion.id}
                    />
                  ))
                )}
              </div>
              
              {/* Auto-substitute notice */}
              {substitutionPrefs.autoSubstitute && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Auto-substitution enabled</p>
                    <p className="text-muted-foreground">
                      We'll automatically select the best substitute if this item is unavailable
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Preferences Dialog */}
      <Dialog open={showPreferencesDialog} onOpenChange={setShowPreferencesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Substitution Preferences</DialogTitle>
            <DialogDescription>
              Customize how we select substitutes for out-of-stock items
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Auto-substitute toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-substitute" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-substitute out-of-stock items
              </Label>
              <Switch
                id="auto-substitute"
                checked={substitutionPrefs.autoSubstitute}
                onCheckedChange={(checked: boolean) =>
                  setSubstitutionPrefs(prev => ({ ...prev, autoSubstitute: checked }))
                }
              />
            </div>
            
            {/* Price range preference */}
            <div className="space-y-2">
              <Label>Price preference</Label>
              <RadioGroup
                value={substitutionPrefs.priceRange}
                onValueChange={(value: string) =>
                  setSubstitutionPrefs(prev => ({ ...prev, priceRange: value as 'cheaper' | 'similar' | 'any' }))
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cheaper" id="cheaper" />
                  <Label htmlFor="cheaper" className="font-normal cursor-pointer">
                    Always choose cheaper alternatives
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="similar" id="similar" />
                  <Label htmlFor="similar" className="font-normal cursor-pointer">
                    Keep prices similar (±10%)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="any" />
                  <Label htmlFor="any" className="font-normal cursor-pointer">
                    Price doesn't matter
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Priority factors */}
            <div className="space-y-2">
              <Label>Prioritize by</Label>
              <div className="space-y-2">
                {['price', 'brand', 'nutrition', 'organic'].map(factor => (
                  <div key={factor} className="flex items-center space-x-2">
                    <Checkbox
                      id={factor}
                      checked={substitutionPrefs.priorityFactors.includes(factor as any)}
                      onCheckedChange={(checked: boolean) => {
                        setSubstitutionPrefs(prev => ({
                          ...prev,
                          priorityFactors: checked
                            ? [...prev.priorityFactors, factor as 'price' | 'brand' | 'nutrition' | 'organic']
                            : prev.priorityFactors.filter(f => f !== factor),
                        }));
                      }}
                    />
                    <Label
                      htmlFor={factor}
                      className="font-normal capitalize cursor-pointer"
                    >
                      {factor}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Brand preferences */}
            <div className="space-y-2">
              <Label>Brand preferences</Label>
              <div className="text-sm text-muted-foreground">
                Preferred: {substitutionPrefs.preferredBrands.length || 'None'}
              </div>
              <Button variant="outline" size="sm" className="w-full">
                <Heart className="h-4 w-4 mr-2" />
                Manage Preferred Brands
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <Ban className="h-4 w-4 mr-2" />
                Manage Avoided Brands
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreferencesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};