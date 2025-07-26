import React, { useState, useEffect } from "react";
import { ChartBarIcon, CurrencyDollarIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/trpc";

interface BudgetCategory {
  category: string;
  allocated: number;
  spent: number;
  percentage: number;
}

export const WalmartBudgetTracker: React.FC = () => {
  const [totalBudget, setTotalBudget] = useState(500);
  const [currentSpent, setCurrentSpent] = useState(0);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(totalBudget.toString());

  // Get spending analytics
  const { data: analytics } = api.walmartGrocery.getSpendingAnalytics.useQuery({
    userId: "default-user",
    timeRange: "month",
  });

  useEffect(() => {
    if (analytics) {
      setCurrentSpent(analytics.totalSpent);
      
      // Transform analytics into budget categories
      const budgetCategories: BudgetCategory[] = [
        {
          category: "Fresh Produce",
          allocated: totalBudget * 0.25,
          spent: analytics.categoryBreakdown?.["Fresh Produce"] || 0,
          percentage: 0,
        },
        {
          category: "Dairy & Eggs",
          allocated: totalBudget * 0.15,
          spent: analytics.categoryBreakdown?.["Dairy & Eggs"] || 0,
          percentage: 0,
        },
        {
          category: "Meat & Seafood",
          allocated: totalBudget * 0.20,
          spent: analytics.categoryBreakdown?.["Meat & Seafood"] || 0,
          percentage: 0,
        },
        {
          category: "Pantry",
          allocated: totalBudget * 0.20,
          spent: analytics.categoryBreakdown?.["Pantry"] || 0,
          percentage: 0,
        },
        {
          category: "Other",
          allocated: totalBudget * 0.20,
          spent: analytics.categoryBreakdown?.["Other"] || 0,
          percentage: 0,
        },
      ];

      // Calculate percentages
      budgetCategories.forEach(cat => {
        cat.percentage = cat.allocated > 0 ? (cat.spent / cat.allocated) * 100 : 0;
      });

      setCategories(budgetCategories);
    }
  }, [analytics, totalBudget]);

  const remainingBudget = totalBudget - currentSpent;
  const budgetPercentage = totalBudget > 0 ? (currentSpent / totalBudget) * 100 : 0;

  const updateBudget = () => {
    const newBudgetValue = parseFloat(newBudget);
    if (!isNaN(newBudgetValue) && newBudgetValue > 0) {
      setTotalBudget(newBudgetValue);
      setEditingBudget(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 text-blue-600" />
          Budget Tracker
        </h2>
        <span className="text-sm text-gray-500">This Month</span>
      </div>

      {/* Overall Budget Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Monthly Budget</span>
          </div>
          {editingBudget ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="w-24 px-2 py-1 border rounded text-right"
              />
              <button
                onClick={updateBudget}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingBudget(false);
                  setNewBudget(totalBudget.toString());
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingBudget(true)}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Edit
            </button>
          )}
        </div>

        <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-300 ${getProgressColor(budgetPercentage)}`}
            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-sm">
          <span className="text-gray-600">
            Spent: <span className="font-medium">${currentSpent.toFixed(2)}</span>
          </span>
          <span className={remainingBudget < 0 ? "text-red-600 font-medium" : "text-gray-600"}>
            {remainingBudget < 0 ? "Over budget: " : "Remaining: "}
            <span className="font-medium">${Math.abs(remainingBudget).toFixed(2)}</span>
          </span>
        </div>

        {budgetPercentage >= 90 && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-yellow-50 rounded text-yellow-700 text-sm">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>You're approaching your budget limit</span>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-700">Category Breakdown</h3>
        {categories.map((category) => (
          <div key={category.category} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{category.category}</span>
              <span className="text-gray-500">
                ${category.spent.toFixed(2)} / ${category.allocated.toFixed(2)}
              </span>
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full transition-all duration-300 ${getProgressColor(category.percentage)}`}
                style={{ width: `${Math.min(category.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <button className="w-full bg-blue-50 text-blue-600 py-2 rounded hover:bg-blue-100 text-sm font-medium">
          View Spending History
        </button>
      </div>
    </div>
  );
};