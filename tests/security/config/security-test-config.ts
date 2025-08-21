/**
 * Security Test Configuration
 * Central configuration for all security tests
 */

export interface SecurityTestConfig {
  // Test environment configuration
  environment: {
    baseUrl: string;
    wsUrl: string;
    apiUrl: string;
    adminUrl: string;
  };

  // Authentication configuration
  authentication: {
    testUser: {
      email: string;
      password: string;
      role: string;
    };
    adminUser: {
      email: string;
      password: string;
      role: string;
    };
    maliciousUser: {
      email: string;
      password: string;
      role: string;
    };
    jwtSecret: string;
    tokenExpiry: number;
  };

  // Rate limiting configuration
  rateLimiting: {
    auth: {
      windowMs: number;
      maxAttempts: number;
    };
    api: {
      windowMs: number;
      maxRequests: number;
    };
    websocket: {
      maxConnections: number;
      maxMessagesPerMinute: number;
    };
  };

  // Input validation test patterns
  inputValidation: {
    xssPayloads: string[];
    sqlInjectionPayloads: string[];
    pathTraversalPayloads: string[];
    commandInjectionPayloads: string[];
    ldapInjectionPayloads: string[];
  };

  // Security headers requirements
  securityHeaders: {
    required: string[];
    forbidden: string[];
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
  };

  // WebSocket security configuration
  websocket: {
    validMessageTypes: string[];
    maxMessageSize: number;
    connectionTimeout: number;
    heartbeatInterval: number;
  };

  // Penetration testing configuration
  penetrationTesting: {
    owaspZapUrl: string;
    scanPolicies: string[];
    excludedUrls: string[];
    maxScanDuration: number;
  };

  // Code analysis configuration
  codeAnalysis: {
    debugPatterns: string[];
    consolePatterns: string[];
    secretPatterns: string[];
    vulnerablePackages: string[];
  };

  // Timeout and retry configuration
  timeouts: {
    defaultTimeout: number;
    authTimeout: number;
    apiTimeout: number;
    websocketTimeout: number;
  };

  // Report configuration
  reporting: {
    outputDir: string;
    formats: string[];
    includeEvidence: boolean;
    generateExecutiveSummary: boolean;
  };
}

export const getSecurityTestConfig = (): SecurityTestConfig => {
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = process.env.SECURITY_TEST_BASE_URL || 'http://localhost:3000';
  
  return {
    environment: {
      baseUrl,
      wsUrl: baseUrl.replace('http', 'ws') + '/ws/walmart/secure',
      apiUrl: baseUrl + '/api',
      adminUrl: baseUrl + '/admin'
    },

    authentication: {
      testUser: {
        email: 'security.test@example.com',
        password: 'SecureTestPass123!',
        role: 'user'
      },
      adminUser: {
        email: 'security.admin@example.com',
        password: 'SecureAdminPass123!',
        role: 'admin'
      },
      maliciousUser: {
        email: 'malicious.user@example.com',
        password: 'MaliciousPass123!',
        role: 'user'
      },
      jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-for-security-tests',
      tokenExpiry: 3600 // 1 hour
    },

    rateLimiting: {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5
      },
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
      },
      websocket: {
        maxConnections: 10,
        maxMessagesPerMinute: 60
      }
    },

    inputValidation: {
      xssPayloads: [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        "'><script>alert('XSS')</script>",
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS") autofocus>',
        '<select onfocus=alert("XSS") autofocus>',
        '<textarea onfocus=alert("XSS") autofocus>',
        '<keygen onfocus=alert("XSS") autofocus>',
        '<video><source onerror="alert(\'XSS\')">',
        '<audio src=x onerror=alert("XSS")>',
        '<details open ontoggle=alert("XSS")>'
      ],
      sqlInjectionPayloads: [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1",
        "admin'--",
        "admin'/*",
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        "') OR '1'='1--",
        "') OR ('1'='1--",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "1' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a"
      ],
      pathTraversalPayloads: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd',
        'C:\\windows\\system32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '..%252F..%252F..%252Fetc%252Fpasswd',
        'file:///etc/passwd',
        'file://C:/windows/system32/drivers/etc/hosts'
      ],
      commandInjectionPayloads: [
        '; cat /etc/passwd',
        '| cat /etc/passwd',
        '& cat /etc/passwd',
        '&& cat /etc/passwd',
        '|| cat /etc/passwd',
        '`cat /etc/passwd`',
        '$(cat /etc/passwd)',
        '; ls -la',
        '| whoami',
        '& id',
        '&& pwd',
        '|| uname -a'
      ],
      ldapInjectionPayloads: [
        '*)(&',
        '*))%00',
        '*()|%26',
        '*(|(mail=*))',
        '*(|(objectclass=*))',
        '*))(|(mail=*',
        '*))(&(password=*))'
      ]
    },

    securityHeaders: {
      required: [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy',
        'Referrer-Policy',
        'Permissions-Policy'
      ],
      forbidden: [
        'Server',
        'X-Powered-By',
        'X-AspNet-Version',
        'X-Runtime'
      ],
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';",
      strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload'
    },

    websocket: {
      validMessageTypes: [
        'auth',
        'subscribe',
        'unsubscribe',
        'ping',
        'nlp_processing',
        'cart_update',
        'price_update'
      ],
      maxMessageSize: 1024 * 1024, // 1MB
      connectionTimeout: 30000, // 30 seconds
      heartbeatInterval: 30000 // 30 seconds
    },

    penetrationTesting: {
      owaspZapUrl: process.env.OWASP_ZAP_URL || 'http://localhost:8080',
      scanPolicies: [
        'Default Policy',
        'Full attacks',
        'XSS and SQLi only',
        'Light Scan'
      ],
      excludedUrls: [
        '/health',
        '/metrics',
        '/admin/system'
      ],
      maxScanDuration: 30 * 60 * 1000 // 30 minutes
    },

    codeAnalysis: {
      debugPatterns: [
        'console\\.debug\\(',
        'console\\.log\\(',
        'console\\.info\\(',
        'console\\.warn\\(',
        'console\\.error\\(',
        'debugger\\s*;',
        'DEBUG\\s*=\\s*true',
        'debug:\\s*true',
        '\\.debug\\(',
        'logger\\.debug\\(',
        'print\\(',
        'var_dump\\(',
        'dd\\(',
        'dump\\(',
        'printf\\(',
        'System\\.out\\.print'
      ],
      consolePatterns: [
        'console\\.',
        'window\\.console',
        'global\\.console'
      ],
      secretPatterns: [
        'password\\s*=\\s*["\'][^"\']{8,}["\']',
        'secret\\s*=\\s*["\'][^"\']{16,}["\']',
        'api[_-]?key\\s*=\\s*["\'][^"\']{16,}["\']',
        'token\\s*=\\s*["\'][^"\']{16,}["\']',
        'jwt[_-]?secret\\s*=\\s*["\'][^"\']{16,}["\']',
        'private[_-]?key\\s*=\\s*["\'][^"\']{100,}["\']',
        'access[_-]?token\\s*=\\s*["\'][^"\']{16,}["\']'
      ],
      vulnerablePackages: [
        'lodash@<4.17.21',
        'minimist@<1.2.6',
        'node-forge@<1.3.0',
        'axios@<0.21.2',
        'serialize-javascript@<6.0.0'
      ]
    },

    timeouts: {
      defaultTimeout: 30000,
      authTimeout: 10000,
      apiTimeout: 15000,
      websocketTimeout: 5000
    },

    reporting: {
      outputDir: './tests/security/reports',
      formats: ['json', 'html', 'junit'],
      includeEvidence: true,
      generateExecutiveSummary: true
    }
  };
};

export default getSecurityTestConfig;