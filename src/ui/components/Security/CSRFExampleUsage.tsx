import React, { useState } from "react";
import { useCSRF } from "../../hooks/useCSRF.js";
import {
  useCSRFProtectedMutation,
  useCSRFFormSubmit,
} from "../../hooks/useCSRFProtectedMutation.js";
import { CSRFErrorModal, useCSRFErrorModal } from "./CSRFErrorModal.js";
import { CSRFMonitor } from "./CSRFMonitor.js";

/**
 * Example component demonstrating CSRF protection usage
 * This component shows best practices for integrating CSRF protection
 */
export const CSRFExampleUsage: React.FC = () => {
  const { token, isLoading, error, refreshToken } = useCSRF();
  const [formData, setFormData] = useState({ name: "", email: "" });
  const csrfErrorModal = useCSRFErrorModal();

  // Example 1: Using CSRF-protected form submission
  const formSubmit = useCSRFFormSubmit({
    onSuccess: (data) => {
      console.log("Form submitted successfully:", data);
      alert("Form submitted successfully!");
    },
    onError: (error) => {
      console.error("Form submission failed:", error);
      // Show CSRF error modal if it's a CSRF error
      if (error.message.toLowerCase().includes("csrf")) {
        csrfErrorModal.showError(error, () =>
          formSubmit.submit("/api/example", formData),
        );
      } else {
        alert("Form submission failed: " + error.message);
      }
    },
  });

  // Example 2: Using tRPC mutation with CSRF protection
  // This would be your actual tRPC mutation:
  // const createUserMutation = useCSRFProtectedMutation(
  //   api.user.create,
  //   {
  //     onSuccess: (data) => {
  //       console.log('User created:', data);
  //     },
  //     onCSRFError: (error) => {
  //       csrfErrorModal.showError(error, () => createUserMutation.mutate(userData));
  //     },
  //   }
  // );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await formSubmit.submit("/api/example-form", formData);
    } catch (error) {
      // Error handling is done in the hook's onError callback
    }
  };

  const handleManualRefresh = async () => {
    try {
      await refreshToken();
      alert("CSRF token refreshed successfully!");
    } catch (error) {
      alert("Failed to refresh token: " + (error as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          CSRF Protection Example
        </h2>

        {/* CSRF Status Monitor */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Security Status</h3>
          <CSRFMonitor showDetails={true} />
          {token && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Token (first 8 chars): {token.substring(0, 8)}...
            </div>
          )}
        </div>

        {/* Manual Token Refresh */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Manual Token Management
          </h3>
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Refreshing..." : "Refresh CSRF Token"}
          </button>
        </div>

        {/* Example Form with CSRF Protection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Protected Form Example</h3>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500
                         dark:bg-gray-700 dark:text-white"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                         rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500
                         dark:bg-gray-700 dark:text-white"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={formSubmit.isSubmitting || !token}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       flex items-center justify-center"
            >
              {formSubmit.isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                "Submit Form (CSRF Protected)"
              )}
            </button>
          </form>

          {formSubmit.error && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">
                Error: {formSubmit.error.message}
              </p>
            </div>
          )}
        </div>

        {/* Error States */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              CSRF Error
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error.message}
            </p>
            <button
              onClick={handleManualRefresh}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Try to Recover
            </button>
          </div>
        )}

        {/* Development Information */}
        {process.env.NODE_ENV === "development" && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
            <h3 className="text-lg font-semibold mb-2">Development Info</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• CSRF tokens are automatically included in all requests</li>
              <li>• Tokens are rotated periodically for security</li>
              <li>
                • Failed requests are automatically retried with fresh tokens
              </li>
              <li>• Manual token refresh is available for testing</li>
              <li>• Error modals provide user-friendly error handling</li>
            </ul>
          </div>
        )}
      </div>

      {/* CSRF Error Modal */}
      <CSRFErrorModal
        isOpen={csrfErrorModal.isOpen}
        onClose={csrfErrorModal.handleClose}
        onRetry={csrfErrorModal.handleRetry}
        error={csrfErrorModal.error}
        retryCount={csrfErrorModal.retryCount}
      />
    </div>
  );
};

export default CSRFExampleUsage;
