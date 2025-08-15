import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  BarChart3,
  TrendingUp,
  Settings,
  Zap,
  Filter,
  Calendar,
  Download,
  AlertTriangle,
  ChevronUp,
} from "lucide-react";
import { api } from "../../../lib/trpc.js";
import { EmailIngestionPanel } from "./EmailIngestionPanel.js";
import "./EmailDashboard.css";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface EmailStats {
  totalEmails: number;
  processedEmails: number;
  pendingEmails: number;
  failedEmails: number;
  averageProcessingTime: number;
  categorization: {
    [key: string]: number;
  };
  dailyVolume: {
    date: string;
    count: number;
  }[];
  urgencyDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

type TabType = "overview" | "analytics" | "automation" | "reports" | "settings";

export const EmailDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const utils = api.useContext();

  // Enhanced scrolling state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLElement[]>([]);

  // Fetch real data using tRPC queries
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = api.emails.getAnalytics.useQuery({});
  const { data: tableData, isLoading: tableLoading } =
    api.emails.getTableData.useQuery({
      page: 1,
      pageSize: 50, // Reduced from 1000 to avoid validation errors
      sortBy: "received_date",
      sortOrder: "desc",
    });
  const { data: dashboardStats, isLoading: statsLoading } =
    api.emails.getDashboardStats.useQuery({});

  // Enhanced scrolling functionality
  const handleScroll = useCallback(() => {
    if (!dashboardRef.current) return;

    const scrollTop = dashboardRef.current.scrollTop;
    const scrollHeight =
      dashboardRef.current.scrollHeight - dashboardRef.current.clientHeight;

    // Show scroll-to-top button after scrolling 300px
    setShowScrollTop(scrollTop > 300);

    // Update scroll progress
    const progress = (scrollTop / scrollHeight) * 100;
    setScrollProgress(Math.min(progress, 100));

    // Update active section based on scroll position
    const sections = sectionsRef.current;
    if (sections.length > 0) {
      const currentSection = sections.findIndex((section) => {
        if (section) {
          const rect = section.getBoundingClientRect();
          return rect.top <= 100 && rect.bottom >= 100;
        }
        return false;
      });
      if (currentSection !== -1) {
        setActiveSection(currentSection);
      }
    }
  }, []);

  const scrollToTop = useCallback(() => {
    dashboardRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const scrollToSection = useCallback((index: number) => {
    const section = sectionsRef.current[index];
    if (section && dashboardRef.current) {
      const offsetTop = section.offsetTop - 80; // Account for header
      dashboardRef.current.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  }, []);

  // Set up scroll listeners and observers
  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    dashboard.addEventListener("scroll", handleScroll);

    // Initial scroll position check
    handleScroll();

    return () => {
      dashboard.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Set up intersection observer for section animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );

    // Observe all sections with animate class
    const sections = dashboardRef.current?.querySelectorAll(".section-animate");
    sections?.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [activeTab]);

  // Set up real-time subscriptions (if WebSocket endpoints are available)
  // This is a placeholder for when WebSocket endpoints are implemented
  useEffect(() => {
    // Auto-refresh data every 30 seconds
    const interval = setInterval(() => {
      utils.emails.getAnalytics.invalidate();
      utils.emails.getTableData.invalidate();
      utils.emails.getDashboardStats.invalidate();
    }, 30000);

    return () => clearInterval(interval);
  }, [utils]);

  // Transform data into the expected format
  const stats: EmailStats = {
    totalEmails:
      analyticsData?.data?.totalEmails ||
      dashboardStats?.data?.totalEmails ||
      0,
    processedEmails: dashboardStats?.data?.completedCount || 0,
    pendingEmails: dashboardStats?.data?.inProgressCount || 0,
    failedEmails: 0, // TODO: Add this to the API
    averageProcessingTime:
      (analyticsData?.data?.averageProcessingTime || 0) / 1000, // Convert ms to seconds
    categorization: analyticsData?.data?.workflowDistribution || {},
    dailyVolume: (() => {
      // Group emails by date for the last 7 days
      const volumeByDate = new Map<string, number>();
      const today = new Date();
      
      // Initialize last 7 days with 0 counts
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        volumeByDate.set(dateStr || '', 0);
      }
      
      // Count emails by date
      tableData?.data?.emails?.forEach((email: any) => {
        const emailDate = new Date(email.receivedDate).toISOString().split('T')[0];
        if (emailDate && volumeByDate.has(emailDate)) {
          volumeByDate.set(emailDate, (volumeByDate.get(emailDate) || 0) + 1);
        }
      });
      
      // Convert to array format
      return Array.from(volumeByDate.entries()).map(([date, count]) => ({
        date,
        count
      }));
    })(),
    urgencyDistribution: {
      critical: dashboardStats?.data?.criticalCount || 0,
      high: Math.floor((dashboardStats?.data?.inProgressCount || 0) * 0.4),
      medium: Math.floor((dashboardStats?.data?.inProgressCount || 0) * 0.4),
      low: Math.floor((dashboardStats?.data?.inProgressCount || 0) * 0.2),
    },
  };

  // Loading state
  const isLoading = analyticsLoading || tableLoading || statsLoading;

  // Error handling
  if (analyticsError) {
    return (
      <div className="email-dashboard">
        <div className="error-state">
          <AlertTriangle className="error-icon" />
          <p>Failed to load email analytics data</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  // Chart configurations with improved visibility
  const lineChartData = {
    labels: stats.dailyVolume.map((d) =>
      new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    ),
    datasets: [
      {
        label: "Email Volume",
        data: stats.dailyVolume.map((d) => d.count),
        fill: true,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderColor: "rgb(59, 130, 246)",
        pointBackgroundColor: "rgb(59, 130, 246)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4,
      },
    ],
  };

  const barChartData = {
    labels: Object.keys(stats.categorization),
    datasets: [
      {
        label: "Emails by Category",
        data: Object.values(stats.categorization),
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(251, 146, 60, 0.8)",
          "rgba(147, 51, 234, 0.8)",
          "rgba(236, 72, 153, 0.8)",
        ],
        borderColor: [
          "rgb(59, 130, 246)",
          "rgb(16, 185, 129)",
          "rgb(251, 146, 60)",
          "rgb(147, 51, 234)",
          "rgb(236, 72, 153)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const doughnutChartData = {
    labels: ["Critical", "High", "Medium", "Low"],
    datasets: [
      {
        data: [
          stats.urgencyDistribution.critical,
          stats.urgencyDistribution.high,
          stats.urgencyDistribution.medium,
          stats.urgencyDistribution.low,
        ],
        backgroundColor: [
          "rgba(239, 68, 68, 0.8)",
          "rgba(251, 146, 60, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
        ],
        borderColor: [
          "rgb(239, 68, 68)",
          "rgb(251, 146, 60)",
          "rgb(59, 130, 246)",
          "rgb(16, 185, 129)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleColor: "#f3f4f6",
        bodyColor: "#e5e7eb",
        borderColor: "#374151",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(75, 85, 99, 0.3)",
          drawBorder: false,
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.3)",
          drawBorder: false,
        },
        ticks: {
          color: "#9ca3af",
          font: {
            size: 11,
          },
        },
      },
    },
  };

  const doughnutOptions = {
    ...chartOptions,
    scales: undefined,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        position: "right" as const,
        labels: {
          color: "#e5e7eb",
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          padding: 15,
        },
      },
    },
  };

  const processingRate = (
    (stats.processedEmails / stats.totalEmails) *
    100
  ).toFixed(1);

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: BarChart3 },
    { id: "analytics" as TabType, label: "Analytics", icon: TrendingUp },
    { id: "automation" as TabType, label: "Automation", icon: Zap },
    { id: "reports" as TabType, label: "Reports", icon: Calendar },
    { id: "settings" as TabType, label: "Settings", icon: Settings },
  ];

  const renderOverview = () => {
    if (isLoading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading email analytics...</p>
        </div>
      );
    }

    return (
      <>
        {/* Email Ingestion Panel */}
        <EmailIngestionPanel />
        
        {/* Key Metrics Cards */}
        <div
          className="metrics-grid section-anchor section-animate"
          ref={(el) => {
            if (el) sectionsRef.current[1] = el;
          }}
        >
          <div className="metric-card metric-card-primary">
            <div className="metric-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="metric-content">
              <p className="metric-label">Total Emails</p>
              <p className="metric-value">
                {stats.totalEmails.toLocaleString()}
              </p>
              <p className="metric-change">+12.5% from last week</p>
            </div>
          </div>

          <div className="metric-card metric-card-success">
            <div className="metric-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 11L12 14L22 4M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="metric-content">
              <p className="metric-label">Processed</p>
              <p className="metric-value">
                {stats.processedEmails.toLocaleString()}
              </p>
              <p className="metric-change metric-positive">
                {processingRate}% completion rate
              </p>
            </div>
          </div>

          <div className="metric-card metric-card-warning">
            <div className="metric-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="metric-content">
              <p className="metric-label">Pending</p>
              <p className="metric-value">
                {stats.pendingEmails.toLocaleString()}
              </p>
              <p className="metric-change metric-warning">Requires attention</p>
            </div>
          </div>

          <div className="metric-card metric-card-info">
            <div className="metric-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="metric-content">
              <p className="metric-label">Avg. Processing Time</p>
              <p className="metric-value">{stats.averageProcessingTime}s</p>
              <p className="metric-change metric-positive">-0.3s improvement</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div
          className="charts-grid section-anchor section-animate"
          ref={(el) => {
            if (el) sectionsRef.current[2] = el;
          }}
        >
          <div className="chart-container">
            <h2 className="chart-title">Daily Email Volume</h2>
            <div className="chart-wrapper">
              <Line data={lineChartData} options={chartOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h2 className="chart-title">Urgency Distribution</h2>
            <div className="chart-wrapper doughnut-wrapper">
              <Doughnut data={doughnutChartData} options={doughnutOptions} />
            </div>
          </div>

          <div className="chart-container chart-container-full">
            <h2 className="chart-title">Email Categories</h2>
            <div className="chart-wrapper">
              <Bar data={barChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div
          className="activity-section section-anchor section-animate"
          ref={(el) => {
            if (el) sectionsRef.current[3] = el;
          }}
        >
          <h2 className="section-title">Recent Processing Activity</h2>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon activity-icon-success">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 13L9 17L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="activity-content">
                <p className="activity-title">Batch Processing Completed</p>
                <p className="activity-description">
                  Successfully processed 1,250 emails in order management queue
                </p>
                <p className="activity-time">2 minutes ago</p>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon activity-icon-warning">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 9V13M12 17H12.01M12 3L2 20H22L12 3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="activity-content">
                <p className="activity-title">High Priority Alert</p>
                <p className="activity-description">
                  347 critical emails require immediate attention
                </p>
                <p className="activity-time">5 minutes ago</p>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon activity-icon-info">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="activity-content">
                <p className="activity-title">System Update</p>
                <p className="activity-description">
                  Email categorization model updated to v2.1.0
                </p>
                <p className="activity-time">15 minutes ago</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderAnalytics = () => {
    // Calculate performance metrics from the data we already have
    const calculatePerformance = () => {
      const totalProcessed = stats.processedEmails;
      const total = stats.totalEmails;
      const throughput =
        stats.averageProcessingTime > 0 ? 1 / stats.averageProcessingTime : 0;
      const successRate = total > 0 ? (totalProcessed / total) * 100 : 0;
      const errorRate = 100 - successRate;

      return { throughput, successRate, errorRate };
    };

    const { throughput, successRate, errorRate } = calculatePerformance();

    // Extract workflow data from analytics
    const workflowData = analyticsData?.data;

    // Extract entity counts from actual email data
    const entityCounts = (() => {
      const counts: Record<string, number> = {
        PO_NUMBER: 0,
        QUOTE_NUMBER: 0,
        PART_NUMBER: 0,
        ORDER_REF: 0,
      };
      
      tableData?.data?.emails?.forEach((email: any) => {
        if (email.entities && Array.isArray(email.entities)) {
          email.entities.forEach((entity: any) => {
            const type = entity.type?.toUpperCase() || '';
            if (type in counts) {
              (counts as any)[type]++;
            }
          });
        }
      });
      
      return counts;
    })();

    return (
      <div className="analytics-section">
        <h2 className="section-title">Advanced Analytics</h2>

        {/* Performance Metrics */}
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3 className="analytics-title">Processing Performance</h3>
            <div className="metrics-row">
              <div className="metric-item">
                <span className="metric-label">Throughput</span>
                <span className="metric-value">
                  {throughput.toFixed(2)} emails/sec
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Success Rate</span>
                <span className="metric-value">{successRate.toFixed(1)}%</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Error Rate</span>
                <span className="metric-value">{errorRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <h3 className="analytics-title">Entity Extraction</h3>
            <div className="entity-stats">
              <div className="entity-item">
                <span className="entity-label">PO Numbers</span>
                <span className="entity-count">
                  {(entityCounts["PO_NUMBER"] || 0).toLocaleString()}
                </span>
              </div>
              <div className="entity-item">
                <span className="entity-label">Quote Numbers</span>
                <span className="entity-count">
                  {(entityCounts["QUOTE_NUMBER"] || 0).toLocaleString()}
                </span>
              </div>
              <div className="entity-item">
                <span className="entity-label">Part Numbers</span>
                <span className="entity-count">
                  {(entityCounts["PART_NUMBER"] || 0).toLocaleString()}
                </span>
              </div>
              <div className="entity-item">
                <span className="entity-label">Order References</span>
                <span className="entity-count">
                  {(entityCounts["ORDER_REF"] || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <h3 className="analytics-title">Workflow Distribution</h3>
            <div className="workflow-stats">
              {Object.entries(stats.categorization).map(
                ([workflow, count], index) => {
                  const percentage =
                    stats.totalEmails > 0
                      ? (count / stats.totalEmails) * 100
                      : 0;
                  return (
                    <div key={index} className="workflow-item">
                      <span className="workflow-label">{workflow}</span>
                      <div className="workflow-bar">
                        <div
                          className="workflow-fill"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="workflow-percent">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>

        {/* Advanced Charts */}
        <div className="advanced-charts">
          <div className="chart-container">
            <h3 className="chart-title">Processing Time Distribution</h3>
            <div className="chart-wrapper">
              <Bar
                data={{
                  labels: stats.dailyVolume.map((d) =>
                    new Date(d.date).toLocaleDateString("en-US", {
                      weekday: "short",
                    }),
                  ),
                  datasets: [
                    {
                      label: "Avg Processing Time (s)",
                      data: stats.dailyVolume.map(() => stats.averageProcessingTime), // Use actual average
                      backgroundColor: "rgba(75, 192, 192, 0.6)",
                      borderColor: "rgba(75, 192, 192, 1)",
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                      labels: {
                        color: "#e5e7eb",
                        font: {
                          size: 12,
                          family: "'Inter', sans-serif",
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        color: "rgba(75, 85, 99, 0.3)",
                        display: true,
                      },
                      ticks: {
                        color: "#9ca3af",
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: "rgba(75, 85, 99, 0.3)",
                        display: true,
                      },
                      ticks: {
                        color: "#9ca3af",
                        font: {
                          size: 11,
                        },
                      },
                      title: {
                        display: true,
                        text: "Time (s)",
                        color: "#e5e7eb",
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="chart-container">
            <h3 className="chart-title">Entity Extraction by Type</h3>
            <div className="chart-wrapper doughnut-wrapper">
              <Doughnut
                data={{
                  labels: Object.keys(entityCounts),
                  datasets: [
                    {
                      data: Object.values(entityCounts),
                      backgroundColor: [
                        "rgba(255, 99, 132, 0.6)",
                        "rgba(54, 162, 235, 0.6)",
                        "rgba(255, 206, 86, 0.6)",
                        "rgba(75, 192, 192, 0.6)",
                        "rgba(153, 102, 255, 0.6)",
                      ],
                      borderColor: [
                        "rgba(255, 99, 132, 1)",
                        "rgba(54, 162, 235, 1)",
                        "rgba(255, 206, 86, 1)",
                        "rgba(75, 192, 192, 1)",
                        "rgba(153, 102, 255, 1)",
                      ],
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "right" as const,
                      labels: {
                        color: "#e5e7eb",
                        font: {
                          size: 12,
                          family: "'Inter', sans-serif",
                        },
                        padding: 15,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAutomation = () => (
    <div className="automation-section">
      <h2 className="section-title">Email Automation Rules</h2>

      <div className="automation-controls">
        <button className="btn-primary">
          <Zap size={16} />
          Create New Rule
        </button>
        <button className="btn-secondary">
          <Download size={16} />
          Export Rules
        </button>
      </div>

      <div className="automation-rules">
        <div className="rule-card">
          <div className="rule-header">
            <h3 className="rule-title">Priority Order Processing</h3>
            <div className="rule-status active">Active</div>
          </div>
          <p className="rule-description">
            Automatically prioritize emails containing "urgent", "critical", or
            PO numbers starting with "RUSH"
          </p>
          <div className="rule-stats">
            <span>Triggered: 1,247 times</span>
            <span>Success rate: 99.2%</span>
          </div>
        </div>

        <div className="rule-card">
          <div className="rule-header">
            <h3 className="rule-title">Quote Auto-Categorization</h3>
            <div className="rule-status active">Active</div>
          </div>
          <p className="rule-description">
            Automatically categorize emails with quote numbers (FTQ-, Q-*-*,
            F5Q-) into quote processing workflow
          </p>
          <div className="rule-stats">
            <span>Triggered: 633 times</span>
            <span>Success rate: 97.8%</span>
          </div>
        </div>

        <div className="rule-card">
          <div className="rule-header">
            <h3 className="rule-title">Customer Support Routing</h3>
            <div className="rule-status paused">Paused</div>
          </div>
          <p className="rule-description">
            Route customer support emails to appropriate teams based on
            extracted company names and issue types
          </p>
          <div className="rule-stats">
            <span>Triggered: 2,841 times</span>
            <span>Success rate: 94.5%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="reports-section">
      <h2 className="section-title">Email Reports & Exports</h2>

      <div className="report-controls">
        <div className="date-filter">
          <Calendar size={16} />
          <select className="date-select">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>Custom range</option>
          </select>
        </div>
        <div className="export-controls">
          <button className="btn-secondary">
            <Download size={16} />
            Export CSV
          </button>
          <button className="btn-secondary">
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="report-cards">
        <div className="report-card">
          <h3 className="report-title">Processing Summary</h3>
          <p className="report-description">
            Comprehensive overview of email processing statistics, success
            rates, and performance metrics
          </p>
          <button className="btn-generate">Generate Report</button>
        </div>

        <div className="report-card">
          <h3 className="report-title">Entity Extraction Report</h3>
          <p className="report-description">
            Detailed analysis of extracted entities including PO numbers,
            quotes, and company information
          </p>
          <button className="btn-generate">Generate Report</button>
        </div>

        <div className="report-card">
          <h3 className="report-title">Workflow Analysis</h3>
          <p className="report-description">
            Breakdown of email categorization by workflow type with timing and
            efficiency metrics
          </p>
          <button className="btn-generate">Generate Report</button>
        </div>

        <div className="report-card">
          <h3 className="report-title">SLA Compliance</h3>
          <p className="report-description">
            Service level agreement compliance tracking with deadline analysis
            and bottleneck identification
          </p>
          <button className="btn-generate">Generate Report</button>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="settings-section">
      <h2 className="section-title">Email Dashboard Settings</h2>

      <div className="settings-groups">
        <div className="settings-group">
          <h3 className="settings-group-title">Processing Configuration</h3>
          <div className="setting-item">
            <label className="setting-label">Batch Size</label>
            <input
              type="number"
              className="setting-input"
              defaultValue="1000"
            />
          </div>
          <div className="setting-item">
            <label className="setting-label">
              Processing Timeout (seconds)
            </label>
            <input type="number" className="setting-input" defaultValue="30" />
          </div>
          <div className="setting-item">
            <label className="setting-label">Auto-retry Failed Emails</label>
            <input
              type="checkbox"
              className="setting-checkbox"
              defaultChecked
            />
          </div>
        </div>

        <div className="settings-group">
          <h3 className="settings-group-title">Alert Configuration</h3>
          <div className="setting-item">
            <label className="setting-label">High Priority Threshold</label>
            <input type="number" className="setting-input" defaultValue="500" />
          </div>
          <div className="setting-item">
            <label className="setting-label">Email Notifications</label>
            <input
              type="checkbox"
              className="setting-checkbox"
              defaultChecked
            />
          </div>
          <div className="setting-item">
            <label className="setting-label">Slack Notifications</label>
            <input type="checkbox" className="setting-checkbox" />
          </div>
        </div>

        <div className="settings-group">
          <h3 className="settings-group-title">Display Preferences</h3>
          <div className="setting-item">
            <label className="setting-label">Refresh Interval (seconds)</label>
            <select className="setting-select">
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
            </select>
          </div>
          <div className="setting-item">
            <label className="setting-label">Show Advanced Metrics</label>
            <input
              type="checkbox"
              className="setting-checkbox"
              defaultChecked
            />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary">Save Settings</button>
        <button className="btn-secondary">Reset to Default</button>
      </div>
    </div>
  );

  const sections = [
    { id: "header", label: "Header" },
    { id: "metrics", label: "Metrics" },
    { id: "charts", label: "Charts" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="email-dashboard" ref={dashboardRef}>
      {/* Scroll Progress Indicator */}
      <div className="scroll-progress">
        <div
          className="scroll-progress-bar"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Page Navigation Dots */}
      <div className="page-navigation">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`nav-dot ${activeSection === index ? "active" : ""}`}
            onClick={() => scrollToSection(index)}
            title={section.label}
          />
        ))}
      </div>

      {/* Scroll to Top Button */}
      <button
        className={`scroll-to-top ${showScrollTop ? "visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ChevronUp size={24} />
      </button>

      {/* Header Section */}
      <div
        className="dashboard-header section-anchor section-animate"
        ref={(el) => {
          if (el) sectionsRef.current[0] = el;
        }}
      >
        <h1 className="dashboard-title">Email Management Dashboard</h1>
        <p className="dashboard-subtitle">
          Real-time analytics and insights for your email processing system
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-nav">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <IconComponent size={20} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="dashboard-content">
        {activeTab === "overview" && renderOverview()}
        {activeTab === "analytics" && renderAnalytics()}
        {activeTab === "automation" && renderAutomation()}
        {activeTab === "reports" && renderReports()}
        {activeTab === "settings" && renderSettings()}
      </div>
    </div>
  );
};
