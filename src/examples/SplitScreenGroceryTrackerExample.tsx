/**
 * Example implementation of the Split Screen Grocery Tracker
 * Demonstrates integration with the CrewAI Team system
 */

import React, { useState, useCallback } from 'react';
import { SplitScreenGroceryTracker } from '../ui/components/Walmart/SplitScreenGroceryTracker';
import type { BudgetAlert, ReceiptItem } from '../types/grocery-tracker';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Bell, Settings, Download, Share, BarChart } from 'lucide-react';

interface ExampleStats {
  sessionsThisMonth: number;
  totalSaved: number;
  averageSpending: number;
  topCategory: string;
}

export const SplitScreenGroceryTrackerExample: React.FC = () => {
  // Demo user configuration
  const [userId] = useState('demo-user-123');
  const [initialBudget, setInitialBudget] = useState(600);
  const [taxRate] = useState(0.0875); // 8.75% tax rate
  
  // Stats for demo purposes
  const [stats, setStats] = useState<ExampleStats>({
    sessionsThisMonth: 12,
    totalSaved: 147.82,
    averageSpending: 89.33,
    topCategory: 'Fresh Produce'
  });
  
  // Notification system
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Event handlers for demonstration
  const handleError = useCallback((error: Error) => {
    console.error('🚨 Grocery Tracker Error:', error);
    
    // Add to notifications
    setNotifications(prev => [
      ...prev,
      `Error: ${error.message} at ${new Date().toLocaleTimeString()}`
    ]);
    
    // In a real app, you might:
    // - Show a toast notification
    // - Log to error tracking service
    // - Display user-friendly error message
  }, []);
  
  const handleBudgetAlert = useCallback((alert: BudgetAlert) => {
    console.log('📢 Budget Alert:', alert);
    
    // Add to notifications
    const notification = `${alert.type.toUpperCase()}: ${alert.message} at ${new Date().toLocaleTimeString()}`;
    setNotifications(prev => [...prev, notification]);
    
    // Show notification panel
    setShowNotifications(true);
    
    // In a real app, you might:
    // - Play alert sound
    // - Send push notification
    // - Update dashboard metrics
    // - Trigger email/SMS alerts
  }, []);
  
  const handleItemAdded = useCallback((item: ReceiptItem) => {
    console.log('🛍️ Item Added:', item);
    
    // Update demo stats
    setStats(prev => ({
      ...prev,
      averageSpending: prev.averageSpending + (item.totalPrice * 0.01) // Small demo adjustment
    }));
    
    // Add to notifications
    setNotifications(prev => [
      ...prev,
      `Added ${item.name} ($${item.totalPrice.toFixed(2)}) at ${new Date().toLocaleTimeString()}`
    ]);
    
    // In a real app, you might:
    // - Update analytics
    // - Sync with external shopping services
    // - Update inventory tracking
    // - Send to meal planning systems
  }, []);
  
  // Demo actions
  const clearNotifications = () => setNotifications([]);
  
  const downloadReport = () => {
    console.log('📈 Generating shopping report...');
    // In a real app, this would generate and download a PDF/Excel report
    alert('Shopping report feature would be implemented here');
  };
  
  const shareList = () => {
    console.log('🔗 Sharing shopping list...');
    // In a real app, this would integrate with sharing APIs
    alert('List sharing feature would be implemented here');
  };
  
  const openSettings = () => {
    console.log('⚙️ Opening settings...');
    // In a real app, this would open a settings modal
    alert('Settings panel would open here');
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with demo controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Split Screen Grocery Tracker Demo
            </h1>
            <p className="text-gray-600 mt-1">
              Integrated budget tracking and grocery list management
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {notifications.length}
                  </Badge>
                )}
              </Button>
              
              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-medium">Notifications</h3>
                    <Button variant="ghost" size="sm" onClick={clearNotifications}>
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-3 text-gray-500 text-center">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notification, index) => (
                        <div key={index} className="p-3 border-b border-gray-100 last:border-b-0">
                          <p className="text-sm text-gray-700">{notification}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Action buttons */}
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-1" />
              Report
            </Button>
            <Button variant="outline" size="sm" onClick={shareList}>
              <Share className="h-4 w-4 mr-1" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={openSettings}>
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
          </div>
        </div>
      </div>
      
      {/* Demo stats */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sessions This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.sessionsThisMonth}</p>
                </div>
                <BarChart className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Saved</p>
                  <p className="text-2xl font-bold text-green-600">${stats.totalSaved.toFixed(2)}</p>
                </div>
                <div className="text-green-500">💰</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg. Spending</p>
                  <p className="text-2xl font-bold text-gray-900">${stats.averageSpending.toFixed(2)}</p>
                </div>
                <div className="text-blue-500">📊</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Top Category</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.topCategory}</p>
                </div>
                <div className="text-green-500">🥬</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Main grocery tracker component */}
      <div className="flex-1">
        <SplitScreenGroceryTracker
          userId={userId}
          initialBudget={initialBudget}
          taxRate={taxRate}
          autoSave={true}
          enableWebSocket={true}
          onError={handleError}
          onBudgetAlert={handleBudgetAlert}
          onItemAdded={handleItemAdded}
          className="demo-grocery-tracker"
        />
      </div>
      
      {/* Demo information panel */}
      <div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            📝 Demo Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-blue-800 mb-1">Left Pane - Grocery Receipt</h3>
              <ul className="text-blue-700 space-y-1">
                <li>• Search products (try typing "banana" or "milk")</li>
                <li>• Add items by clicking search results</li>
                <li>• Adjust quantities with +/- buttons</li>
                <li>• Remove items with trash icon</li>
                <li>• View real-time totals at bottom</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-blue-800 mb-1">Right Pane - Budget Tracker</h3>
              <ul className="text-blue-700 space-y-1">
                <li>• Click "Edit" next to monthly budget to change amount</li>
                <li>• Watch progress bars update as you add items</li>
                <li>• Budget alerts trigger at 90% and 100%</li>
                <li>• Category breakdowns show spending by type</li>
                <li>• Insights panel provides spending analytics</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-blue-800 text-sm">
              💡 <strong>Tip:</strong> Try adding multiple items to see budget alerts in action. 
              Set a low budget (like $50) and add several expensive items to trigger warnings!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitScreenGroceryTrackerExample;

// Export for easy importing
export {
  type BudgetAlert,
  type ReceiptItem
} from '../types/grocery-tracker';

// Configuration examples
export const trackerConfigurations = {
  // Basic configuration
  basic: {
    userId: 'user-123',
    initialBudget: 400,
    taxRate: 0.08,
    autoSave: true,
    enableWebSocket: false
  },
  
  // Advanced configuration with all features
  advanced: {
    userId: 'power-user-456',
    initialBudget: 800,
    taxRate: 0.095,
    autoSave: true,
    enableWebSocket: true,
    onError: (error: Error) => {
      console.error('Tracker error:', error);
      // Send to error tracking service
    },
    onBudgetAlert: (alert: BudgetAlert) => {
      // Custom alert handling
      if (alert.type === 'danger') {
        // Send urgent notification
        console.warn('URGENT BUDGET ALERT:', alert.message);
      }
    },
    onItemAdded: (item: ReceiptItem) => {
      // Analytics tracking
      console.log('Item added for analytics:', {
        category: item.category,
        price: item.totalPrice,
        timestamp: new Date().toISOString()
      });
    }
  },
  
  // Mobile-optimized configuration
  mobile: {
    userId: 'mobile-user-789',
    initialBudget: 300,
    taxRate: 0.0875,
    autoSave: true,
    enableWebSocket: false, // Disabled to save battery
    className: 'mobile-grocery-tracker'
  }
};

// Usage examples for different scenarios
export const usageExamples = {
  // Family shopping
  family: `
    <SplitScreenGroceryTracker
      userId="family-account"
      initialBudget={1200}
      taxRate={0.08}
      autoSave={true}
      enableWebSocket={true}
      onBudgetAlert={(alert) => {
        // Send family notification
        sendFamilyNotification(alert);
      }}
    />
  `,
  
  // Student budget
  student: `
    <SplitScreenGroceryTracker
      userId="student-123"
      initialBudget={200}
      taxRate={0.0875}
      autoSave={true}
      enableWebSocket={false}
      onBudgetAlert={(alert) => {
        if (alert.type === 'warning') {
          showBudgetTip('Consider buying generic brands to save money!');
        }
      }}
    />
  `,
  
  // Business expense tracking
  business: `
    <SplitScreenGroceryTracker
      userId="business-456"
      initialBudget={2000}
      taxRate={0.095}
      autoSave={true}
      enableWebSocket={true}
      onItemAdded={(item) => {
        // Log to business expense system
        logBusinessExpense({
          item: item.name,
          amount: item.totalPrice,
          category: item.category,
          date: new Date(),
          receiptId: item.sessionId
        });
      }}
    />
  `
};