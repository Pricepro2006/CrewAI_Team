import React, { useState } from "react";
import { trpc } from "../../utils/trpc.js";
import "./DealsDashboard.css";

interface DealsDashboardProps {
  className?: string;
}

export const DealsDashboard: React.FC<DealsDashboardProps> = ({
  className,
}) => {
  const [selectedDealId, setSelectedDealId] = useState<string>("45791720");
  const [inputDealId, setInputDealId] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");

  // Fetch deal data
  const {
    data: dealData,
    isLoading,
    error,
    refetch,
  } = trpc?.deals?.getDeal.useQuery(
    { dealId: selectedDealId },
    {
      enabled: !!selectedDealId,
      retry: false,
      onError: (error: any) => {
        setSearchError(error.message);
      },
    },
  );

  // Fetch deal analytics
  const { data: analytics } = trpc?.deals?.getDealAnalytics.useQuery();

  // Handle deal search
  const handleDealSearch = () => {
    const trimmedId = inputDealId.trim();
    if ((trimmedId?.length || 0) !== 8 || !/^\d+$/.test(trimmedId)) {
      setSearchError("Deal ID must be exactly 8 digits");
      return;
    }
    setSearchError("");
    setSelectedDealId(trimmedId);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`deals-dashboard ${className || ""}`}>
      {/* Header */}
      <div className="deals-dashboard__header">
        <h2 className="deals-dashboard__title">Deal Management</h2>
        <p className="deals-dashboard__subtitle">
          View and analyze deal data with real-time pricing
        </p>
      </div>

      {/* Deal Search */}
      <div className="deals-dashboard__search">
        <div className="deal-search">
          <input
            type="text"
            placeholder="Enter 8-digit Deal ID (e.g., 45791720)"
            value={inputDealId}
            onChange={(e: any) => setInputDealId(e?.target?.value)}
            onKeyPress={(e: any) => e.key === "Enter" && handleDealSearch()}
            className="deal-search__input"
            maxLength={8}
          />
          <button onClick={handleDealSearch} className="deal-search__button">
            Search Deal
          </button>
        </div>
        {searchError && <div className="deal-search__error">{searchError}</div>}
      </div>

      {/* Quick Deal Buttons */}
      <div className="deals-dashboard__quick-access">
        <span className="quick-access__label">Quick Access:</span>
        <button
          className={`quick-access__btn ${selectedDealId === "45791720" ? "active" : ""}`}
          onClick={() => {
            setSelectedDealId("45791720");
            setInputDealId("45791720");
            setSearchError("");
          }}
        >
          Deal 45791720
        </button>
        <button
          className={`quick-access__btn ${selectedDealId === "44892156" ? "active" : ""}`}
          onClick={() => {
            setSelectedDealId("44892156");
            setInputDealId("44892156");
            setSearchError("");
          }}
        >
          Deal 44892156
        </button>
        <button
          className={`quick-access__btn ${selectedDealId === "46123789" ? "active" : ""}`}
          onClick={() => {
            setSelectedDealId("46123789");
            setInputDealId("46123789");
            setSearchError("");
          }}
        >
          Deal 46123789
        </button>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="deals-dashboard__analytics">
          <div className="analytics-card">
            <div className="analytics-card__value">{analytics.totalDeals}</div>
            <div className="analytics-card__label">Total Deals</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card__value">
              {formatCurrency(analytics.totalValue)}
            </div>
            <div className="analytics-card__label">Total Value</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card__value">
              {formatCurrency(analytics.averageDealValue)}
            </div>
            <div className="analytics-card__label">Average Deal</div>
          </div>
          <div className="analytics-card">
            <div className="analytics-card__value analytics-card__value--warning">
              {analytics?.expirationAlerts?.length}
            </div>
            <div className="analytics-card__label">Expiring Soon</div>
          </div>
        </div>
      )}

      {/* Deal Details */}
      {isLoading ? (
        <div className="deals-dashboard__loading">
          <div className="spinner"></div>
          <p>Loading deal data...</p>
        </div>
      ) : dealData ? (
        <div className="deal-details">
          {/* Deal Header */}
          <div className="deal-details__header">
            <div className="deal-details__info">
              <h3 className="deal-details__title">
                Deal {dealData?.deal?.dealId} v.{dealData?.deal?.version}
              </h3>
              <p className="deal-details__customer">{dealData?.deal?.customer}</p>
              <p className="deal-details__metadata">
                Expires: {formatDate(dealData?.deal?.endDate)}
                {dealData?.metadata?.isExpired ? (
                  <span className="deal-status deal-status--expired">
                    EXPIRED
                  </span>
                ) : (
                  <span className="deal-status deal-status--active">
                    {dealData?.metadata?.daysUntilExpiration} days remaining
                  </span>
                )}
              </p>
            </div>
            <div className="deal-details__summary">
              <div className="deal-summary">
                <div className="deal-summary__item">
                  <span className="deal-summary__label">Total Items:</span>
                  <span className="deal-summary__value">
                    {dealData?.metadata?.totalItems}
                  </span>
                </div>
                <div className="deal-summary__item">
                  <span className="deal-summary__label">Total Value:</span>
                  <span className="deal-summary__value">
                    {formatCurrency(dealData?.metadata?.totalValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deal Items Table */}
          <div className="deal-items">
            <h4 className="deal-items__title">Deal Items</h4>
            <table className="deal-items__table">
              <thead>
                <tr>
                  <th>Product Number</th>
                  <th>Description</th>
                  <th>Family</th>
                  <th>Remaining Qty</th>
                  <th>Dealer Net</th>
                  <th>List Price</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {dealData?.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="product-number">{item.productNumber}</td>
                    <td>{item.description || "N/A"}</td>
                    <td>
                      <span
                        className={`product-family product-family--${item?.productFamily?.toLowerCase()}`}
                      >
                        {item.productFamily}
                      </span>
                    </td>
                    <td className="text-right">{item.remainingQuantity}</td>
                    <td className="text-right">
                      {formatCurrency(item.dealerNetPrice)}
                    </td>
                    <td className="text-right">
                      {item.listPrice ? formatCurrency(item.listPrice) : "N/A"}
                    </td>
                    <td className="text-right">
                      {formatCurrency(
                        item.dealerNetPrice * item.remainingQuantity,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Disclaimer */}
          <div className="pricing-disclaimer">
            <p>
              <strong>Important:</strong> This quote is not to be used as a
              valid quote. Please reach out to{" "}
              <a href="mailto:InsightHPI@TDSYNNEX.com">
                InsightHPI@TDSYNNEX.com
              </a>{" "}
              for a formal quote if needed.
            </p>
            <p className="pricing-note">
              IPG products: Dealer net price × 1.04 | PSG products: Dealer net
              price (unchanged)
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="deals-dashboard__error">
          <p>Error loading deal: {error.message}</p>
        </div>
      ) : null}

      {/* Top Customers */}
      {analytics && analytics.topCustomers && (
        <div className="top-customers">
          <h4 className="top-customers__title">Top Customers by Value</h4>
          <div className="top-customers__list">
            {analytics?.topCustomers?.map((customer, index) => (
              <div key={index} className="customer-card">
                <div className="customer-card__name">{customer.name}</div>
                <div className="customer-card__stats">
                  <span className="customer-card__deals">
                    {customer.dealCount} deal{customer.dealCount > 1 ? "s" : ""}
                  </span>
                  <span className="customer-card__value">
                    {formatCurrency(customer.totalValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
