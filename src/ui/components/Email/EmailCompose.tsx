import React, { useState } from "react";
import {
  XMarkIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  EyeIcon,
  DocumentTextIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

export interface EmailComposeProps {
  onClose: () => void;
  onSend: (emailData: EmailData) => void;
  replyTo?: {
    id: string;
    subject: string;
    from: string;
    to: string[];
  };
  template?: string;
}

export interface EmailData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: File[];
  priority?: "low" | "normal" | "high";
  template?: string;
}

export const EmailCompose: React.FC<EmailComposeProps> = ({
  onClose,
  onSend,
  replyTo,
  template,
}) => {
  const [emailData, setEmailData] = useState<EmailData>({
    to: replyTo ? [replyTo.from] : [],
    subject: replyTo ? `Re: ${replyTo.subject}` : "",
    body: "",
    priority: "normal",
    attachments: [],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Email templates for TD SYNNEX workflows
  const emailTemplates = [
    {
      id: "order-confirmation",
      name: "Order Confirmation",
      subject: "Order Confirmation - PO #{PO_NUMBER}",
      body: `Dear {CUSTOMER_NAME},

Thank you for your order. We have received your purchase order #{PO_NUMBER} and are processing it.

Order Details:
- PO Number: {PO_NUMBER}
- Order Date: {ORDER_DATE}
- Expected Delivery: {DELIVERY_DATE}

Your order is now in our system and will be processed within 2-4 business hours. You will receive tracking information once your order ships.

If you have any questions, please don't hesitate to contact us.

Best regards,
TD SYNNEX Team`,
    },
    {
      id: "quote-response",
      name: "Quote Response",
      subject: "Quote Response - {QUOTE_NUMBER}",
      body: `Dear {CUSTOMER_NAME},

Thank you for your quote request. Please find the requested pricing information below:

Quote Number: {QUOTE_NUMBER}
Valid Until: {EXPIRY_DATE}

{QUOTE_DETAILS}

This quote is valid for 30 days from the date of issue. Please let us know if you need any clarifications or have additional requirements.

We look forward to your business.

Best regards,
TD SYNNEX Sales Team`,
    },
    {
      id: "support-response",
      name: "Support Response",
      subject: "Support Case Update - {CASE_NUMBER}",
      body: `Dear {CUSTOMER_NAME},

Thank you for contacting TD SYNNEX support. We have received your case and assigned it the reference number {CASE_NUMBER}.

Case Details:
- Case Number: {CASE_NUMBER}
- Priority: {PRIORITY}
- Status: In Progress

Our technical team is reviewing your request and will respond within {SLA_TIME}. You will receive updates as we progress with your case.

If you have any urgent questions, please contact us at support@tdsynnex.com.

Best regards,
TD SYNNEX Support Team`,
    },
  ];

  const handleInputChange = (field: keyof EmailData, value: string | string[] | File[]) => {
    setEmailData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToChange = (value: string) => {
    const emails = value
      .split(",")
      .map((email: string) => email.trim())
      .filter((email: string) => email);
    handleInputChange("to", emails);
  };

  const handleCcChange = (value: string) => {
    const emails = value
      .split(",")
      .map((email: string) => email.trim())
      .filter((email: string) => email);
    handleInputChange("cc", emails);
  };

  const handleBccChange = (value: string) => {
    const emails = value
      .split(",")
      .map((email: string) => email.trim())
      .filter((email: string) => email);
    handleInputChange("bcc", emails);
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = emailTemplates.find((t) => t.id === templateId);
    if (template) {
      setEmailData((prev) => ({
        ...prev,
        subject: template.subject,
        body: template.body,
        template: templateId,
      }));
    }
  };

  const handleAttachmentAdd = (files: FileList) => {
    const newAttachments = Array.from(files);
    setEmailData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...newAttachments],
    }));
  };

  const handleAttachmentRemove = (index: number) => {
    setEmailData((prev) => ({
      ...prev,
      attachments: prev.attachments?.filter((_: File, i: number) => i !== index),
    }));
  };

  const handleSend = async () => {
    if (
      !emailData?.to?.length ||
      !emailData?.subject?.trim() ||
      !emailData?.body?.trim()
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      await onSend(emailData);
    } catch (error) {
      console.error("Failed to send email:", error);
      alert("Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidForm = () => {
    return (
      emailData?.to?.length > 0 &&
      emailData?.to?.every((email: string) => validateEmail(email)) &&
      emailData?.subject?.trim() &&
      emailData?.body?.trim()
    );
  };

  return (
    <div className="email-compose">
      <div className="email-compose__overlay" onClick={onClose} />

      <div className="email-compose__modal">
        <div className="email-compose__header">
          <h2>Compose Email</h2>
          <button onClick={onClose} className="email-compose__close">
            <XMarkIcon className="email-compose__close-icon" />
          </button>
        </div>

        <div className="email-compose__content">
          {/* Email Template Selection */}
          <div className="email-compose__templates">
            <label className="email-compose__label">
              <DocumentTextIcon className="email-compose__label-icon" />
              Template
            </label>
            <select
              value={emailData.template || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleTemplateSelect(e?.target?.value)}
              className="email-compose__select"
            >
              <option value="">Select Template</option>
              {emailTemplates?.map((template: { id: string; name: string; subject: string; body: string }) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipients */}
          <div className="email-compose__recipients">
            <div className="email-compose__field">
              <label className="email-compose__label">
                <UserPlusIcon className="email-compose__label-icon" />
                To *
              </label>
              <input
                type="text"
                value={emailData?.to?.join(", ")}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleToChange(e?.target?.value)}
                placeholder="Enter email addresses separated by commas"
                className="email-compose__input"
                required
              />
            </div>

            <div className="email-compose__field">
              <label className="email-compose__label">CC</label>
              <input
                type="text"
                value={(emailData.cc || []).join(", ")}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleCcChange(e?.target?.value)}
                placeholder="Enter CC email addresses"
                className="email-compose__input"
              />
            </div>

            <div className="email-compose__field">
              <label className="email-compose__label">BCC</label>
              <input
                type="text"
                value={(emailData.bcc || []).join(", ")}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleBccChange(e?.target?.value)}
                placeholder="Enter BCC email addresses"
                className="email-compose__input"
              />
            </div>
          </div>

          {/* Subject and Priority */}
          <div className="email-compose__subject-row">
            <div className="email-compose__field email-compose__field--subject">
              <label className="email-compose__label">Subject *</label>
              <input
                type="text"
                value={emailData.subject}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleInputChange("subject", e?.target?.value)}
                placeholder="Enter email subject"
                className="email-compose__input"
                required
              />
            </div>

            <div className="email-compose__field email-compose__field--priority">
              <label className="email-compose__label">Priority</label>
              <select
                value={emailData.priority}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleInputChange("priority", e?.target?.value)}
                className="email-compose__select"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Email Body */}
          <div className="email-compose__body">
            <div className="email-compose__body-header">
              <label className="email-compose__label">Message *</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="email-compose__preview-btn"
              >
                <EyeIcon className="email-compose__preview-icon" />
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>

            {showPreview ? (
              <div className="email-compose__preview">
                <div className="email-compose__preview-content">
                  {emailData?.body?.split("\n").map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            ) : (
              <textarea
                value={emailData.body}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleInputChange("body", e?.target?.value)}
                placeholder="Enter your message here..."
                className="email-compose__textarea"
                rows={12}
                required
              />
            )}
          </div>

          {/* Attachments */}
          <div className="email-compose__attachments">
            <label className="email-compose__label">
              <PaperClipIcon className="email-compose__label-icon" />
              Attachments
            </label>

            <div className="email-compose__attachment-controls">
              <input
                type="file"
                multiple
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  (e.target as HTMLInputElement).files && handleAttachmentAdd((e.target as HTMLInputElement).files!)
                }
                className="email-compose__file-input"
                id="attachment-input"
              />
              <label
                htmlFor="attachment-input"
                className="email-compose__file-label"
              >
                Add Files
              </label>
            </div>

            {emailData.attachments && emailData?.attachments?.length > 0 && (
              <div className="email-compose__attachment-list">
                {emailData?.attachments?.map((file, index) => (
                  <div key={index} className="email-compose__attachment-item">
                    <span className="email-compose__attachment-name">
                      {file.name}
                    </span>
                    <span className="email-compose__attachment-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() => handleAttachmentRemove(index)}
                      className="email-compose__attachment-remove"
                    >
                      <XMarkIcon className="email-compose__attachment-remove-icon" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="email-compose__footer">
          <div className="email-compose__validation">
            {!isValidForm() && (
              <p className="email-compose__error">
                Please fill in all required fields with valid email addresses
              </p>
            )}
          </div>

          <div className="email-compose__actions">
            <button
              onClick={onClose}
              className="email-compose__action-btn email-compose__action-btn--cancel"
            >
              Cancel
            </button>

            <button
              onClick={handleSend}
              disabled={!isValidForm() || isLoading}
              className="email-compose__action-btn email-compose__action-btn--send"
            >
              {isLoading ? (
                <>
                  <div className="email-compose__spinner" />
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="email-compose__action-icon" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
