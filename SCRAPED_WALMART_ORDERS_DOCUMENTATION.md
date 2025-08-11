# Scraped Walmart Orders Documentation

## Overview
This document provides comprehensive documentation of all scraped Walmart order JSON files, collected to rebuild the ~2800 product dataset that was removed from the repository on July 25, 2025.

**Total Orders Scraped:** 25  
**Data Collection Period:** March 24, 2025 - August 4, 2025  
**Order Numbers Range:** 200012908834425 - 200013654445614  

## File Inventory and Summary

### All Scraped Order Files
1. `scraped_order_200012908834425.json`
2. `scraped_order_200012925919989.json` - Mar 30, 2025 (Curbside pickup, 17 products + 1 unavailable)
3. `scraped_order_200012935923125.json`
4. `scraped_order_200012989986426.json`
5. `scraped_order_200013025887822.json`
6. `scraped_order_200013037804500.json` - Mar 24, 2025 (Delivery from store, 22 products + 6 unavailable)
7. `scraped_order_200013050318864.json` - Apr 6, 2025 (Curbside pickup, 9 products)
8. `scraped_order_200013098917803.json`
9. `scraped_order_200013145772724.json`
10. `scraped_order_200013146737353.json`
11. `scraped_order_200013170988638.json` - Apr 10, 2025 (Delivery, 1 product - patio umbrella)
12. `scraped_order_200013172333186.json`
13. `scraped_order_200013209834170.json`
14. `scraped_order_200013252938674.json`
15. `scraped_order_200013332944390.json`
16. `scraped_order_200013337428747.json`
17. `scraped_order_200013360253011.json`
18. `scraped_order_200013366213450.json`
19. `scraped_order_200013459952714.json`
20. `scraped_order_200013482359257.json`
21. `scraped_order_200013547112029.json`
22. `scraped_order_200013565586481.json`
23. `scraped_order_200013576203404.json`
24. `scraped_order_200013599302087.json`
25. `scraped_order_200013654445614.json` - Aug 4, 2025 (Curbside pickup, 14 products)

## Data Structure Analysis

### JSON Schema
Each scraped order follows this consistent structure:

```json
{
  "orderNumber": "string",           // 15-digit order ID
  "orderDate": "string",            // Format: "Mar 24, 2025"
  "deliveryDate": "string",         // Optional
  "pickupDate": "string",           // Optional  
  "customerName": "string",         // Usually "Nicholas Paul" or "Austin/Jessi Hilton"
  "deliveryAddress": "string",      // Full address for deliveries
  "storeLocation": "string",        // Store name
  "storeAddress": "string",         // Optional full store address
  "fulfillmentType": "string",      // "Delivery", "Pickup - Curbside", etc.
  "pickupPerson": "string",         // Optional for pickups
  "orderTotal": "string",           // Total with $ symbol
  "subtotal": "string",             // Optional
  "tax": "string",                  // Optional
  "deliveryFee": "string",          // Optional
  "driverTip": "string",            // Optional for deliveries
  "paymentMethod": "string|array",  // Payment details
  "itemsReceived": "number",        // Count of received products
  "itemsUnavailable": "number",     // Optional count of unavailable
  "totalItems": "number",           // Optional total ordered
  "products": [...],               // Array of product objects
  "unavailableProducts": [...]     // Optional array of unavailable items
}
```

### Product Object Structure
```json
{
  "name": "string",                 // Full product name
  "price": "string",               // Price with $ symbol
  "originalPrice": "string",       // Optional original price
  "quantity": "string",            // Quantity as string
  "unitPrice": "string",           // Unit pricing info
  "pricePerEach": "string",        // Optional for multi-quantity
  "savings": "string",             // Optional savings amount
  "type": "string",                // "shopped", "substitution", "weight-adjusted", "delivered", "unavailable", "refunded"
  "url": "string",                 // Walmart product URL
  "specifications": "string",       // Optional product specs
  "brand": "string",               // Optional brand name
  "size": "string",                // Optional size info
  "status": "string",              // For unavailable items
  "refundDate": "string",          // For refunded items
  "note": "string"                 // Optional notes
}
```

## Key Data Points Extracted

### Store Locations
- **Charleston Supercenter** - 1231 FOLLY RD, Charleston, SC 29412
- **Mount Pleasant Supercenter** - 1481 N HIGHWAY 17, Mount pleasant, SC 29464

### Fulfillment Types
- **Delivery from store** - Home delivery with driver tip
- **Delivery** - Standard shipping delivery  
- **Pickup - Curbside** - Customer curbside pickup
- **Pickup** - In-store pickup

### Product Categories Observed
- **Produce:** Fresh bananas, cucumbers, carrots, lettuce, grapes, bell peppers, corn
- **Dairy:** Eggs, cheese, yogurt
- **Meat:** Chicken thighs, bacon
- **Pantry:** Pasta, seasonings, sauces, crackers, snacks
- **Frozen:** Ice cream, frozen foods
- **Household:** Cleaning supplies, detergent pods
- **Personal Care:** Body sponges
- **Outdoor:** Patio umbrellas

### Product Types
- **shopped** - Regular items picked by shopper
- **substitution** - Replacement items when original unavailable
- **weight-adjusted** - Fresh produce with final weights
- **delivered** - Items successfully delivered
- **unavailable** - Out of stock items
- **refunded** - Items that were refunded

## Pricing Data Points

### Price Ranges Observed
- **Low:** $0.96 (Fresh cucumber each)
- **Medium:** $3.48-$4.98 (Salad kits, snacks)
- **High:** $29.99 (Patio umbrella)

### Unit Pricing Formats
- **Per ounce:** "19.8¢/oz", "40.6¢/oz"
- **Per pound:** "54.0¢/lb", "$7.92/lb"  
- **Per each:** "$0.96 ea", "$4.83 ea"

### Savings Tracking
Many products show original prices and savings:
- Example: Grapes $4.50 (was $5.63, saved $1.13)
- Walmart+ delivery fee savings tracked

## Geographic Data

### Customer Addresses
- **278 wycliff dr, Spartanburg, SC 29301**
- **418 Fernwood Dr, Seneca, SC 29678**

### Store Coverage Area
- Charleston, SC area
- Mount Pleasant, SC area

## Next Steps for Database Import

### Product Deduplication Strategy
Products with identical names should be merged with:
- Price history tracking over time
- Order frequency counting
- Store location associations

### Key Metrics to Track
1. **Price variations** over time for same products
2. **Availability patterns** by store location
3. **Seasonal trends** in product ordering
4. **Substitution patterns** when items unavailable
5. **Customer preference analysis** based on repeat orders

### Database Schema Requirements
- **Products table** with unique product identification
- **Orders table** with order metadata
- **Order_items table** linking products to orders
- **Price_history table** for tracking price changes
- **Store_locations table** for geographic analysis
- **Product_categories table** for classification

## Data Quality Notes

### Consistent Fields
- Order numbers (15-digit format)
- Product names (detailed descriptions)
- Pricing information (standardized $ format)
- Store locations (consistent naming)

### Variable Fields
- Date formats consistent but vary in presentation
- Payment methods (sometimes string, sometimes array)
- Customer names (varies by account/recipient)
- Address formats (some more complete than others)

### Missing Data Patterns
- Some products lack URL references
- Original prices not always available
- Specifications missing for many products
- Tax amounts sometimes missing

## Estimated Dataset Value

**Total Products Estimated:** 200-300 unique products across 25 orders  
**Total Order Items:** ~350-400 individual line items  
**Price History Data Points:** Substantial for frequently ordered items  
**Geographic Coverage:** South Carolina (2 major metro areas)  
**Time Coverage:** 4+ months of purchase history  

This dataset provides excellent foundation for:
- Product pricing analysis
- Customer behavior insights  
- Store performance comparison
- Seasonal trend identification
- Inventory management optimization