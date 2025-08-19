import React, { useState } from "react";
import { ShoppingCartIcon, ClipboardIcon, TruckIcon, ChartBarIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { WalmartProductSearch } from "./WalmartProductSearch";
import { WalmartNLPSearch } from "./WalmartNLPSearch";
import { WalmartShoppingCart } from "./WalmartShoppingCart";
import { WalmartDealAlert } from "./WalmartDealAlert";
import { WalmartBudgetTracker } from "./WalmartBudgetTracker";

type ViewType = "dashboard" | "search" | "nlp-search" | "cart" | "deals" | "budget" | "orders";

export const WalmartDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>("dashboard");

  const renderContent = (): React.ReactNode => {
    switch (activeView) {
      case "search":
        return <WalmartProductSearch />;
      case "nlp-search":
        return <WalmartNLPSearch />;
      case "cart":
        return <WalmartShoppingCart />;
      case "deals":
        return <WalmartDealAlert />;
      case "budget":
        return <WalmartBudgetTracker />;
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
              onClick={() => setActiveView("nlp-search")}
              className={`px-4 py-2 rounded flex items-center gap-2 ${activeView === "nlp-search" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              <SparklesIcon className="h-4 w-4" />
              Smart Search
            </button>
            <button
              onClick={() => setActiveView("search")}
              className={`px-4 py-2 rounded ${activeView === "search" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Classic Search
            </button>
            <button
              onClick={() => setActiveView("deals")}
              className={`px-4 py-2 rounded ${activeView === "deals" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Deals
            </button>
            <button
              onClick={() => setActiveView("cart")}
              className={`px-4 py-2 rounded ${activeView === "cart" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Cart
            </button>
            <button
              onClick={() => setActiveView("budget")}
              className={`px-4 py-2 rounded ${activeView === "budget" ? "bg-blue-700" : "hover:bg-blue-700"}`}
            >
              Budget
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

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }): React.ReactElement => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <button
            onClick={() => onNavigate("nlp-search")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50"
          >
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded">
              <SparklesIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-medium">Smart Search (AI-Powered)</h3>
              <p className="text-sm text-gray-600">Use natural language to find products</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("search")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded"
          >
            <div className="bg-blue-100 p-2 rounded">
              <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">Classic Search</h3>
              <p className="text-sm text-gray-600">Traditional product search</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("cart")}
            className="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded"
          >
            <div className="bg-green-100 p-2 rounded">
              <ShoppingCartIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium">Shopping Cart</h3>
              <p className="text-sm text-gray-600">View and manage your cart</p>
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
      {/* <WalmartDeliveryScheduler /> */}

      {/* Substitution Preferences */}
      {/* <WalmartSubstitutionManager /> */}

      {/* User Preferences */}
      {/* <WalmartUserPreferences /> */}
    </div>
  );
};