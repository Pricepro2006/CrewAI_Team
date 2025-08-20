import React, { useEffect, useState } from "react";
import { BellIcon, TagIcon, ClockIcon } from "@heroicons/react/24/outline";
import { api } from "../../../lib/trpc.js";
import type { DealMatch } from "../../../types/walmart-grocery.js";

export const WalmartDealAlert: React.FC = () => {
  const [activeDeals, setActiveDeals] = useState<DealMatch[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Subscribe to deal updates
  // TODO: Implement subscribeToDeals endpoint
  // api?.walmartGrocery?.subscribeToDeals.useSubscription(undefined, {
  //   onData: (deals: DealMatch[]) => {
  //     setActiveDeals(deals);
  //   },
  // });

  // Get initial deals
  // TODO: Implement getActiveDeals endpoint
  const initialDeals: DealMatch[] = [];

  useEffect(() => {
    if (initialDeals && Array.isArray(initialDeals)) {
      setActiveDeals(initialDeals);
    }
  }, [initialDeals]);

  const displayedDeals = showAll ? activeDeals : activeDeals.slice(0, 3);

  const getDealTypeColor = (dealType: string) => {
    switch (dealType) {
      case "FLASH_SALE":
        return "bg-red-100 text-red-700";
      case "BULK_DISCOUNT":
        return "bg-blue-100 text-blue-700";
      case "CLEARANCE":
        return "bg-yellow-100 text-yellow-700";
      case "COUPON":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""} left`;
    }
    
    return `${hours}h ${minutes}m left`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BellIcon className="h-6 w-6 text-blue-600" />
          Deal Alerts
        </h2>
        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
          {activeDeals?.length || 0} active
        </span>
      </div>

      {activeDeals?.length || 0 === 0 ? (
        <p className="text-gray-500 text-center py-4">No active deals at the moment</p>
      ) : (
        <div className="space-y-3">
          {displayedDeals?.map((deal: any) => (
            <div
              key={deal.deal_id}
              className="border rounded-lg p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TagIcon className="h-4 w-4 text-gray-500" />
                    <span className={`text-xs px-2 py-1 rounded ${getDealTypeColor(deal.deal?.type || 'UNKNOWN')}`}>
                      {(deal.deal?.type || 'UNKNOWN').replace("_", " ")}
                    </span>
                    {deal.match_score >= 0.8 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        High Match
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-medium text-gray-900 mb-1">{deal.product?.name || 'Unknown Product'}</h3>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      Deal: <span className="font-medium text-green-600">${(deal.deal?.products?.[0]?.dealPrice || 0).toFixed(2)}</span>
                    </span>
                    <span className="text-gray-600">
                      Save: <span className="font-medium">${deal?.potential_savings?.toFixed(2)}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4" />
                    <span>{formatTimeRemaining(deal.deal?.validity?.endDate || '')}</span>
                  </div>
                </div>
              </div>

              {deal.matched_criteria && deal?.matched_criteria?.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Matched: {deal?.matched_criteria?.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {activeDeals?.length || 0 > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {showAll ? "Show Less" : `Show All (${activeDeals?.length || 0})`}
        </button>
      )}

      <div className="mt-4 pt-4 border-t">
        <button className="w-full bg-blue-50 text-blue-600 py-2 rounded hover:bg-blue-100 text-sm font-medium">
          Set Deal Preferences
        </button>
      </div>
    </div>
  );
};