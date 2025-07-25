/**
 * Walmart Budget Tracker Component
 * Track grocery spending with budgets, insights, and savings goals
 */

import React, { useState, useMemo } from 'react';
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertCircle,
  Target,
  ChevronRight,
  Settings,
  Download,
  Plus,
  Minus,
  Edit2,
  Check,
  X,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  Receipt,
  Sparkles,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Progress } from '../../../components/ui/progress';
import { Slider } from '../../../components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { Calendar as CalendarComponent } from '../../../components/ui/calendar';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import { useGroceryStore } from '../../store/groceryStore';
import type { Order } from '../../../types/walmart-grocery';

interface WalmartBudgetTrackerProps {
  onSetBudget?: (budget: BudgetConfig) => void;
  showInsights?: boolean;
  compactMode?: boolean;
  className?: string;
}

interface BudgetConfig {
  monthly: number;
  weekly: number;
  categories: Record<string, number>;
  alerts: {
    enabled: boolean;
    threshold: number;
  };
  savingsGoal?: number;
}

interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface BudgetPeriod {
  label: string;
  spent: number;
  budget: number;
  remaining: number;
  percentage: number;
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
}

// Generate mock spending data
const generateSpendingHistory = (days: number = 30) => {
  const history: { date: Date; amount: number; category: string }[] = [];
  const today = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate random spending with weekly patterns
    const dayOfWeek = date.getDay();
    const baseAmount = dayOfWeek === 0 || dayOfWeek === 6 ? 50 : 30;
    const amount = baseAmount + Math.random() * 30;
    
    history.push({
      date,
      amount,
      category: ['Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen'][Math.floor(Math.random() * 5)] || 'Other',
    });
  }
  
  return history;
};

// Budget visualization chart
const BudgetChart: React.FC<{
  spent: number;
  budget: number;
  height?: number;
  showLabels?: boolean;
}> = ({ spent, budget, height = 200, showLabels = true }) => {
  const percentage = Math.min((spent / budget) * 100, 100);
  const isOverBudget = spent > budget;
  
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="currentColor"
          strokeWidth="20"
          className="text-muted"
        />
        
        {/* Progress circle */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="currentColor"
          strokeWidth="20"
          strokeDasharray={`${percentage * 5.024} 502.4`}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-1000",
            isOverBudget ? "text-destructive" : 
            percentage > 80 ? "text-warning" : "text-primary"
          )}
        />
      </svg>
      
      {showLabels && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold">{percentage.toFixed(0)}%</p>
          <p className="text-sm text-muted-foreground">
            {isOverBudget ? 'Over Budget' : 'of Budget'}
          </p>
          <p className="text-lg font-medium mt-2">
            {formatPrice(spent)} / {formatPrice(budget)}
          </p>
        </div>
      )}
    </div>
  );
};

// Category spending breakdown
const CategoryBreakdown: React.FC<{
  categories: SpendingCategory[];
  total: number;
}> = ({ categories, total }) => {
  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const Icon = category.icon;
        
        return (
          <div key={category.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    category.color
                  )}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium">{category.name}</span>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPrice(category.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {category.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
            <Progress value={category.percentage} className="h-2" />
          </div>
        );
      })}
    </div>
  );
};

export const WalmartBudgetTracker: React.FC<WalmartBudgetTrackerProps> = ({
  onSetBudget,
  showInsights = true,
  compactMode = false,
  className,
}) => {
  const { orders } = useGroceryStore();
  
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
    monthly: 600,
    weekly: 150,
    categories: {
      produce: 150,
      dairy: 100,
      meat: 150,
      pantry: 100,
      frozen: 100,
    },
    alerts: {
      enabled: true,
      threshold: 80,
    },
    savingsGoal: 50,
  });
  
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('month');
  const [tempBudget, setTempBudget] = useState(budgetConfig.monthly.toString());
  
  // Calculate spending from orders
  const spendingHistory = useMemo(() => {
    if (orders.length > 0) {
      return orders.map((order: Order) => ({
        date: order.orderDate,
        amount: order.total,
        category: 'Grocery',
      }));
    }
    return generateSpendingHistory(30);
  }, [orders]);
  
  // Calculate current period spending
  const currentSpending = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const monthlySpending = spendingHistory
      .filter((s: any) => s.date >= startOfMonth)
      .reduce((sum: number, s: any) => sum + s.amount, 0);
    
    const weeklySpending = spendingHistory
      .filter((s: any) => s.date >= startOfWeek)
      .reduce((sum: number, s: any) => sum + s.amount, 0);
    
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthSpending = spendingHistory
      .filter((s: any) => s.date >= lastMonthStart && s.date <= lastMonthEnd)
      .reduce((sum: number, s: any) => sum + s.amount, 0);
    
    return {
      monthly: monthlySpending,
      weekly: weeklySpending,
      lastMonth: lastMonthSpending,
    };
  }, [spendingHistory]);
  
  // Calculate budget periods
  const budgetPeriods: Record<'week' | 'month', BudgetPeriod> = {
    week: {
      label: 'This Week',
      spent: currentSpending.weekly,
      budget: budgetConfig.weekly,
      remaining: budgetConfig.weekly - currentSpending.weekly,
      percentage: (currentSpending.weekly / budgetConfig.weekly) * 100,
      trend: currentSpending.weekly > budgetConfig.weekly * 0.9 ? 'up' : 'down',
      trendValue: 5.2,
    },
    month: {
      label: 'This Month',
      spent: currentSpending.monthly,
      budget: budgetConfig.monthly,
      remaining: budgetConfig.monthly - currentSpending.monthly,
      percentage: (currentSpending.monthly / budgetConfig.monthly) * 100,
      trend: currentSpending.monthly > currentSpending.lastMonth ? 'up' : 'down',
      trendValue: ((currentSpending.monthly - currentSpending.lastMonth) / currentSpending.lastMonth) * 100,
    },
  };
  
  const currentPeriod = budgetPeriods[selectedPeriod] || budgetPeriods.month;
  
  // Calculate category breakdown
  const categoryBreakdown: SpendingCategory[] = [
    {
      name: 'Produce',
      amount: currentSpending.monthly * 0.25,
      percentage: 25,
      icon: Package,
      color: 'bg-green-500',
    },
    {
      name: 'Dairy',
      amount: currentSpending.monthly * 0.15,
      percentage: 15,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      name: 'Meat & Seafood',
      amount: currentSpending.monthly * 0.30,
      percentage: 30,
      icon: Package,
      color: 'bg-red-500',
    },
    {
      name: 'Pantry',
      amount: currentSpending.monthly * 0.20,
      percentage: 20,
      icon: Package,
      color: 'bg-yellow-500',
    },
    {
      name: 'Frozen',
      amount: currentSpending.monthly * 0.10,
      percentage: 10,
      icon: Package,
      color: 'bg-purple-500',
    },
  ];
  
  // Calculate savings
  const monthlySavings = budgetConfig.savingsGoal || 0;
  const actualSavings = Math.max(0, budgetConfig.monthly - currentSpending.monthly);
  const savingsProgress = (actualSavings / monthlySavings) * 100;
  
  const handleSaveBudget = () => {
    const newBudget = parseFloat(tempBudget);
    if (!isNaN(newBudget) && newBudget > 0) {
      setBudgetConfig(prev => ({
        ...prev,
        monthly: newBudget,
        weekly: newBudget / 4,
      }));
      setEditingBudget(false);
      
      if (onSetBudget) {
        onSetBudget({
          ...budgetConfig,
          monthly: newBudget,
          weekly: newBudget / 4,
        });
      }
    }
  };
  
  if (compactMode) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Budget
            </CardTitle>
            <Badge
              variant={currentPeriod.percentage > 100 ? "destructive" : 
                       currentPeriod.percentage > 80 ? "warning" : "default"}
            >
              {currentPeriod.percentage.toFixed(0)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Spent</span>
              <span className="font-medium">{formatPrice(currentPeriod.spent)}</span>
            </div>
            <Progress value={currentPeriod.percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget: {formatPrice(currentPeriod.budget)}</span>
              <span>
                {currentPeriod.remaining > 0 
                  ? `${formatPrice(currentPeriod.remaining)} left`
                  : `${formatPrice(Math.abs(currentPeriod.remaining))} over`
                }
              </span>
            </div>
          </div>
          
          {actualSavings > 0 && (
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-xs font-medium text-green-600">
                <Sparkles className="h-3 w-3 inline mr-1" />
                {formatPrice(actualSavings)} saved this month!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Budget Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Budget Tracker
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBudgetDialog(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Period Selector */}
            <Tabs value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="week">Weekly</TabsTrigger>
                <TabsTrigger value="month">Monthly</TabsTrigger>
              </TabsList>
              
              <TabsContent value={selectedPeriod} className="space-y-6 mt-6">
                {/* Budget Chart */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <BudgetChart
                      spent={currentPeriod.spent}
                      budget={currentPeriod.budget}
                      height={250}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{currentPeriod.label} Budget</h3>
                        {editingBudget ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={tempBudget}
                              onChange={(e) => setTempBudget(e.target.value)}
                              className="w-24 h-8"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={handleSaveBudget}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingBudget(false);
                                setTempBudget(budgetConfig.monthly.toString());
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBudget(true)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="font-medium">
                            {formatPrice(currentPeriod.budget)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Spent</span>
                          <span className="font-medium">
                            {formatPrice(currentPeriod.spent)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Remaining</span>
                          <span className={cn(
                            "font-medium",
                            currentPeriod.remaining < 0 ? "text-destructive" : "text-green-600"
                          )}>
                            {formatPrice(Math.abs(currentPeriod.remaining))}
                            {currentPeriod.remaining < 0 && " over"}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Trend indicator */}
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Spending Trend</span>
                        <div className="flex items-center gap-1">
                          {currentPeriod.trend === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-destructive" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-green-600" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            currentPeriod.trend === 'up' ? "text-destructive" : "text-green-600"
                          )}>
                            {Math.abs(currentPeriod.trendValue).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Compared to last {selectedPeriod}
                      </p>
                    </div>
                    
                    {/* Alert */}
                    {budgetConfig.alerts.enabled && 
                     currentPeriod.percentage >= budgetConfig.alerts.threshold && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Budget Alert</p>
                          <p className="text-muted-foreground">
                            You've used {currentPeriod.percentage.toFixed(0)}% of your {selectedPeriod}ly budget
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              categories={categoryBreakdown}
              total={currentSpending.monthly}
            />
          </CardContent>
        </Card>
        
        {/* Savings Goal */}
        {budgetConfig.savingsGoal && budgetConfig.savingsGoal > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Savings Goal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Monthly Goal</span>
                    <span className="font-medium">
                      {formatPrice(budgetConfig.savingsGoal)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(savingsProgress, 100)} 
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPrice(actualSavings)} saved ({savingsProgress.toFixed(0)}%)
                  </p>
                </div>
                
                {actualSavings >= budgetConfig.savingsGoal && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-sm font-medium text-green-600">
                      <Check className="h-4 w-4 inline mr-1" />
                      Goal achieved! You saved {formatPrice(actualSavings - budgetConfig.savingsGoal)} extra
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Insights */}
        {showInsights && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Budget Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Average Trip</p>
                      <p className="text-2xl font-bold">
                        {formatPrice(currentSpending.monthly / 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Based on 8 trips this month
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Best Shopping Day</p>
                      <p className="text-2xl font-bold">Sunday</p>
                      <p className="text-xs text-muted-foreground">
                        Save an average of 12%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Budget Settings Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget Settings</DialogTitle>
            <DialogDescription>
              Configure your grocery budget and alerts
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Monthly Budget */}
            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={budgetConfig.monthly}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetConfig(prev => ({
                    ...prev,
                    monthly: parseFloat(e.target.value) || 0,
                    weekly: (parseFloat(e.target.value) || 0) / 4,
                  }))}
                />
              </div>
            </div>
            
            {/* Savings Goal */}
            <div className="space-y-2">
              <Label>Monthly Savings Goal</Label>
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={budgetConfig.savingsGoal || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetConfig(prev => ({
                    ...prev,
                    savingsGoal: parseFloat(e.target.value) || 0,
                  }))}
                />
              </div>
            </div>
            
            {/* Alert Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="alerts">Budget Alerts</Label>
                <Switch
                  id="alerts"
                  checked={budgetConfig.alerts.enabled}
                  onCheckedChange={(checked: boolean) => setBudgetConfig(prev => ({
                    ...prev,
                    alerts: { ...prev.alerts, enabled: checked },
                  }))}
                />
              </div>
              
              {budgetConfig.alerts.enabled && (
                <div className="space-y-2">
                  <Label>Alert Threshold</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[budgetConfig.alerts.threshold]}
                      onValueChange={([value]: number[]) => setBudgetConfig(prev => ({
                        ...prev,
                        alerts: { ...prev.alerts, threshold: value || 80 },
                      }))}
                      min={50}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm font-medium">
                      {budgetConfig.alerts.threshold}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowBudgetDialog(false);
              if (onSetBudget) {
                onSetBudget(budgetConfig);
              }
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};