# Business Search API

## Overview

The Business Search API provides enhanced local business search capabilities with real-time data, caching, and intelligent query optimization. This API is designed to return actionable business information including contact details, hours, and ratings.

## Endpoints

### Search Businesses

Perform an enhanced search for local businesses.

```http
POST /api/business/search
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "query": "irrigation specialists in Naples, FL",
  "options": {
    "maxResults": 10,
    "includeRatings": true,
    "includeHours": true,
    "radius": 25 // miles
  }
}
```

#### Response

```json
{
  "results": {
    "businesses": [
      {
        "name": "ABC Irrigation Services",
        "phone": "(239) 555-0123",
        "address": "123 Main St, Naples, FL 34102",
        "website": "https://abcirrigation.com",
        "rating": 4.8,
        "reviewCount": 156,
        "hours": {
          "monday": "8:00 AM - 5:00 PM",
          "tuesday": "8:00 AM - 5:00 PM",
          "wednesday": "8:00 AM - 5:00 PM",
          "thursday": "8:00 AM - 5:00 PM",
          "friday": "8:00 AM - 5:00 PM",
          "saturday": "9:00 AM - 2:00 PM",
          "sunday": "Closed"
        },
        "description": "Professional irrigation system installation and repair",
        "categories": ["Irrigation", "Landscaping", "Sprinkler Systems"],
        "verified": true,
        "distance": 2.5 // miles from search location
      }
    ],
    "totalResults": 24,
    "searchLocation": {
      "city": "Naples",
      "state": "FL",
      "coordinates": {
        "lat": 26.1420,
        "lng": -81.7948
      }
    }
  },
  "query": {
    "original": "irrigation specialists in Naples, FL",
    "parsed": {
      "serviceType": "irrigation",
      "location": "Naples, FL",
      "intent": "find_service"
    },
    "enhanced": true
  },
  "metadata": {
    "cached": false,
    "responseTime": 245, // milliseconds
    "dataSource": "websearch",
    "timestamp": "2025-01-20T12:00:00Z"
  }
}
```

### Get Business Details

Retrieve detailed information about a specific business.

```http
GET /api/business/:id
Authorization: Bearer <token>
```

#### Response

```json
{
  "business": {
    "id": "biz-123",
    "name": "ABC Irrigation Services",
    "phone": "(239) 555-0123",
    "alternatePhone": "(239) 555-0124",
    "address": {
      "street": "123 Main St",
      "city": "Naples",
      "state": "FL",
      "zipCode": "34102",
      "country": "US"
    },
    "website": "https://abcirrigation.com",
    "email": "info@abcirrigation.com",
    "rating": 4.8,
    "reviewCount": 156,
    "priceRange": "$$",
    "hours": {
      "regular": {
        "monday": "8:00 AM - 5:00 PM",
        "tuesday": "8:00 AM - 5:00 PM",
        "wednesday": "8:00 AM - 5:00 PM",
        "thursday": "8:00 AM - 5:00 PM",
        "friday": "8:00 AM - 5:00 PM",
        "saturday": "9:00 AM - 2:00 PM",
        "sunday": "Closed"
      },
      "special": [
        {
          "date": "2025-12-25",
          "hours": "Closed",
          "note": "Christmas Day"
        }
      ]
    },
    "services": [
      "Irrigation System Installation",
      "Sprinkler Repair",
      "Drip Irrigation",
      "Smart Controller Installation",
      "Seasonal Maintenance"
    ],
    "amenities": [
      "Free Estimates",
      "Emergency Service",
      "Licensed & Insured",
      "Warranty Available"
    ],
    "photos": [
      {
        "url": "https://example.com/photo1.jpg",
        "caption": "Recent installation project"
      }
    ],
    "socialMedia": {
      "facebook": "https://facebook.com/abcirrigation",
      "instagram": "@abcirrigation"
    },
    "verificationStatus": {
      "verified": true,
      "lastVerified": "2025-01-15T10:00:00Z",
      "source": "claimed_listing"
    }
  }
}
```

### Suggest Service Types

Get service type suggestions based on partial input.

```http
GET /api/business/services/suggest?q=irrig
Authorization: Bearer <token>
```

#### Response

```json
{
  "suggestions": [
    {
      "service": "irrigation",
      "displayName": "Irrigation Specialists",
      "aliases": ["sprinkler", "lawn watering", "irrigation system"]
    },
    {
      "service": "irrigation_repair",
      "displayName": "Irrigation Repair Services",
      "aliases": ["sprinkler repair", "irrigation fix"]
    }
  ]
}
```

### Get Nearby Locations

Get nearby cities or areas for expanded search.

```http
GET /api/business/locations/nearby?location=Naples,FL&radius=50
Authorization: Bearer <token>
```

#### Response

```json
{
  "locations": [
    {
      "city": "Bonita Springs",
      "state": "FL",
      "distance": 15.2,
      "population": 57755
    },
    {
      "city": "Marco Island",
      "state": "FL", 
      "distance": 20.1,
      "population": 17963
    },
    {
      "city": "Fort Myers",
      "state": "FL",
      "distance": 35.8,
      "population": 86395
    }
  ],
  "searchCenter": {
    "city": "Naples",
    "state": "FL",
    "coordinates": {
      "lat": 26.1420,
      "lng": -81.7948
    }
  }
}
```

### Business Categories

Get available business categories and subcategories.

```http
GET /api/business/categories
Authorization: Bearer <token>
```

#### Response

```json
{
  "categories": [
    {
      "id": "home_services",
      "name": "Home Services",
      "subcategories": [
        {
          "id": "plumbing",
          "name": "Plumbing",
          "keywords": ["plumber", "pipe repair", "drain cleaning"]
        },
        {
          "id": "electrical",
          "name": "Electrical",
          "keywords": ["electrician", "wiring", "electrical repair"]
        },
        {
          "id": "irrigation",
          "name": "Irrigation",
          "keywords": ["sprinkler", "irrigation system", "lawn watering"]
        }
      ]
    }
  ]
}
```

### Clear Search Cache

Clear cached search results (admin only).

```http
POST /api/business/cache/clear
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "pattern": "irrigation*", // Optional pattern to clear specific entries
  "all": false // Clear entire cache
}
```

### Get Search Analytics

Retrieve search analytics and popular queries.

```http
GET /api/business/analytics
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 7d | Time period (1d, 7d, 30d) |
| limit | integer | 10 | Number of results |

#### Response

```json
{
  "analytics": {
    "totalSearches": 4567,
    "uniqueUsers": 892,
    "cacheHitRate": 0.65,
    "averageResponseTime": 187, // milliseconds
    "topQueries": [
      {
        "query": "plumber near me",
        "count": 234,
        "avgResultCount": 12
      },
      {
        "query": "irrigation Naples FL",
        "count": 189,
        "avgResultCount": 8
      }
    ],
    "topServiceTypes": [
      {
        "service": "plumbing",
        "count": 567
      },
      {
        "service": "electrical",
        "count": 445
      }
    ],
    "topLocations": [
      {
        "location": "Naples, FL",
        "count": 789
      },
      {
        "location": "Fort Myers, FL",
        "count": 456
      }
    ],
    "searchesByHour": [
      {
        "hour": 9,
        "count": 234
      }
    ]
  },
  "period": "7d",
  "generatedAt": "2025-01-20T12:00:00Z"
}
```

## Feature Flags

Control business search features dynamically.

```http
GET /api/business/features
Authorization: Bearer <token>
```

#### Response

```json
{
  "features": {
    "enableBusinessSearch": true,
    "enableCaching": true,
    "cacheTimeoutMinutes": 60,
    "maxSearchResults": 10,
    "enableRateLimiting": true,
    "rateLimitPerMinute": 100,
    "enableDebugLogging": false,
    "enableEnhancedSearch": true,
    "enableNearbySearch": true
  }
}
```

## Error Handling

### Common Errors

```json
{
  "error": {
    "code": "LOCATION_REQUIRED",
    "message": "Location is required for business search",
    "details": {
      "suggestion": "Include city, state or zip code in your query"
    }
  }
}
```

Error Codes:
- `LOCATION_REQUIRED`: No location found in query
- `SERVICE_TYPE_UNKNOWN`: Could not identify service type
- `RATE_LIMITED`: Too many search requests
- `CACHE_ERROR`: Cache operation failed
- `SEARCH_FAILED`: External search API error

## Caching

Business search results are cached for improved performance:

- Default TTL: 60 minutes
- Stale-while-revalidate: Returns cached data while fetching fresh results
- Cache key includes: service type, location, search options
- Cache invalidation: Automatic after TTL or manual clear

## Rate Limiting

Business search endpoints have specific limits:

- Search: 100 requests per 15 minutes per user
- Details: 200 requests per 15 minutes per user
- Analytics: 20 requests per hour per user

## Code Examples

### JavaScript/TypeScript

```typescript
// Search for businesses
const response = await fetch('http://localhost:3000/api/business/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'emergency plumber in Miami, FL',
    options: {
      maxResults: 5,
      includeRatings: true,
      includeHours: true
    }
  })
});

const { results } = await response.json();

// Display results
results.businesses.forEach(business => {
  console.log(`${business.name} - ${business.phone}`);
  console.log(`Rating: ${business.rating}/5 (${business.reviewCount} reviews)`);
  console.log(`Address: ${business.address}`);
  console.log('---');
});
```

### Python

```python
import requests

# Search with options
response = requests.post(
    'http://localhost:3000/api/business/search',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'query': 'landscaping services 33139',
        'options': {
            'maxResults': 10,
            'radius': 10,
            'includeRatings': True
        }
    }
)

data = response.json()
businesses = data['results']['businesses']

# Filter by rating
high_rated = [b for b in businesses if b.get('rating', 0) >= 4.5]
```

### React Component

```tsx
function BusinessSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchBusinesses = async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/business/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      setResults(data.results.businesses);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SearchInput onSearch={searchBusinesses} />
      {loading && <Spinner />}
      <BusinessList businesses={results} />
    </div>
  );
}
```

## Best Practices

1. **Include location**: Always include city/state or zip code
2. **Use caching**: Results are cached for 60 minutes by default
3. **Be specific**: More specific queries return better results
4. **Handle no results**: Provide fallback UI for empty results
5. **Show loading states**: Searches may take 1-2 seconds
6. **Respect rate limits**: Implement client-side throttling
7. **Verify critical info**: Phone numbers and hours may change

## Integration Guide

### 1. Enable Feature

```javascript
// Check if business search is enabled
const features = await fetch('/api/business/features', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

if (features.enableBusinessSearch) {
  // Show business search UI
}
```

### 2. Build Search UI

```javascript
// Autocomplete for service types
const suggestions = await fetch(
  `/api/business/services/suggest?q=${input}`,
  { headers: { 'Authorization': `Bearer ${token}` }}
).then(r => r.json());

// Location detection or input
const userLocation = await getUserLocation();
```

### 3. Display Results

```javascript
// Format phone numbers
const formatPhone = (phone) => {
  // Already formatted from API
  return phone;
};

// Show business hours
const isOpenNow = (hours) => {
  const now = new Date();
  const day = now.toLocaleLowerCase();
  const currentHours = hours[day];
  // Parse and check if currently open
};
```

## Webhooks

Configure webhooks for search events:

```json
{
  "url": "https://your-app.com/webhook",
  "events": [
    "business.search_performed",
    "business.no_results",
    "business.cache_hit"
  ]
}
```