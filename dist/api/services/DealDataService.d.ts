/**
 * Deal Data Service
 * Handles deal data operations with real database queries and integrations
 */
export interface Deal {
    id: string;
    dealId: string;
    customer: string;
    endDate: string;
    version: number;
    status: 'active' | 'expired' | 'pending';
    totalValue?: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
}
export interface DealItem {
    id: string;
    dealId: string;
    productNumber: string;
    productFamily: string;
    remainingQuantity: number;
    dealerNetPrice: number;
    listPrice?: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DealResponse {
    deal: Deal;
    items: DealItem[];
    metadata: {
        totalItems: number;
        totalValue: number;
        daysUntilExpiration: number;
        isExpired: boolean;
    };
}
export declare class DealDataService {
    private db;
    private static instance;
    constructor(dbPath?: string);
    private initializeDatabase;
    private seedSampleData;
    /**
     * Get a deal by deal ID with all items
     */
    getDeal(dealId: string): Promise<DealResponse | null>;
    /**
     * Get deal item by product number and deal ID
     */
    getDealItem(dealId: string, productNumber: string): Promise<DealItem | null>;
    /**
     * Calculate pricing with IPG/PSG logic
     */
    calculatePrice(dealerNetPrice: number, productFamily: string): number;
    /**
     * Get singleton instance
     */
    static getInstance(): DealDataService;
    close(): Promise<void>;
}
//# sourceMappingURL=DealDataService.d.ts.map