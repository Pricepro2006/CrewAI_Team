import React, { useState, useEffect } from 'react';
import { Lock, Shield, FileCheck, AlertCircle, CheckCircle, XCircle, Eye, Download, UserCheck } from 'lucide-react';

// 2025 Best Practice: Data Privacy Compliance Verification System

interface PrivacyControl {
  id: string;
  category: string;
  control: string;
  description: string;
  regulation: ('GDPR' | 'CCPA' | 'HIPAA' | 'PCI-DSS' | 'SOX')[];
  implementationStatus: 'implemented' | 'partial' | 'not-implemented' | 'not-applicable';
  evidence: string;
  lastReviewed: Date;
  reviewer: string;
  riskLevel: 'high' | 'medium' | 'low';
  automatedCheck?: boolean;
  testResult?: 'pass' | 'fail' | 'pending';
}

interface DataMapping {
  id: string;
  dataType: string;
  description: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  personalData: boolean;
  sensitiveData: boolean;
  location: string[];
  retention: string;
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    algorithm?: string;
  };
  accessControls: string[];
  processingPurpose: string[];
}

interface PrivacyIncident {
  id: string;
  type: 'breach' | 'unauthorized-access' | 'data-loss' | 'policy-violation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedData: string[];
  affectedUsers: number;
  discoveredAt: Date;
  reportedAt?: Date;
  resolvedAt?: Date;
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  actions: string[];
}

interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  granted: boolean;
  timestamp: Date;
  expiresAt?: Date;
  withdrawnAt?: Date;
  ipAddress: string;
  userAgent: string;
  version: string;
}

export const DataPrivacyComplianceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'controls' | 'data-mapping' | 'incidents' | 'consent' | 'audit'>('controls');
  const [privacyControls, setPrivacyControls] = useState<PrivacyControl[]>([]);
  const [dataMapping, setDataMapping] = useState<DataMapping[]>([]);
  const [incidents, setIncidents] = useState<PrivacyIncident[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [complianceScore, setComplianceScore] = useState(0);

  // Initialize privacy controls
  useEffect(() => {
    const controls: PrivacyControl[] = [
      // Data Subject Rights
      {
        id: 'dsr-01',
        category: 'Data Subject Rights',
        control: 'Right to Access',
        description: 'Users can request and download their personal data',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'implemented',
        evidence: 'Export functionality in Email Dashboard allows data download',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },
      {
        id: 'dsr-02',
        category: 'Data Subject Rights',
        control: 'Right to Erasure',
        description: 'Users can request deletion of their personal data',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'partial',
        evidence: 'Manual process in place, automated deletion in development',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'high',
        automatedCheck: false
      },
      {
        id: 'dsr-03',
        category: 'Data Subject Rights',
        control: 'Right to Rectification',
        description: 'Users can correct inaccurate personal data',
        regulation: ['GDPR'],
        implementationStatus: 'implemented',
        evidence: 'Profile update functionality available',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'medium',
        automatedCheck: true,
        testResult: 'pass'
      },
      {
        id: 'dsr-04',
        category: 'Data Subject Rights',
        control: 'Right to Data Portability',
        description: 'Users can transfer data to another service',
        regulation: ['GDPR'],
        implementationStatus: 'implemented',
        evidence: 'Export in machine-readable formats (CSV, JSON)',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'medium',
        automatedCheck: true,
        testResult: 'pass'
      },

      // Consent Management
      {
        id: 'consent-01',
        category: 'Consent Management',
        control: 'Explicit Consent Collection',
        description: 'Clear opt-in for data processing',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'implemented',
        evidence: 'Consent modal with granular options',
        lastReviewed: new Date(),
        reviewer: 'Legal Team',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },
      {
        id: 'consent-02',
        category: 'Consent Management',
        control: 'Consent Withdrawal',
        description: 'Easy mechanism to withdraw consent',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'implemented',
        evidence: 'One-click withdrawal in privacy settings',
        lastReviewed: new Date(),
        reviewer: 'Legal Team',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },

      // Data Security
      {
        id: 'security-01',
        category: 'Data Security',
        control: 'Encryption at Rest',
        description: 'All personal data encrypted in storage',
        regulation: ['GDPR', 'HIPAA', 'PCI-DSS'],
        implementationStatus: 'implemented',
        evidence: 'AES-256 encryption for database',
        lastReviewed: new Date(),
        reviewer: 'Security Team',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },
      {
        id: 'security-02',
        category: 'Data Security',
        control: 'Encryption in Transit',
        description: 'All data transmissions use TLS 1.3',
        regulation: ['GDPR', 'HIPAA', 'PCI-DSS'],
        implementationStatus: 'implemented',
        evidence: 'SSL certificates and HTTPS enforcement',
        lastReviewed: new Date(),
        reviewer: 'Security Team',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },
      {
        id: 'security-03',
        category: 'Data Security',
        control: 'Access Control',
        description: 'Role-based access to personal data',
        regulation: ['GDPR', 'HIPAA', 'SOX'],
        implementationStatus: 'implemented',
        evidence: 'RBAC system with audit logging',
        lastReviewed: new Date(),
        reviewer: 'Security Team',
        riskLevel: 'high',
        automatedCheck: true,
        testResult: 'pass'
      },

      // Data Minimization
      {
        id: 'minimize-01',
        category: 'Data Minimization',
        control: 'Purpose Limitation',
        description: 'Collect only necessary data',
        regulation: ['GDPR'],
        implementationStatus: 'implemented',
        evidence: 'Minimal form fields, documented purposes',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'medium',
        automatedCheck: false
      },
      {
        id: 'minimize-02',
        category: 'Data Minimization',
        control: 'Retention Limits',
        description: 'Automatic data deletion after retention period',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'partial',
        evidence: 'Retention policy defined, automation in progress',
        lastReviewed: new Date(),
        reviewer: 'Privacy Officer',
        riskLevel: 'medium',
        automatedCheck: false
      },

      // Transparency
      {
        id: 'transparency-01',
        category: 'Transparency',
        control: 'Privacy Notice',
        description: 'Clear and accessible privacy policy',
        regulation: ['GDPR', 'CCPA'],
        implementationStatus: 'implemented',
        evidence: 'Privacy policy updated and accessible',
        lastReviewed: new Date(),
        reviewer: 'Legal Team',
        riskLevel: 'medium',
        automatedCheck: false
      },
      {
        id: 'transparency-02',
        category: 'Transparency',
        control: 'Processing Notification',
        description: 'Inform users about data processing',
        regulation: ['GDPR'],
        implementationStatus: 'implemented',
        evidence: 'Just-in-time notifications implemented',
        lastReviewed: new Date(),
        reviewer: 'Legal Team',
        riskLevel: 'low',
        automatedCheck: true,
        testResult: 'pass'
      }
    ];

    setPrivacyControls(controls);

    // Initialize data mapping
    const mapping: DataMapping[] = [
      {
        id: 'dm-01',
        dataType: 'Email Addresses',
        description: 'User email addresses for authentication and communication',
        classification: 'confidential',
        personalData: true,
        sensitiveData: false,
        location: ['PostgreSQL Database', 'Redis Cache'],
        retention: '3 years after last activity',
        encryption: { atRest: true, inTransit: true, algorithm: 'AES-256' },
        accessControls: ['Admin', 'Support Team'],
        processingPurpose: ['Authentication', 'Communication', 'Support']
      },
      {
        id: 'dm-02',
        dataType: 'User Names',
        description: 'Full names of users',
        classification: 'confidential',
        personalData: true,
        sensitiveData: false,
        location: ['PostgreSQL Database'],
        retention: '3 years after account closure',
        encryption: { atRest: true, inTransit: true, algorithm: 'AES-256' },
        accessControls: ['Admin', 'Support Team'],
        processingPurpose: ['Identification', 'Communication']
      },
      {
        id: 'dm-03',
        dataType: 'Activity Logs',
        description: 'User activity and audit trails',
        classification: 'internal',
        personalData: true,
        sensitiveData: false,
        location: ['Elasticsearch', 'S3 Archive'],
        retention: '1 year active, 2 years archive',
        encryption: { atRest: true, inTransit: true },
        accessControls: ['Admin', 'Security Team'],
        processingPurpose: ['Security', 'Compliance', 'Debugging']
      },
      {
        id: 'dm-04',
        dataType: 'IP Addresses',
        description: 'User IP addresses for security',
        classification: 'confidential',
        personalData: true,
        sensitiveData: false,
        location: ['Application Logs', 'WAF Logs'],
        retention: '90 days',
        encryption: { atRest: true, inTransit: true },
        accessControls: ['Security Team'],
        processingPurpose: ['Security', 'Fraud Prevention']
      }
    ];

    setDataMapping(mapping);

    // Calculate compliance score
    const implemented = controls.filter(c => c.implementationStatus === 'implemented').length;
    const total = controls.length;
    setComplianceScore(Math.round((implemented / total) * 100));
  }, []);

  // Run automated privacy test
  const runAutomatedTest = async (control: PrivacyControl) => {
    setPrivacyControls(prev => 
      prev.map(c => c.id === control.id ? { ...c, testResult: 'pending' } : c)
    );

    // Simulate test execution
    setTimeout(() => {
      const passed = Math.random() > 0.2; // 80% pass rate
      setPrivacyControls(prev => 
        prev.map(c => c.id === control.id ? { ...c, testResult: passed ? 'pass' : 'fail' } : c)
      );

      if (!passed) {
        // Create incident for failed test
        const incident: PrivacyIncident = {
          id: `inc-${Date.now()}`,
          type: 'policy-violation',
          severity: control.riskLevel === 'high' ? 'high' : 'medium',
          description: `Automated test failed for: ${control.control}`,
          affectedData: ['User Personal Data'],
          affectedUsers: 0,
          discoveredAt: new Date(),
          status: 'open',
          actions: ['Investigate root cause', 'Implement fix', 'Re-test']
        };
        setIncidents(prev => [...prev, incident]);
      }
    }, 2000);
  };

  // Render privacy controls
  const renderPrivacyControls = () => (
    <div className="space-y-6">
      {/* Compliance Score */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Privacy Compliance Score</h2>
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
                stroke={complianceScore > 80 ? '#10b981' : complianceScore > 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(complianceScore / 100) * 553} 553`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold">{complianceScore}%</div>
                <div className="text-sm text-gray-600">Compliance</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls by Category */}
      {['Data Subject Rights', 'Consent Management', 'Data Security', 'Data Minimization', 'Transparency'].map(category => {
        const categoryControls = privacyControls.filter(c => c.category === category);

        return (
          <div key={category} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{category}</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {categoryControls.map(control => (
                  <div key={control.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{control.control}</h4>
                        <p className="text-sm text-gray-600 mt-1">{control.description}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          {control.regulation.map(reg => (
                            <span key={reg} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              {reg}
                            </span>
                          ))}
                          <span className={`px-2 py-1 text-xs rounded ${
                            control.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                            control.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {control.riskLevel} risk
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Evidence: {control.evidence}
                        </p>
                      </div>
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          control.implementationStatus === 'implemented' ? 'bg-green-100 text-green-800' :
                          control.implementationStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          control.implementationStatus === 'not-implemented' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {control.implementationStatus.replace('-', ' ')}
                        </span>
                        {control.automatedCheck && (
                          <button
                            onClick={() => runAutomatedTest(control)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Run Test
                          </button>
                        )}
                        {control.testResult && (
                          <div className={`flex items-center text-sm ${
                            control.testResult === 'pass' ? 'text-green-600' :
                            control.testResult === 'fail' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {control.testResult === 'pass' && <CheckCircle className="w-4 h-4 mr-1" />}
                            {control.testResult === 'fail' && <XCircle className="w-4 h-4 mr-1" />}
                            {control.testResult === 'pending' && (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-1" />
                            )}
                            {control.testResult}
                          </div>
                        )}
                      </div>
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

  // Render data mapping
  const renderDataMapping = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Personal Data Inventory</h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retention
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Encryption
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dataMapping.map(data => (
                  <tr key={data.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{data.dataType}</div>
                        <div className="text-xs text-gray-500">{data.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        data.classification === 'restricted' ? 'bg-red-100 text-red-800' :
                        data.classification === 'confidential' ? 'bg-orange-100 text-orange-800' :
                        data.classification === 'internal' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {data.classification}
                      </span>
                      {data.personalData && (
                        <span className="ml-1 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                          PII
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {data.location.join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.retention}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {data.encryption.atRest && (
                          <span className="text-green-600" title="Encrypted at Rest">
                            <Lock className="w-4 h-4" />
                          </span>
                        )}
                        {data.encryption.inTransit && (
                          <span className="text-green-600" title="Encrypted in Transit">
                            <Shield className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {data.processingPurpose.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Flow Visualization</h3>
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            Interactive data flow diagram showing how personal data moves through the system
          </p>
          <div className="mt-4 flex justify-center space-x-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <UserCheck className="w-10 h-10 text-blue-600" />
              </div>
              <p className="text-sm font-medium">User Input</p>
            </div>
            <div className="flex items-center">
              <div className="w-16 h-0.5 bg-gray-400"></div>
              <div className="w-0 h-0 border-l-8 border-l-gray-400 border-y-4 border-y-transparent"></div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <Shield className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-sm font-medium">Processing</p>
            </div>
            <div className="flex items-center">
              <div className="w-16 h-0.5 bg-gray-400"></div>
              <div className="w-0 h-0 border-l-8 border-l-gray-400 border-y-4 border-y-transparent"></div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-10 h-10 text-purple-600" />
              </div>
              <p className="text-sm font-medium">Storage</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Generate privacy report
  const generatePrivacyReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      complianceScore,
      controls: {
        total: privacyControls.length,
        implemented: privacyControls.filter(c => c.implementationStatus === 'implemented').length,
        partial: privacyControls.filter(c => c.implementationStatus === 'partial').length,
        notImplemented: privacyControls.filter(c => c.implementationStatus === 'not-implemented').length
      },
      dataInventory: dataMapping.length,
      activeIncidents: incidents.filter(i => i.status !== 'resolved').length,
      regulations: ['GDPR', 'CCPA', 'HIPAA', 'PCI-DSS', 'SOX'],
      recommendations: [
        'Complete implementation of automated data deletion',
        'Enhance consent management UI',
        'Implement privacy by design in new features',
        'Conduct privacy impact assessments',
        'Regular privacy training for developers'
      ]
    };

    // Download report
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-compliance-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="data-privacy-compliance-dashboard p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <Lock className="mr-3 text-blue-600" />
          Data Privacy Compliance Dashboard
        </h1>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'controls'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Privacy Controls
          </button>
          <button
            onClick={() => setActiveTab('data-mapping')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'data-mapping'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Data Mapping
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'incidents'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Incidents ({incidents.filter(i => i.status !== 'resolved').length})
          </button>
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'consent'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Consent Management
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Audit & Reports
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'controls' && renderPrivacyControls()}
          {activeTab === 'data-mapping' && renderDataMapping()}
          {activeTab === 'incidents' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Privacy Incidents</h2>
              {incidents.length === 0 ? (
                <p className="text-gray-600">No privacy incidents reported</p>
              ) : (
                <div className="space-y-4">
                  {incidents.map(incident => (
                    <div key={incident.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{incident.description}</h3>
                          <div className="flex items-center space-x-3 mt-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              incident.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              incident.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {incident.severity}
                            </span>
                            <span className="text-sm text-gray-600">
                              {incident.affectedUsers} users affected
                            </span>
                            <span className="text-sm text-gray-600">
                              {new Date(incident.discoveredAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          incident.status === 'contained' ? 'bg-blue-100 text-blue-800' :
                          incident.status === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'consent' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Consent Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-800">Active Consents</h3>
                  <div className="text-2xl font-bold text-green-900">1,234</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800">Withdrawn</h3>
                  <div className="text-2xl font-bold text-red-900">56</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800">Consent Rate</h3>
                  <div className="text-2xl font-bold text-blue-900">95.6%</div>
                </div>
              </div>
              <p className="text-gray-600">
                Detailed consent records and management interface available in production system
              </p>
            </div>
          )}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <FileCheck className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Privacy Compliance Report</h2>
              <p className="text-gray-600 mb-6">
                Generate a comprehensive privacy compliance report including all controls, 
                data mapping, and incident history.
              </p>
              <button
                onClick={generatePrivacyReport}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center mx-auto"
              >
                <Download className="w-5 h-5 mr-2" />
                Generate Privacy Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};