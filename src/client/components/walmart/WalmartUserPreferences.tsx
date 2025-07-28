/**
 * Walmart User Preferences Component
 * Manage dietary preferences, shopping habits, and personalization settings
 */

import React, { useState } from 'react';
import {
  Settings,
  User,
  Heart,
  Ban,
  ShoppingBag,
  Clock,
  Bell,
  Shield,
  Palette,
  Globe,
  MapPin,
  CreditCard,
  Package,
  Check,
  Plus,
  X,
  Info,
  Save,
  ChevronRight,
  Star,
  Utensils,
  Leaf,
  Wheat,
  Fish,
  Milk,
  Egg,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '../../../components/ui/card.js';
import { Button } from '../../../components/ui/button.js';
import { Badge } from '../../../components/ui/badge.js';
import { Input } from '../../../components/ui/input.js';
import { Label } from '../../../components/ui/label.js';
import { Switch } from '../../../components/ui/switch.js';
import { Separator } from '../../../components/ui/separator.js';
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
import { Checkbox } from '../../../components/ui/checkbox.js';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion.js';
import { cn } from '../../lib/utils.js';
import { useGroceryStore } from '../../store/groceryStore.js';
import type { UserPreferences } from '../../../types/walmart-grocery.js';

interface WalmartUserPreferencesProps {
  onSavePreferences?: (preferences: UserPreferences) => void;
  showAllSections?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface DietaryOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const dietaryOptions: DietaryOption[] = [
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf, description: 'No meat or fish' },
  { id: 'vegan', label: 'Vegan', icon: Leaf, description: 'No animal products' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: Wheat, description: 'No gluten' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: Milk, description: 'No dairy products' },
  { id: 'nut-free', label: 'Nut-Free', icon: Ban, description: 'No tree nuts or peanuts' },
  { id: 'kosher', label: 'Kosher', icon: Star, description: 'Kosher certified' },
  { id: 'halal', label: 'Halal', icon: Star, description: 'Halal certified' },
  { id: 'pescatarian', label: 'Pescatarian', icon: Fish, description: 'Vegetarian + fish' },
];

const allergenOptions = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree nuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame', 'Sulfites',
];

export const WalmartUserPreferences: React.FC<WalmartUserPreferencesProps> = ({
  onSavePreferences,
  showAllSections = true,
  compactMode = false,
  className,
}) => {
  const { preferences, updatePreferences } = useGroceryStore();
  
  const [editedPreferences, setEditedPreferences] = useState<UserPreferences>({
    ...preferences,
    dietaryRestrictions: preferences.dietaryRestrictions || [],
    allergens: preferences.allergens || [],
    preferredBrands: preferences.preferredBrands || [],
    avoidProducts: preferences.avoidProducts || [],
    favoriteProducts: preferences.favoriteProducts || [],
    preferOrganic: preferences.preferOrganic || false,
    preferGeneric: preferences.preferGeneric || false,
  });
  
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [brandInput, setBrandInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [brandType, setBrandType] = useState<'preferred' | 'avoid'>('preferred');
  const [hasChanges, setHasChanges] = useState(false);
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([
    { id: 'deals', label: 'Deal Alerts', description: 'Get notified about new deals', enabled: true },
    { id: 'price-drops', label: 'Price Drops', description: 'Alert when tracked prices drop', enabled: true },
    { id: 'stock', label: 'Stock Alerts', description: 'Know when items are back in stock', enabled: true },
    { id: 'orders', label: 'Order Updates', description: 'Track your order status', enabled: true },
    { id: 'recommendations', label: 'Recommendations', description: 'Personalized product suggestions', enabled: false },
  ]);
  
  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setEditedPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleDietaryToggle = (dietId: string) => {
    const current = editedPreferences.dietaryRestrictions || [];
    const updated = current.includes(dietId)
      ? current.filter(d => d !== dietId)
      : [...current, dietId];
    handlePreferenceChange('dietaryRestrictions', updated);
  };
  
  const handleAllergenToggle = (allergen: string) => {
    const current = editedPreferences.allergens || [];
    const updated = current.includes(allergen)
      ? current.filter(a => a !== allergen)
      : [...current, allergen];
    handlePreferenceChange('allergens', updated);
  };
  
  const handleAddBrand = () => {
    if (brandInput.trim()) {
      const key = brandType === 'preferred' ? 'preferredBrands' : 'avoidProducts';
      const current = editedPreferences[key] || [];
      if (!current.includes(brandInput.trim())) {
        handlePreferenceChange(key, [...current, brandInput.trim()]);
      }
      setBrandInput('');
      setShowBrandDialog(false);
    }
  };
  
  const handleRemoveBrand = (brand: string, type: 'preferred' | 'avoid') => {
    const key = type === 'preferred' ? 'preferredBrands' : 'avoidProducts';
    const current = editedPreferences[key] || [];
    handlePreferenceChange(key, current.filter(b => b !== brand));
  };
  
  const handleSave = () => {
    updatePreferences(editedPreferences);
    setHasChanges(false);
    
    if (onSavePreferences) {
      onSavePreferences(editedPreferences);
    }
  };
  
  const handleReset = () => {
    setEditedPreferences(preferences);
    setHasChanges(false);
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Dietary Restrictions</Label>
            <div className="flex flex-wrap gap-1">
              {editedPreferences.dietaryRestrictions?.length ? (
                editedPreferences.dietaryRestrictions.map(diet => (
                  <Badge key={diet} variant="secondary" className="text-xs">
                    {diet}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None selected</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="organic-compact" className="text-sm">Prefer Organic</Label>
            <Switch
              id="organic-compact"
              checked={editedPreferences.preferOrganic}
              onCheckedChange={(checked) => handlePreferenceChange('preferOrganic', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="generic-compact" className="text-sm">Prefer Generic</Label>
            <Switch
              id="generic-compact"
              checked={editedPreferences.preferGeneric}
              onCheckedChange={(checked) => handlePreferenceChange('preferGeneric', checked)}
            />
          </div>
        </CardContent>
        {hasChanges && (
          <CardFooter className="pt-3">
            <Button className="w-full" size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }
  
  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Preferences
                </CardTitle>
                <CardDescription>
                  Customize your shopping experience
                </CardDescription>
              </div>
              {hasChanges && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
        
        {/* Preferences Sections */}
        <Tabs defaultValue="dietary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dietary">Dietary</TabsTrigger>
            <TabsTrigger value="shopping">Shopping</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
          
          {/* Dietary Preferences */}
          <TabsContent value="dietary" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5" />
                  Dietary Preferences
                </CardTitle>
                <CardDescription>
                  Select your dietary restrictions and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dietary Restrictions */}
                <div className="space-y-3">
                  <Label>Dietary Restrictions</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {dietaryOptions.map(option => {
                      const Icon = option.icon;
                      const isSelected = editedPreferences.dietaryRestrictions?.includes(option.id);
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleDietaryToggle(option.id)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium text-sm">{option.label}</p>
                            {option.description && (
                              <p className="text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Allergens */}
                <div className="space-y-3">
                  <Label>Allergens to Avoid</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {allergenOptions.map(allergen => (
                      <div key={allergen} className="flex items-center space-x-2">
                        <Checkbox
                          id={allergen}
                          checked={editedPreferences.allergens?.includes(allergen) || false}
                          onCheckedChange={() => handleAllergenToggle(allergen)}
                        />
                        <Label
                          htmlFor={allergen}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {allergen}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Product Preferences */}
                <div className="space-y-3">
                  <Label>Product Preferences</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Leaf className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">Prefer Organic</p>
                          <p className="text-sm text-muted-foreground">
                            Prioritize organic products when available
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={editedPreferences.preferOrganic}
                        onCheckedChange={(checked) => 
                          handlePreferenceChange('preferOrganic', checked)
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Prefer Generic Brands</p>
                          <p className="text-sm text-muted-foreground">
                            Choose store brands for better value
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={editedPreferences.preferGeneric}
                        onCheckedChange={(checked) => 
                          handlePreferenceChange('preferGeneric', checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Shopping Preferences */}
          <TabsContent value="shopping" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Shopping Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Preferred Brands */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Preferred Brands</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBrandType('preferred');
                        setShowBrandDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Brand
                    </Button>
                  </div>
                  {editedPreferences.preferredBrands?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {editedPreferences.preferredBrands.map(brand => (
                        <Badge
                          key={brand}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          <Heart className="h-3 w-3" />
                          {brand}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4 ml-1"
                            onClick={() => handleRemoveBrand(brand, 'preferred')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No preferred brands selected
                    </p>
                  )}
                </div>
                
                {/* Brands to Avoid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Brands to Avoid</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBrandType('avoid');
                        setShowBrandDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Brand
                    </Button>
                  </div>
                  {editedPreferences.avoidProducts?.filter(p => p).length ? (
                    <div className="flex flex-wrap gap-2">
                      {editedPreferences.avoidProducts.filter(p => p).map(brand => (
                        <Badge
                          key={brand}
                          variant="destructive"
                          className="gap-1 pr-1"
                        >
                          <Ban className="h-3 w-3" />
                          {brand}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-4 w-4 ml-1"
                            onClick={() => handleRemoveBrand(brand, 'avoid')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No brands to avoid
                    </p>
                  )}
                </div>
                
                {/* Shopping Behavior */}
                <div className="space-y-3">
                  <Label>Shopping Behavior</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Preferred Delivery Time</p>
                          <p className="text-sm text-muted-foreground">
                            Morning (7AM - 12PM)
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Change
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Default Address</p>
                          <p className="text-sm text-muted-foreground">
                            123 Main St, Anytown, USA
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Notification Preferences */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Control how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notificationSettings.map(setting => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{setting.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {setting.description}
                      </p>
                    </div>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={(checked) => {
                        setNotificationSettings(prev =>
                          prev.map(s =>
                            s.id === setting.id ? { ...s, enabled: checked } : s
                          )
                        );
                        setHasChanges(true);
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Account Settings */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value="user@example.com"
                    disabled
                    className="bg-muted"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value="+1 (555) 123-4567"
                    disabled
                    className="bg-muted"
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="font-medium">Privacy & Security</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="data-sharing">Share data for personalization</Label>
                      <Switch id="data-sharing" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="purchase-history">Save purchase history</Label>
                      <Switch id="purchase-history" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Add Brand Dialog */}
      <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {brandType === 'preferred' ? 'Preferred' : 'Avoided'} Brand
            </DialogTitle>
            <DialogDescription>
              Enter the brand name you want to {brandType === 'preferred' ? 'prefer' : 'avoid'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                placeholder="e.g., Kellogg's, Nature Valley"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddBrand();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBrandDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBrand} disabled={!brandInput.trim()}>
              Add Brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};