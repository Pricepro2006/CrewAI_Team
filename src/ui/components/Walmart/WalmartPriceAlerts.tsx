/**
 * Walmart Price Alerts Component
 * Manages price alerts for Walmart products with backend integration
 */

import React, { useState, useEffect } from "react";
import { BellIcon, PlusIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { api } from "../../../lib/trpc.js";
import type { DealAlert } from "../../../types/price-alerts.js";

interface PriceAlertFormData {
  productName: string;
  targetPrice: number;
  alertType: "price_drop" | "stock_alert" | "sale_alert";
  priceDropPercentage?: number;
  notificationMethods: string[];
}

export const WalmartPriceAlerts: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<PriceAlertFormData>({
    productName: "",
    targetPrice: 0,
    alertType: "price_drop",
    priceDropPercentage: 10,
    notificationMethods: ["push", "email"],
  });

  // Fetch user's alerts
  const { data: alertsData, refetch: refetchAlerts } = api?.priceAlerts?.getUserAlerts.useQuery(
    { status: "active" },
    { 
      enabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Get notification history
  const { data: notificationsData } = api?.priceAlerts?.getNotificationHistory.useQuery(
    { limit: 10 },
    { enabled: true }
  );

  // Create alert mutation
  const createAlertMutation = api?.priceAlerts?.createAlert.useMutation({
    onSuccess: () => {
      setShowCreateForm(false);
      refetchAlerts();
      resetForm();
    },
  });

  // Delete alert mutation
  const deleteAlertMutation = api?.priceAlerts?.deleteAlert.useMutation({
    onSuccess: () => {
      refetchAlerts();
    },
  });

  // Pause/Resume alert mutations
  const pauseAlertMutation = api?.priceAlerts?.pauseAlert.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  const resumeAlertMutation = api?.priceAlerts?.resumeAlert.useMutation({
    onSuccess: () => refetchAlerts(),
  });

  // Test alert mutation
  const testAlertMutation = api?.priceAlerts?.testAlert.useMutation();

  const resetForm = () => {
    setFormData({
      productName: "",
      targetPrice: 0,
      alertType: "price_drop",
      priceDropPercentage: 10,
      notificationMethods: ["push", "email"],
    });
  };

  const handleCreateAlert = () => {
    if (!formData.productName || formData.targetPrice <= 0) {
      return;
    }

    createAlertMutation.mutate({
      alertName: `Price Alert: ${formData.productName}`,
      alertType: formData.alertType,
      productName: formData.productName,
      targetPrice: formData.targetPrice,
      priceDropPercentage: formData.priceDropPercentage,
      notificationMethods: formData.notificationMethods,
    });
  };

  const handleToggleAlert = (alert: DealAlert) => {
    if (alert.status === "active") {
      pauseAlertMutation.mutate({ alertId: alert.id });
    } else {
      resumeAlertMutation.mutate({ alertId: alert.id });
    }
  };

  const handleTestAlert = (alertId: string) => {
    testAlertMutation.mutate({ alertId });
  };

  const alerts = alertsData?.alerts || [];
  const notifications = notificationsData?.notifications || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BellIcon className="h-6 w-6 text-blue-600" />
          Price Alerts
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          New Alert
        </button>
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-medium mb-4">Create Price Alert</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e: any) => setFormData({ ...formData, productName: e?.target?.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Great Value Whole Milk"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetPrice}
                  onChange={(e: any) => setFormData({ ...formData, targetPrice: parseFloat(e?.target?.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price Drop %</label>
                <input
                  type="number"
                  value={formData.priceDropPercentage}
                  onChange={(e: any) => setFormData({ ...formData, priceDropPercentage: parseInt(e?.target?.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Alert Type</label>
              <select
                value={formData.alertType}
                onChange={(e: any) => setFormData({ ...formData, alertType: e?.target?.value as any })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="price_drop">Price Drop</option>
                <option value="stock_alert">Stock Alert</option>
                <option value="sale_alert">Sale Alert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notification Methods</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData?.notificationMethods?.includes("push")}
                    onChange={(e: any) => {
                      if (e?.target?.checked) {
                        setFormData({
                          ...formData,
                          notificationMethods: [...formData.notificationMethods, "push"],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          notificationMethods: formData?.notificationMethods?.filter((m: any) => m !== "push"),
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  Push Notifications
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData?.notificationMethods?.includes("email")}
                    onChange={(e: any) => {
                      if (e?.target?.checked) {
                        setFormData({
                          ...formData,
                          notificationMethods: [...formData.notificationMethods, "email"],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          notificationMethods: formData?.notificationMethods?.filter((m: any) => m !== "email"),
                        });
                      }
                    }}
                    className="mr-2"
                  />
                  Email Notifications
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateAlert}
                disabled={createAlertMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createAlertMutation.isPending ? "Creating..." : "Create Alert"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts List */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-700">Active Alerts ({alerts?.length || 0})</h3>
        
        {alerts?.length || 0 === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BellIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No active price alerts</p>
            <p className="text-sm mt-1">Create an alert to start tracking prices</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts?.map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{alert.productName || alert.alertName}</h4>
                    {alert.status === "paused" && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Target: ${alert.targetPrice?.toFixed(2) || "N/A"}
                    {alert.priceDropPercentage && ` • ${alert.priceDropPercentage}% drop`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Triggered {alert.timesTriggered || 0} times
                    {alert.lastTriggeredAt && ` • Last: ${new Date(alert.lastTriggeredAt).toLocaleDateString()}`}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestAlert(alert.id)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    title="Send test notification"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleToggleAlert(alert)}
                    className={`px-3 py-1 text-sm rounded ${
                      alert.status === "active"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {alert.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => deleteAlertMutation.mutate({ alertId: alert.id })}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete alert"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Notifications */}
      {notifications?.length || 0 > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-medium text-gray-700 mb-4">Recent Notifications</h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification: any) => (
              <div
                key={notification.id}
                className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg"
              >
                <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{notification.productName}</p>
                  <p className="text-xs text-gray-600">
                    Was ${notification.originalPrice?.toFixed(2)} → Now ${notification.salePrice?.toFixed(2)}
                    {notification.discountPercentage && ` (${notification?.discountPercentage?.toFixed(0)}% off)`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.sentAt).toLocaleString()}
                  </p>
                </div>
                {notification.wasClicked && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Viewed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};