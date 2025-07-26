# SearXNG Self-Hosting on HP Microserver

## What is SearXNG?

SearXNG is a free, open-source metasearch engine that aggregates results from 70+ search engines without storing your searches. It acts as a proxy between you and search engines like Google, Bing, DuckDuckGo, etc.

## System Requirements

### Minimum Requirements

- **CPU**: 1 core (2+ recommended)
- **RAM**: 512MB minimum (1GB recommended)
- **Storage**: 100MB for application + logs
- **OS**: Linux (Ubuntu/Debian preferred)
- **Network**: Static IP or dynamic DNS

### HP Microserver Compatibility

Most HP Microserver models (Gen8, Gen10, Gen10+) exceed these requirements, making them perfect hosts.

## Installation Methods

### Method 1: Docker (Recommended)

```bash
# Install Docker if not already installed
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Create directory for SearXNG
mkdir -p /opt/searxng
cd /opt/searxng

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.7'

services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://${SEARXNG_HOSTNAME:-localhost}/
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    logging:
      driver: "json-file"
      options:
        max-size: "1m"
        max-file: "1"

  # Optional: Redis for caching
  redis:
    image: redis:alpine
    container_name: searxng-redis
    restart: unless-stopped
    command: redis-server --save 30 1 --loglevel warning
    volumes:
      - ./redis:/data
EOF

# Start SearXNG
docker-compose up -d
```

### Method 2: Direct Installation

```bash
# Install dependencies
sudo apt update
sudo apt install -y python3-dev python3-babel python3-venv \
    uwsgi uwsgi-plugin-python3 git build-essential \
    libxslt-dev zlib1g-dev libffi-dev libssl-dev

# Create searxng user
sudo useradd -r -s /bin/bash -d /usr/local/searxng searxng

# Clone repository
sudo -u searxng git clone https://github.com/searxng/searxng.git /usr/local/searxng

# Install Python dependencies
cd /usr/local/searxng
sudo -u searxng python3 -m venv venv
sudo -u searxng ./venv/bin/pip install -r requirements.txt

# Configure
sudo -u searxng cp searxng/settings.yml.example searxng/settings.yml
```

## Configuration for Business Searches

Create custom settings in `searxng/settings.yml`:

```yaml
general:
  instance_name: "Private Search"
  contact_url: false
  enable_metrics: true

search:
  # Increase timeout for better results
  timeout: 10.0
  max_request_timeout: 15.0

  # Default search settings
  default_lang: "en-US"
  default_locale: "en"
  autocomplete: "google"

engines:
  # Enable business-friendly engines
  - name: google
    engine: google
    shortcut: g
    use_mobile_ui: false

  - name: bing
    engine: bing
    shortcut: bi

  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg

  # Business-specific engines
  - name: google maps
    engine: google_maps
    shortcut: gm

  - name: yelp
    engine: yelp
    shortcut: yp
    categories: local

  - name: openstreetmap
    engine: openstreetmap
    shortcut: osm

# Enable JSON output for API usage
server:
  secret_key: "GENERATE_A_RANDOM_KEY_HERE"
  limiter: false # Disable rate limiting for internal use
  image_proxy: true

ui:
  default_locale: "en"
  query_in_title: true
  infinite_scroll: true

outgoing:
  request_timeout: 10.0
  useragent_suffix: ""

# Result processing
result_proxy:
  url: null
  proxify_results: false
```

## API Integration

SearXNG provides a JSON API perfect for programmatic access:

```typescript
// Example integration
class SearXNGProvider implements SearchProvider {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8888") {
    this.baseUrl = baseUrl;
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      engines: options?.engines || "google,bing,duckduckgo",
      categories: options?.category || "general",
      pageno: "1",
      time_range: options?.timeRange || "",
      language: "en-US",
      safesearch: "0",
    });

    const response = await fetch(`${this.baseUrl}/search?${params}`);
    const data = await response.json();

    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      engine: r.engine,
      score: r.score,
      // Additional fields for business results
      address: r.address,
      phone: r.phone,
      hours: r.openingHours,
    }));
  }
}
```

## Costs

### One-Time Costs

- **None** - SearXNG is completely free and open source

### Recurring Costs

- **Electricity**: ~10-20W additional load (≈ $2-4/month)
- **Internet bandwidth**: Minimal (compressed text)
- **No API costs**: Bypasses search engine APIs

### Maintenance

- **Updates**: Monthly Docker image updates (automated)
- **Monitoring**: Basic health checks
- **Logs**: Rotate monthly to save space

## Security Considerations

1. **Firewall Rules**

   ```bash
   # Only allow local network access
   sudo ufw allow from 192.168.1.0/24 to any port 8888
   ```

2. **Reverse Proxy** (optional)

   ```nginx
   server {
     listen 80;
     server_name search.local;

     location / {
       proxy_pass http://localhost:8888;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

3. **Access Control**
   - Use firewall rules
   - Or implement basic auth in reverse proxy
   - Or use SearXNG's built-in limiter

## Performance Optimization

1. **Enable Redis caching** (included in docker-compose)
2. **Limit enabled search engines** to reduce latency
3. **Adjust timeouts** based on network speed
4. **Use local DNS caching**

## Monitoring

```bash
# Health check endpoint
curl http://localhost:8888/healthz

# Stats endpoint (if enabled)
curl http://localhost:8888/stats

# Docker logs
docker logs -f searxng
```

## Integration with CrewAI

```typescript
// In your search tool configuration
const searchProviders = [
  // Try SearXNG first (unlimited, self-hosted)
  new SearXNGProvider("http://microserver.local:8888"),

  // Fall back to API-based services if needed
  new GooglePlacesProvider(/* with usage limits */),

  // Final fallback
  new DuckDuckGoProvider(),
];
```

## Advantages for Your Use Case

1. **Unlimited searches** - No daily/monthly limits
2. **Better results** - Aggregates from multiple engines
3. **Business data** - Can search Google Maps, Yelp, etc.
4. **Privacy** - No tracking or API keys needed
5. **Customizable** - Add specialized search engines
6. **Fast** - Local network latency only

## Quick Start Commands

```bash
# On your HP Microserver:
wget https://raw.githubusercontent.com/searxng/searxng-docker/master/docker-compose.yaml
docker-compose up -d

# Test it's working:
curl "http://localhost:8888/search?q=irrigation+specialists&format=json"

# View logs:
docker-compose logs -f
```

Your HP Microserver is perfect for this - it can run 24/7 with minimal power consumption and handle thousands of searches per day.
