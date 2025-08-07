#!/usr/bin/env tsx
/**
 * Real-time Load Test Monitoring Dashboard
 * Displays live metrics during load testing
 */

import { EventEmitter } from 'events';
import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';

const execAsync = promisify(exec);

interface ServiceMetrics {
  service: string;
  requests: number;
  errors: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  throughput: number;
  cpu: number;
  memory: number;
  status: 'healthy' | 'degraded' | 'down';
}

interface SystemMetrics {
  timestamp: number;
  services: ServiceMetrics[];
  overall: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseTime: number;
    throughput: number;
    activeSessions: number;
  };
  resources: {
    cpu: number;
    memory: number;
    diskIO: number;
    networkIO: number;
  };
}

class MonitoringDashboard extends EventEmitter {
  private screen: any;
  private grid: any;
  private widgets: {
    responseTimeChart?: any;
    throughputChart?: any;
    errorRateGauge?: any;
    cpuGauge?: any;
    memoryGauge?: any;
    servicesTable?: any;
    logsBox?: any;
    alertsBox?: any;
  } = {};
  
  private metrics: SystemMetrics[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeScreen();
    this.createWidgets();
    this.startMonitoring();
  }

  private initializeScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Grocery Agent Load Test Monitor'
    });

    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Quit on Escape, q, or Control-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });
  }

  private createWidgets() {
    // Response time line chart (top left)
    this.widgets.responseTimeChart = this.grid.set(0, 0, 4, 6, contrib.line, {
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      label: 'Response Time (ms)',
      showLegend: true
    });

    // Throughput chart (top right)
    this.widgets.throughputChart = this.grid.set(0, 6, 4, 6, contrib.line, {
      style: {
        line: 'cyan',
        text: 'green',
        baseline: 'black'
      },
      label: 'Throughput (req/s)',
      showLegend: true
    });

    // Error rate gauge (middle left)
    this.widgets.errorRateGauge = this.grid.set(4, 0, 2, 3, contrib.gauge, {
      label: 'Error Rate',
      stroke: 'green',
      fill: 'white',
      percent: 0
    });

    // CPU gauge (middle center)
    this.widgets.cpuGauge = this.grid.set(4, 3, 2, 3, contrib.gauge, {
      label: 'CPU Usage',
      stroke: 'cyan',
      fill: 'white',
      percent: 0
    });

    // Memory gauge (middle right)
    this.widgets.memoryGauge = this.grid.set(4, 6, 2, 3, contrib.gauge, {
      label: 'Memory Usage',
      stroke: 'magenta',
      fill: 'white',
      percent: 0
    });

    // Services status table (middle bottom)
    this.widgets.servicesTable = this.grid.set(6, 0, 3, 12, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Service Status',
      width: '100%',
      height: '100%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 3,
      columnWidth: [15, 10, 10, 15, 15, 10, 10, 10]
    });

    // Logs box (bottom left)
    this.widgets.logsBox = this.grid.set(9, 0, 3, 8, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: 'Test Logs'
    });

    // Alerts box (bottom right)
    this.widgets.alertsBox = this.grid.set(9, 8, 3, 4, blessed.box, {
      label: 'Alerts',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'red'
        }
      }
    });

    this.screen.render();
  }

  private async startMonitoring() {
    this.updateInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Keep only last 60 data points
        if (this.metrics.length > 60) {
          this.metrics.shift();
        }

        this.updateDashboard(metrics);
        this.checkAlerts(metrics);
      } catch (error) {
        this.log(`Error collecting metrics: ${error.message}`, 'error');
      }
    }, 1000); // Update every second
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();
    
    // Collect service metrics
    const services = await this.collectServiceMetrics();
    
    // Collect system resources
    const resources = await this.collectResourceMetrics();
    
    // Calculate overall metrics
    const overall = this.calculateOverallMetrics(services);

    return {
      timestamp,
      services,
      overall,
      resources
    };
  }

  private async collectServiceMetrics(): Promise<ServiceMetrics[]> {
    const services = ['nlp', 'pricing', 'matching', 'cache', 'queue', 'analytics'];
    const metrics: ServiceMetrics[] = [];

    for (const service of services) {
      try {
        // Get metrics from Prometheus or service endpoint
        const serviceMetrics = await this.getServiceMetrics(service);
        metrics.push(serviceMetrics);
      } catch (error) {
        metrics.push({
          service,
          requests: 0,
          errors: 0,
          avgResponseTime: 0,
          p95ResponseTime: 0,
          throughput: 0,
          cpu: 0,
          memory: 0,
          status: 'down'
        });
      }
    }

    return metrics;
  }

  private async getServiceMetrics(service: string): Promise<ServiceMetrics> {
    // Try to get metrics from service's metrics endpoint
    const port = this.getServicePort(service);
    
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/metrics`, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const metrics = this.parsePrometheusMetrics(data, service);
            resolve(metrics);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(1000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  private parsePrometheusMetrics(data: string, service: string): ServiceMetrics {
    // Parse Prometheus format metrics
    const lines = data.split('\n');
    const metrics: any = {};
    
    lines.forEach(line => {
      if (line.startsWith('#') || !line.trim()) return;
      
      const match = line.match(/^(\w+)(?:{[^}]*})?\s+(.+)$/);
      if (match) {
        const [, name, value] = match;
        metrics[name] = parseFloat(value);
      }
    });

    return {
      service,
      requests: metrics.http_requests_total || 0,
      errors: metrics.http_errors_total || 0,
      avgResponseTime: metrics.http_request_duration_seconds_sum 
        ? (metrics.http_request_duration_seconds_sum / metrics.http_request_duration_seconds_count) * 1000
        : 0,
      p95ResponseTime: metrics.http_request_duration_seconds_p95 
        ? metrics.http_request_duration_seconds_p95 * 1000
        : 0,
      throughput: metrics.http_requests_per_second || 0,
      cpu: metrics.process_cpu_percent || 0,
      memory: metrics.process_memory_bytes 
        ? (metrics.process_memory_bytes / 1024 / 1024) // Convert to MB
        : 0,
      status: this.determineServiceStatus(metrics)
    };
  }

  private determineServiceStatus(metrics: any): 'healthy' | 'degraded' | 'down' {
    if (!metrics.http_requests_total) return 'down';
    
    const errorRate = metrics.http_errors_total / metrics.http_requests_total;
    if (errorRate > 0.1) return 'down';
    if (errorRate > 0.05) return 'degraded';
    
    return 'healthy';
  }

  private getServicePort(service: string): number {
    const ports = {
      nlp: 3001,
      pricing: 3002,
      matching: 3003,
      cache: 3004,
      queue: 3005,
      analytics: 3006
    };
    return ports[service] || 3000;
  }

  private async collectResourceMetrics(): Promise<any> {
    try {
      // Get CPU usage
      const cpuResult = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      const cpu = parseFloat(cpuResult.stdout.trim());

      // Get memory usage
      const memResult = await execAsync("free -m | awk 'NR==2{printf \"%.1f\", $3*100/$2}'");
      const memory = parseFloat(memResult.stdout.trim());

      // Get disk I/O
      const diskResult = await execAsync("iostat -x 1 2 | tail -n +4 | awk '{sum+=$14} END {print sum/NR}'");
      const diskIO = parseFloat(diskResult.stdout.trim()) || 0;

      // Get network I/O
      const netResult = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens' | awk '{print $2+$10}'");
      const networkIO = parseInt(netResult.stdout.trim()) || 0;

      return { cpu, memory, diskIO, networkIO };
    } catch (error) {
      return { cpu: 0, memory: 0, diskIO: 0, networkIO: 0 };
    }
  }

  private calculateOverallMetrics(services: ServiceMetrics[]): any {
    const totalRequests = services.reduce((sum, s) => sum + s.requests, 0);
    const totalErrors = services.reduce((sum, s) => sum + s.errors, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    const responseTimes = services.filter(s => s.avgResponseTime > 0).map(s => s.avgResponseTime);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const throughput = services.reduce((sum, s) => sum + s.throughput, 0);
    const activeSessions = services.filter(s => s.status !== 'down').length;

    return {
      totalRequests,
      totalErrors,
      errorRate,
      avgResponseTime,
      throughput,
      activeSessions
    };
  }

  private updateDashboard(metrics: SystemMetrics) {
    // Update response time chart
    this.updateResponseTimeChart();
    
    // Update throughput chart
    this.updateThroughputChart();
    
    // Update gauges
    this.widgets.errorRateGauge.setPercent(Math.round(metrics.overall.errorRate * 100));
    this.widgets.cpuGauge.setPercent(Math.round(metrics.resources.cpu));
    this.widgets.memoryGauge.setPercent(Math.round(metrics.resources.memory));
    
    // Update services table
    this.updateServicesTable(metrics.services);
    
    // Render screen
    this.screen.render();
  }

  private updateResponseTimeChart() {
    if (this.metrics.length < 2) return;

    const data = {
      title: 'Response Time',
      x: this.metrics.map((_, i) => i.toString()),
      y: this.metrics.map(m => m.overall.avgResponseTime)
    };

    const p95Data = {
      title: 'P95',
      x: this.metrics.map((_, i) => i.toString()),
      y: this.metrics.map(m => {
        const p95Values = m.services.map(s => s.p95ResponseTime).filter(v => v > 0);
        return p95Values.length > 0 ? Math.max(...p95Values) : 0;
      })
    };

    this.widgets.responseTimeChart.setData([data, p95Data]);
  }

  private updateThroughputChart() {
    if (this.metrics.length < 2) return;

    const data = {
      title: 'Throughput',
      x: this.metrics.map((_, i) => i.toString()),
      y: this.metrics.map(m => m.overall.throughput)
    };

    this.widgets.throughputChart.setData([data]);
  }

  private updateServicesTable(services: ServiceMetrics[]) {
    const headers = ['Service', 'Status', 'Requests', 'Errors', 'Avg RT (ms)', 'P95 RT (ms)', 'CPU %', 'Mem MB'];
    
    const data = services.map(s => [
      s.service,
      this.getStatusColor(s.status),
      s.requests.toString(),
      s.errors.toString(),
      s.avgResponseTime.toFixed(2),
      s.p95ResponseTime.toFixed(2),
      s.cpu.toFixed(1),
      s.memory.toFixed(1)
    ]);

    this.widgets.servicesTable.setData({
      headers,
      data
    });
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'healthy':
        return '{green-fg}●{/green-fg} Healthy';
      case 'degraded':
        return '{yellow-fg}●{/yellow-fg} Degraded';
      case 'down':
        return '{red-fg}●{/red-fg} Down';
      default:
        return '{gray-fg}●{/gray-fg} Unknown';
    }
  }

  private checkAlerts(metrics: SystemMetrics) {
    const alerts: string[] = [];

    // Check error rate
    if (metrics.overall.errorRate > 0.1) {
      alerts.push('{red-fg}CRITICAL:{/red-fg} Error rate > 10%');
    } else if (metrics.overall.errorRate > 0.05) {
      alerts.push('{yellow-fg}WARNING:{/yellow-fg} Error rate > 5%');
    }

    // Check response time
    if (metrics.overall.avgResponseTime > 1000) {
      alerts.push('{red-fg}CRITICAL:{/red-fg} Avg response time > 1s');
    } else if (metrics.overall.avgResponseTime > 500) {
      alerts.push('{yellow-fg}WARNING:{/yellow-fg} Avg response time > 500ms');
    }

    // Check service health
    const downServices = metrics.services.filter(s => s.status === 'down');
    if (downServices.length > 0) {
      alerts.push(`{red-fg}CRITICAL:{/red-fg} ${downServices.length} service(s) down`);
    }

    const degradedServices = metrics.services.filter(s => s.status === 'degraded');
    if (degradedServices.length > 0) {
      alerts.push(`{yellow-fg}WARNING:{/yellow-fg} ${degradedServices.length} service(s) degraded`);
    }

    // Check resources
    if (metrics.resources.cpu > 90) {
      alerts.push('{red-fg}CRITICAL:{/red-fg} CPU usage > 90%');
    } else if (metrics.resources.cpu > 80) {
      alerts.push('{yellow-fg}WARNING:{/yellow-fg} CPU usage > 80%');
    }

    if (metrics.resources.memory > 90) {
      alerts.push('{red-fg}CRITICAL:{/red-fg} Memory usage > 90%');
    } else if (metrics.resources.memory > 80) {
      alerts.push('{yellow-fg}WARNING:{/yellow-fg} Memory usage > 80%');
    }

    // Update alerts box
    if (alerts.length > 0) {
      this.widgets.alertsBox.setContent(alerts.slice(0, 10).join('\n'));
      this.widgets.alertsBox.style.border.fg = 'red';
    } else {
      this.widgets.alertsBox.setContent('{green-fg}All systems operational{/green-fg}');
      this.widgets.alertsBox.style.border.fg = 'green';
    }
  }

  public log(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let formattedMessage = `[${timestamp}] `;

    switch (level) {
      case 'error':
        formattedMessage += `{red-fg}ERROR:{/red-fg} ${message}`;
        break;
      case 'warning':
        formattedMessage += `{yellow-fg}WARN:{/yellow-fg} ${message}`;
        break;
      default:
        formattedMessage += `{green-fg}INFO:{/green-fg} ${message}`;
    }

    this.widgets.logsBox.log(formattedMessage);
  }

  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// Export for use in load tests
export default MonitoringDashboard;

// Run as standalone if executed directly
if (require.main === module) {
  const dashboard = new MonitoringDashboard();
  
  // Example logs for testing
  setTimeout(() => dashboard.log('Load test started'), 1000);
  setTimeout(() => dashboard.log('Ramping up to 100 users'), 3000);
  setTimeout(() => dashboard.log('High response time detected', 'warning'), 5000);
  setTimeout(() => dashboard.log('Service degradation detected', 'error'), 7000);
  
  process.on('SIGINT', () => {
    dashboard.stop();
    process.exit(0);
  });
}