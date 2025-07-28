import React, { useState } from "react";
import type { UnifiedEmailData } from "../../../types/unified-email.types.js";
import "./EmailListView.css";

interface EmailListViewProps {
  emails: UnifiedEmailData[];
  onEmailSelect: (email: UnifiedEmailData) => void;
  selectedEmailId?: string;
}

// Mock data for demonstration
const mockEmails: UnifiedEmailData[] = [
  {
    id: "1",
    messageId: "msg-001",
    subject: "Firewall Inquiry",
    bodyText: "Information an auto",
    from: "insight1fortinet@TDSynnex.com",
    to: ["John Smith"],
    receivedAt: new Date().toISOString(),
    workflowState: "IN_PROGRESS",
    isWorkflowComplete: false,
    priority: "high",
    status: "processing",
    hasAttachments: false,
    isRead: true,
    analysis: {
      summary: "Information an auto",
      sentiment: "neutral",
      intent: "inquiry",
      topics: ["firewall", "security"],
    },
  },
  {
    id: "2",
    messageId: "msg-002",
    subject: "DNS Protection Quote",
    bodyText: "Quote requested fork",
    from: "insight1infoblox@TDSynnex.com",
    to: ["Emily Johnson"],
    receivedAt: new Date().toISOString(),
    workflowState: "IN_PROGRESS",
    isWorkflowComplete: false,
    priority: "high",
    status: "processing",
    hasAttachments: false,
    isRead: true,
    analysis: {
      summary: "Quote requested fork",
      sentiment: "neutral",
      intent: "quote_request",
      topics: ["DNS", "protection"],
    },
    agentAssignment: {
      agentId: "john-miller",
      agentName: "John Miller",
      assignedAt: new Date().toISOString(),
      status: "processing",
    },
  },
];

const sampleMarketing = [
  {
    id: "3",
    from: "Marketing-Splunk@TDSynnex.com",
    requestedBy: "Michael Brown",
    subject: "Marketing Campaign",
    summary: "Collaboration on mf",
    assignedTo: "Sarah Wilson",
    action: "pending",
  },
  {
    id: "4",
    from: "SalesCisco@TDSynnex.com",
    requestedBy: "Jennifer Davis",
    subject: "Pricing details",
    summary: "Provide pricing details",
    assignedTo: "Richard Lee",
    action: "pending",
  },
];

const sampleVMware = [
  {
    id: "5",
    from: "VMware@TDSynnex.com",
    requestedBy: "Daniel Martinez",
    subject: "Support",
    summary: "Support case closure",
    status: "Confirms closure case",
    assignedTo: "Jessica Taylor",
    statusColor: "green",
  },
  {
    id: "6",
    from: "Sales-PaloAlto@TDSynnex.com",
    requestedBy: "Heather Green",
    subject: "Information on firewall systems",
    summary: "Respond with information on firewall systems",
    status: "Responded",
    statusColor: "green",
  },
];

export const EmailListView: React.FC<EmailListViewProps> = ({
  emails,
  onEmailSelect,
  selectedEmailId,
}) => {
  const [activeTab, setActiveTab] = useState<"alias" | "marketing" | "vmware">("alias");
  
  // Use mock data if no emails provided
  const displayEmails = emails.length > 0 ? emails : mockEmails;

  const renderEmailAliasTable = () => (
    <div className="email-table-container">
      <table className="email-table">
        <thead>
          <tr>
            <th>Email Alias</th>
            <th>Requested By</th>
            <th>Subject</th>
            <th>Summary</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {displayEmails.map((email) => (
            <tr
              key={email.id}
              className={selectedEmailId === email.id ? "selected" : ""}
              onClick={() => onEmailSelect(email)}
            >
              <td>{email.from}</td>
              <td>{email.to?.[0] || "Unknown"}</td>
              <td>{email.subject}</td>
              <td>{email.analysis?.summary || email.bodyText?.substring(0, 50) || "No summary"}</td>
              <td>
                <span className={`status-indicator status-${email.priority === "high" ? "red" : "yellow"}`}>
                  ●
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderMarketingTable = () => (
    <div className="email-table-container">
      <table className="email-table">
        <thead>
          <tr>
            <th>Marketing-Splunk</th>
            <th>Requested By</th>
            <th>Subject</th>
            <th>Assigned To</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sampleMarketing.map((item) => (
            <tr key={item.id}>
              <td>{item.from}</td>
              <td>{item.requestedBy}</td>
              <td>{item.subject}</td>
              <td>{item.assignedTo}</td>
              <td>
                <span className="status-indicator status-yellow">●</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderVMwareTable = () => (
    <div className="email-table-container">
      <table className="email-table">
        <thead>
          <tr>
            <th>VMware@TDSynnex</th>
            <th>Daniel Martinez</th>
            <th>Support</th>
            <th>Status</th>
            <th>Green</th>
          </tr>
        </thead>
        <tbody>
          {sampleVMware.map((item) => (
            <tr key={item.id}>
              <td>{item.from}</td>
              <td>{item.requestedBy}</td>
              <td>{item.subject}</td>
              <td>{item.status}</td>
              <td>
                <span className={`status-indicator status-${item.statusColor}`}>●</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="email-list-view">
      <div className="email-list-header">
        <div className="email-tabs">
          <button 
            className={`email-tab ${activeTab === "alias" ? "active" : ""}`}
            onClick={() => setActiveTab("alias")}
          >
            Email Alias ({displayEmails.length})
          </button>
          <button 
            className={`email-tab ${activeTab === "marketing" ? "active" : ""}`}
            onClick={() => setActiveTab("marketing")}
          >
            Marketing-Splunk ({sampleMarketing.length})
          </button>
          <button 
            className={`email-tab ${activeTab === "vmware" ? "active" : ""}`}
            onClick={() => setActiveTab("vmware")}
          >
            VMware@TDSynnex ({sampleVMware.length})
          </button>
        </div>
      </div>
      <div className="email-list-content">
        {activeTab === "alias" && renderEmailAliasTable()}
        {activeTab === "marketing" && renderMarketingTable()}
        {activeTab === "vmware" && renderVMwareTable()}
      </div>
    </div>
  );
};
