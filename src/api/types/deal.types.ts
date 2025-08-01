/**
 * Deal Types - Type definitions for deal data
 */

export interface Deal {
  id: string;
  deal_id: string;
  customer_name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  items?: DealItem[];
  created_at?: string;
  updated_at?: string;
}

export interface DealItem {
  id: string;
  deal_id: string;
  part_number: string;
  description?: string;
  quantity: number;
  unit_price: number;
  dealer_net_price: number;
  msrp?: number;
  product_family?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DealSearchParams {
  dealId?: string;
  customerId?: string;
  customerName?: string;
  partNumber?: string;
  productFamily?: string;
  status?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface DealSearchResult {
  deals: Deal[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DealAnalytics {
  totalDeals: number;
  activeDeals: number;
  expiringDeals: number;
  totalValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    dealCount: number;
    totalValue: number;
  }>;
  topProducts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    revenue: number;
  }>;
}
