import React, { useState } from "react";
import { ShoppingCartIcon, ClipboardListIcon, TruckIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { WalmartGroceryList } from "./WalmartGroceryList";
import { WalmartProductSearch } from "./WalmartProductSearch";
import { WalmartShoppingCart } from "./WalmartShoppingCart";
import { WalmartOrderHistory } from "./WalmartOrderHistory";
import { WalmartPriceTracker } from "./WalmartPriceTracker";
import { WalmartDealAlert } from "./WalmartDealAlert";
import { WalmartBudgetTracker } from "./WalmartBudgetTracker";
import { WalmartDeliveryScheduler } from "./WalmartDeliveryScheduler";
import { WalmartSubstitutionManager } from "./WalmartSubstitutionManager";
import { WalmartUserPreferences } from "./WalmartUserPreferences";
import { WalmartChatInterface } from "./WalmartChatInterface";

type ViewType = "dashboard" | "search" | "list" | "cart" | "orders" | "tracking" | "chat";

export const WalmartDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("dashboard");

  const renderContent = () => {
    switch (activeView) {
      case "search":
        return <WalmartProductSearch />;
      case "list":
        return <WalmartGroceryList />;
      case "cart":
        return <WalmartShoppingCart />;
      case "orders":
        return <WalmartOrderHistory />;
      case "tracking":
        return <WalmartPriceTracker />;
      case "chat":
        return <WalmartChatInterface />;
      default:
        return <DashboardOverview onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="walmart-dashboard">
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCartIcon className="h-8 w-8" />
            Walmart Grocery Agent
          </h1>
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveView("dashboard")}
              className={`px-4 py-2 rounded ${activeView === "dashboard" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView("search")}
              className={`px-4 py-2 rounded ${activeView === "search" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveView("list")}
              className={`px-4 py-2 rounded ${activeView === "list" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Lists
            </button>
            <button
              onClick={() => setActiveView("cart")}
              className={`px-4 py-2 rounded ${activeView === "cart" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Cart
            </button>
            <button
              onClick={() => setActiveView("chat")}
              className={`px-4 py-2 rounded ${activeView === "chat" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              AI Assistant
            </button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto p-4">
        {renderContent()}
      </main>
    </div>
  );
};

interface DashboardOverviewProps {
  onNavigate: (view: ViewType) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <button
            onClick={() => onNavigate("search")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded"
          >
            <div className="bg-blue-100 p-2 rounded">
              <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">Search Products</h3>
              <p className="text-sm text-gray-600">Find groceries and household items</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("list")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded"
          >
            <div className="bg-green-100 p-2 rounded">
              <ClipboardListIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium">My Lists</h3>
              <p className="text-sm text-gray-600">View and manage shopping lists</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("orders")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded"
          >
            <div className="bg-purple-100 p-2 rounded">
              <TruckIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium">Order History</h3>
              <p className="text-sm text-gray-600">Track your past orders</p>
            </div>
          </button>
        </div>
      </div>

      {/* Deal Alerts */}
      <WalmartDealAlert />

      {/* Budget Tracker */}
      <WalmartBudgetTracker />

      {/* Delivery Schedule */}
      <WalmartDeliveryScheduler />

      {/* Substitution Preferences */}
      <WalmartSubstitutionManager />

      {/* User Preferences */}
      <WalmartUserPreferences />
    </div>
  );
};