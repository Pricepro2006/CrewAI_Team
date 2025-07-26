# Free Tier Search Provider Rotation System

## Overview

Intelligent system to maximize free search API usage by rotating between providers and monitoring quotas.

## Free Tier Limits

### Search Providers

1. **Google Custom Search API**
   - 100 searches/day free
   - Resets: Daily at midnight PST
   - Good for: General web search

2. **Bing Web Search API**
   - 1,000 searches/month free
   - Resets: Monthly on billing date
   - Good for: General web search, better snippets

3. **Serper API**
   - 2,500 searches/month free
   - Resets: Monthly on signup date
   - Good for: Google results with structure

4. **Google Places API**
   - $200 credit/month ≈ 6,000 requests
   - Resets: Monthly
   - Good for: Business details (phone, address, hours)

5. **DuckDuckGo**
   - Unlimited free
   - No API key needed
   - Fallback option

## Implementation Architecture

```typescript
// Usage tracking database schema
interface ApiUsage {
  provider: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  count: number;
  lastReset: Date;
  limit: number;
  limitType: "daily" | "monthly";
}

// Provider configuration
interface SearchProvider {
  name: string;
  priority: number; // 1 = highest priority
  freeLimit: number;
  limitType: "daily" | "monthly";
  searchTypes: ("general" | "business" | "local")[];
  apiKey?: string;
  isAvailable: () => Promise<boolean>;
  search: (query: string) => Promise<SearchResult[]>;
}

// Smart router
class SearchProviderRouter {
  private providers: SearchProvider[];
  private usageTracker: UsageTracker;

  async search(
    query: string,
    type: "general" | "business",
  ): Promise<SearchResult[]> {
    // Get providers sorted by availability and priority
    const availableProviders = await this.getAvailableProviders(type);

    for (const provider of availableProviders) {
      try {
        // Check if within free tier
        if (await this.usageTracker.canUse(provider)) {
          const results = await provider.search(query);
          await this.usageTracker.recordUsage(provider);
          return results;
        }
      } catch (error) {
        // Log error and try next provider
        continue;
      }
    }

    // Fallback to DuckDuckGo
    return this.duckDuckGoFallback(query);
  }
}
```

## Usage Monitoring System

```typescript
class UsageTracker {
  private db: Database;

  async canUse(provider: SearchProvider): Promise<boolean> {
    const usage = await this.getCurrentUsage(provider);
    return usage.count < provider.freeLimit;
  }

  async getCurrentUsage(provider: SearchProvider): Promise<ApiUsage> {
    const now = new Date();
    const dateKey =
      provider.limitType === "daily"
        ? now.toISOString().split("T")[0]
        : now.toISOString().substring(0, 7);

    return await this.db.getUsage(provider.name, dateKey);
  }

  async recordUsage(provider: SearchProvider): Promise<void> {
    const usage = await this.getCurrentUsage(provider);
    usage.count += 1;
    await this.db.updateUsage(usage);

    // Alert if approaching limit
    if (usage.count >= usage.limit * 0.8) {
      await this.sendUsageAlert(provider, usage);
    }
  }

  // Daily cron job to reset counters
  async resetDailyCounters(): Promise<void> {
    const providers = await this.db.getDailyProviders();
    for (const provider of providers) {
      await this.db.resetUsage(provider, "daily");
    }
  }
}
```

## Priority Strategy

### For Business Searches (like irrigation specialists):

1. Google Places API (best data, 200 requests/day free)
2. Serper API (structured Google results, 83/day free)
3. Bing API (better snippets, 33/day free)
4. Google Search API (basic, 100/day free)
5. DuckDuckGo (unlimited but poor business data)

### For General Searches:

1. Serper API (best quality)
2. Google Search API
3. Bing API
4. DuckDuckGo

## Monitoring Dashboard

```typescript
// API endpoint for usage stats
app.get("/api/search/usage", async (req, res) => {
  const usage = await usageTracker.getAllProviderStats();
  res.json({
    providers: usage.map((u) => ({
      name: u.provider,
      used: u.count,
      limit: u.limit,
      percentage: (u.count / u.limit) * 100,
      resetsIn: u.timeUntilReset,
      status:
        u.count >= u.limit
          ? "exhausted"
          : u.count >= u.limit * 0.8
            ? "warning"
            : "healthy",
    })),
  });
});
```

## Implementation Steps

1. **Database Setup**
   - SQLite table for usage tracking
   - Indexes on provider, date fields

2. **Provider Adapters**
   - Implement consistent interface for each provider
   - Handle API-specific response formats

3. **Usage Monitoring**
   - Background job for counter resets
   - Real-time usage tracking
   - Alert system for approaching limits

4. **Fallback Logic**
   - Graceful degradation to next provider
   - Always fall back to DuckDuckGo

5. **Configuration**
   - Environment variables for API keys
   - Provider priority configuration
   - Limit override capabilities

## Cost Prevention

- **Hard stops** at free tier limits
- **No API calls** if limit reached
- **Daily reports** of usage patterns
- **Alerts** at 80% usage
- **Automatic provider switching**
- **Never store payment info**

## Example Usage

```typescript
// In ResearchAgent
const searchTool = new MultiProviderSearchTool({
  providers: [
    new GooglePlacesProvider({ apiKey: process.env.GOOGLE_PLACES_KEY }),
    new SerperProvider({ apiKey: process.env.SERPER_KEY }),
    new BingProvider({ apiKey: process.env.BING_KEY }),
    new GoogleSearchProvider({ apiKey: process.env.GOOGLE_SEARCH_KEY }),
    new DuckDuckGoProvider(), // No key needed
  ],
  usageDb: "./data/api-usage.db",
});

// Automatically uses best available provider
const results = await searchTool.search(
  "irrigation specialists Spartanburg SC",
  { type: "business" },
);
```
