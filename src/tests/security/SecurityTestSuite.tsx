import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Lock, Eye, FileText, Download } from 'lucide-react';

// 2025 Best Practice: Comprehensive Security Testing Dashboard

interface SecurityTest {
  id: string;
  category: string;
  testName: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked';
  owaspCategory?: string;
  remediation?: string;
  evidence?: {
    request?: string;
    response?: string;
    screenshot?: string;
  };
  executedAt?: Date;
  executedBy?: string;
}

interface VulnerabilityReport {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  cweId?: string;
  cvssScore?: number;
  affectedComponent: string;
  discoveredAt: Date;
  status: 'new' | 'confirmed' | 'in-progress' | 'resolved' | 'false-positive';
  remediation: string;
  references: string[];
}

interface ComplianceCheck {
  id: string;
  regulation: 'GDPR' | 'CCPA' | 'SOC2' | 'ISO27001' | 'HIPAA';
  requirement: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-applicable';
  evidence: string;
  lastChecked: Date;
  nextReview: Date;
}

export const SecurityTestingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tests' | 'vulnerabilities' | 'compliance' | 'report'>('tests');
  const [securityTests, setSecurityTests] = useState<SecurityTest[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityReport[]>([]);
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [testProgress, setTestProgress] = useState(0);

  // OWASP Top 10 2025 Security Tests
  const owaspTests: SecurityTest[] = [
    {
      id: 'owasp-01',
      category: 'Authentication',
      testName: 'Broken Access Control',
      description: 'Test for unauthorized access to restricted resources',
      severity: 'critical',
      status: 'pending',
      owaspCategory: 'A01:2025',
      remediation: 'Implement proper role-based access control and verify permissions on every request'
    },
    {
      id: 'owasp-02',
      category: 'Cryptography',
      testName: 'Cryptographic Failures',
      description: 'Verify proper encryption of sensitive data in transit and at rest',
      severity: 'critical',
      status: 'pending',
      owaspCategory: 'A02:2025',
      remediation: 'Use strong encryption algorithms and proper key management'
    },
    {
      id: 'owasp-03',
      category: 'Injection',
      testName: 'XSS Prevention in React',
      description: 'Test for Cross-Site Scripting vulnerabilities in React components',
      severity: 'high',
      status: 'pending',
      owaspCategory: 'A03:2025',
      remediation: 'Sanitize all user inputs and avoid dangerouslySetInnerHTML'
    },
    {
      id: 'owasp-04',
      category: 'Design',
      testName: 'Insecure Design',
      description: 'Review application design for security flaws',
      severity: 'high',
      status: 'pending',
      owaspCategory: 'A04:2025',
      remediation: 'Implement threat modeling and secure design patterns'
    },
    {
      id: 'owasp-05',
      category: 'Configuration',
      testName: 'Security Misconfiguration',
      description: 'Check for default configurations and unnecessary features',
      severity: 'medium',
      status: 'pending',
      owaspCategory: 'A05:2025',
      remediation: 'Harden configurations and remove default accounts'
    },
    {
      id: 'owasp-06',
      category: 'Components',
      testName: 'Vulnerable Dependencies',
      description: 'Scan for known vulnerabilities in npm packages',
      severity: 'high',
      status: 'pending',
      owaspCategory: 'A06:2025',
      remediation: 'Keep all dependencies updated and use npm audit regularly'
    },
    {
      id: 'owasp-07',
      category: 'Authentication',
      testName: 'Authentication Failures',
      description: 'Test authentication mechanisms for weaknesses',
      severity: 'critical',
      status: 'pending',
      owaspCategory: 'A07:2025',
      remediation: 'Implement MFA and proper session management'
    },
    {
      id: 'owasp-08',
      category: 'Data Integrity',
      testName: 'Software and Data Integrity',
      description: 'Verify integrity of code and data updates',
      severity: 'high',
      status: 'pending',
      owaspCategory: 'A08:2025',
      remediation: 'Implement code signing and integrity checks'
    },
    {
      id: 'owasp-09',
      category: 'Logging',
      testName: 'Security Logging Failures',
      description: 'Ensure proper security event logging',
      severity: 'medium',
      status: 'pending',
      owaspCategory: 'A09:2025',
      remediation: 'Implement comprehensive security logging and monitoring'
    },
    {
      id: 'owasp-10',
      category: 'SSRF',
      testName: 'Server-Side Request Forgery',
      description: 'Test for SSRF vulnerabilities in server communications',
      severity: 'high',
      status: 'pending',
      owaspCategory: 'A10:2025',
      remediation: 'Validate and sanitize all URLs and implement allowlists'
    }
  ];

  // React-specific Security Tests
  const reactSecurityTests: SecurityTest[] = [
    {
      id: 'react-01',
      category: 'React Security',
      testName: 'dangerouslySetInnerHTML Usage',
      description: 'Scan codebase for unsafe HTML rendering',
      severity: 'high',
      status: 'pending',
      remediation: 'Use DOMPurify or avoid dangerouslySetInnerHTML entirely'
    },
    {
      id: 'react-02',
      category: 'React Security',
      testName: 'Component Input Validation',
      description: 'Verify all props are validated and sanitized',
      severity: 'medium',
      status: 'pending',
      remediation: 'Implement PropTypes or TypeScript with strict validation'
    },
    {
      id: 'react-03',
      category: 'React Security',
      testName: 'State Management Security',
      description: 'Check for sensitive data in React state/Redux store',
      severity: 'high',
      status: 'pending',
      remediation: 'Never store sensitive data in client-side state'
    },
    {
      id: 'react-04',
      category: 'React Security',
      testName: 'URL Parameter Injection',
      description: 'Test for injection through React Router params',
      severity: 'medium',
      status: 'pending',
      remediation: 'Validate and sanitize all route parameters'
    },
    {
      id: 'react-05',
      category: 'React Security',
      testName: 'Content Security Policy',
      description: 'Verify CSP headers are properly configured',
      severity: 'medium',
      status: 'pending',
      remediation: 'Implement strict CSP with nonce-based inline scripts'
    }
  ];

  // API Security Tests
  const apiSecurityTests: SecurityTest[] = [
    {
      id: 'api-01',
      category: 'API Security',
      testName: 'JWT Token Validation',
      description: 'Test JWT implementation for vulnerabilities',
      severity: 'critical',
      status: 'pending',
      remediation: 'Use secure algorithms and validate all claims'
    },
    {
      id: 'api-02',
      category: 'API Security',
      testName: 'Rate Limiting',
      description: 'Verify rate limiting is implemented on all endpoints',
      severity: 'medium',
      status: 'pending',
      remediation: 'Implement rate limiting based on IP and user'
    },
    {
      id: 'api-03',
      category: 'API Security',
      testName: 'SQL Injection',
      description: 'Test all database queries for SQL injection',
      severity: 'critical',
      status: 'pending',
      remediation: 'Use parameterized queries and ORMs properly'
    },
    {
      id: 'api-04',
      category: 'API Security',
      testName: 'CORS Configuration',
      description: 'Verify CORS is properly configured',
      severity: 'medium',
      status: 'pending',
      remediation: 'Implement strict CORS policies with specific origins'
    },
    {
      id: 'api-05',
      category: 'API Security',
      testName: 'Input Validation',
      description: 'Test all API inputs for validation',
      severity: 'high',
      status: 'pending',
      remediation: 'Implement comprehensive input validation schemas'
    }
  ];

  // Execute security test
  const executeSecurityTest = async (test: SecurityTest) => {
    setSecurityTests(prev => 
      prev.map(t => t.id === test.id ? { ...t, status: 'running' } : t)
    );

    // Simulate test execution
    setTimeout(() => {
      const passed = Math.random() > 0.3; // 70% pass rate for demo
      setSecurityTests(prev => 
        prev.map(t => t.id === test.id ? { 
          ...t, 
          status: passed ? 'passed' : 'failed',
          executedAt: new Date(),
          executedBy: 'Security Scanner v2.0',
          evidence: passed ? undefined : {
            request: 'GET /api/emails?id=1 OR 1=1',
            response: '200 OK - Potential SQL injection detected',
            screenshot: '/screenshots/security-issue-001.png'
          }
        } : t)
      );

      // Add vulnerability if test failed
      if (!passed && test.severity !== 'info') {
        const vulnerability: VulnerabilityReport = {
          id: `vuln-${Date.now()}`,
          title: `${test.testName} - Vulnerability Detected`,
          description: test.description,
          severity: test.severity,
          category: test.category,
          affectedComponent: 'Email Dashboard API',
          discoveredAt: new Date(),
          status: 'new',
          remediation: test.remediation || 'Implement security best practices',
          references: [`https://owasp.org/Top10/${test.owaspCategory}`]
        };
        setVulnerabilities(prev => [...prev, vulnerability]);
      }
    }, 2000);
  };

  // Initialize tests
  useEffect(() => {
    setSecurityTests([...owaspTests, ...reactSecurityTests, ...apiSecurityTests]);
    
    // Initialize compliance checks
    setComplianceChecks([
      {
        id: 'gdpr-01',
        regulation: 'GDPR',
        requirement: 'Data Subject Rights Implementation',
        status: 'compliant',
        evidence: 'Export functionality allows users to download their data',
        lastChecked: new Date(),
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'gdpr-02',
        regulation: 'GDPR',
        requirement: 'Consent Management',
        status: 'partial',
        evidence: 'Basic consent implemented, enhanced consent UI needed',
        lastChecked: new Date(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'ccpa-01',
        regulation: 'CCPA',
        requirement: 'Do Not Sell Personal Information',
        status: 'compliant',
        evidence: 'No personal information is sold to third parties',
        lastChecked: new Date(),
        nextReview: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'soc2-01',
        regulation: 'SOC2',
        requirement: 'Access Control',
        status: 'compliant',
        evidence: 'Role-based access control implemented with audit logging',
        lastChecked: new Date(),
        nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    ]);
  }, []);

  // Calculate security score
  const calculateSecurityScore = () => {
    const totalTests = securityTests.length;
    const passedTests = securityTests.filter(t => t.status === 'passed').length;
    const criticalFailed = securityTests.filter(t => t.status === 'failed' && t.severity === 'critical').length;
    
    let score = (passedTests / totalTests) * 100;
    score -= criticalFailed * 20; // Heavy penalty for critical failures
    
    return Math.max(0, Math.round(score));
  };

  // Render security tests
  const renderSecurityTests = () => (
    <div className="space-y-6">
      {/* Security Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Security Score</h2>
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="#e5e7eb"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke={calculateSecurityScore() > 80 ? '#10b981' : calculateSecurityScore() > 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(calculateSecurityScore() / 100) * 553} 553`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold">{calculateSecurityScore()}%</div>
                <div className="text-sm text-gray-600">Security Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Categories */}
      {['OWASP Top 10', 'React Security', 'API Security'].map(category => {
        const categoryTests = securityTests.filter(t => 
          category === 'OWASP Top 10' ? t.owaspCategory :
          category === 'React Security' ? t.category === 'React Security' :
          t.category === 'API Security'
        );

        return (
          <div key={category} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{category}</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {categoryTests.map(test => (
                  <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{test.testName}</h4>
                      <p className="text-sm text-gray-600 mt-1">{test.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          test.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          test.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          test.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {test.severity.toUpperCase()}
                        </span>
                        {test.owaspCategory && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                            {test.owaspCategory}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {test.status === 'pending' && (
                        <button
                          onClick={() => executeSecurityTest(test)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Run Test
                        </button>
                      )}
                      {test.status === 'running' && (
                        <div className="flex items-center text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                          Running...
                        </div>
                      )}
                      {test.status === 'passed' && (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-5 h-5 mr-1" />
                          Passed
                        </div>
                      )}
                      {test.status === 'failed' && (
                        <div className="flex items-center text-red-600">
                          <XCircle className="w-5 h-5 mr-1" />
                          Failed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Run All Tests Button */}
      <div className="flex justify-center">
        <button
          onClick={() => securityTests.forEach(test => executeSecurityTest(test))}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <Shield className="w-5 h-5 mr-2" />
          Run All Security Tests
        </button>
      </div>
    </div>
  );

  // Render vulnerabilities
  const renderVulnerabilities = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800">Critical</h3>
          <div className="text-2xl font-bold text-red-900">
            {vulnerabilities.filter(v => v.severity === 'critical').length}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-orange-800">High</h3>
          <div className="text-2xl font-bold text-orange-900">
            {vulnerabilities.filter(v => v.severity === 'high').length}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800">Medium</h3>
          <div className="text-2xl font-bold text-yellow-900">
            {vulnerabilities.filter(v => v.severity === 'medium').length}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800">Low</h3>
          <div className="text-2xl font-bold text-blue-900">
            {vulnerabilities.filter(v => v.severity === 'low').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Vulnerability Details</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {vulnerabilities.map(vuln => (
              <div key={vuln.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{vuln.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{vuln.description}</p>
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700">Remediation:</h4>
                      <p className="text-sm text-gray-600">{vuln.remediation}</p>
                    </div>
                    <div className="flex items-center space-x-3 mt-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        vuln.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        vuln.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        vuln.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {vuln.affectedComponent}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(vuln.discoveredAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <select
                      value={vuln.status}
                      onChange={(e) => {
                        setVulnerabilities(prev =>
                          prev.map(v => v.id === vuln.id ? { ...v, status: e.target.value as any } : v)
                        );
                      }}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="new">New</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="false-positive">False Positive</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render compliance
  const renderCompliance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-800">Compliant</h3>
          <div className="text-2xl font-bold text-green-900">
            {complianceChecks.filter(c => c.status === 'compliant').length}
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800">Partial</h3>
          <div className="text-2xl font-bold text-yellow-900">
            {complianceChecks.filter(c => c.status === 'partial').length}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800">Non-Compliant</h3>
          <div className="text-2xl font-bold text-red-900">
            {complianceChecks.filter(c => c.status === 'non-compliant').length}
          </div>
        </div>
      </div>

      {['GDPR', 'CCPA', 'SOC2', 'ISO27001', 'HIPAA'].map(regulation => {
        const checks = complianceChecks.filter(c => c.regulation === regulation);
        if (checks.length === 0) return null;

        return (
          <div key={regulation} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{regulation} Compliance</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {checks.map(check => (
                  <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{check.requirement}</h4>
                      <p className="text-sm text-gray-600 mt-1">{check.evidence}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Last checked: {new Date(check.lastChecked).toLocaleDateString()} | 
                        Next review: {new Date(check.nextReview).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      check.status === 'compliant' ? 'bg-green-100 text-green-800' :
                      check.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                      check.status === 'non-compliant' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {check.status.replace('-', ' ').toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Generate security report
  const generateSecurityReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      securityScore: calculateSecurityScore(),
      summary: {
        totalTests: securityTests.length,
        passed: securityTests.filter(t => t.status === 'passed').length,
        failed: securityTests.filter(t => t.status === 'failed').length,
        pending: securityTests.filter(t => t.status === 'pending').length
      },
      vulnerabilities: {
        total: vulnerabilities.length,
        bySeverity: {
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          medium: vulnerabilities.filter(v => v.severity === 'medium').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length
        }
      },
      compliance: {
        compliant: complianceChecks.filter(c => c.status === 'compliant').length,
        partial: complianceChecks.filter(c => c.status === 'partial').length,
        nonCompliant: complianceChecks.filter(c => c.status === 'non-compliant').length
      },
      recommendations: [
        'Implement Content Security Policy headers',
        'Update vulnerable npm dependencies',
        'Add rate limiting to all API endpoints',
        'Implement comprehensive security logging',
        'Conduct regular security training for developers'
      ]
    };

    // Download report as JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="security-testing-dashboard p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Shield className="mr-3 text-blue-600" />
          Security Testing Dashboard
        </h1>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'tests'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Security Tests ({securityTests.length})
          </button>
          <button
            onClick={() => setActiveTab('vulnerabilities')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'vulnerabilities'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Vulnerabilities ({vulnerabilities.length})
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'compliance'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Compliance
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Generate Report
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'tests' && renderSecurityTests()}
          {activeTab === 'vulnerabilities' && renderVulnerabilities()}
          {activeTab === 'compliance' && renderCompliance()}
          {activeTab === 'report' && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Security Assessment Report</h2>
              <p className="text-gray-600 mb-6">
                Generate a comprehensive security report including all test results, 
                vulnerabilities, and compliance status.
              </p>
              <button
                onClick={generateSecurityReport}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center mx-auto"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Security Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};