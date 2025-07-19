import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle, Send, Download } from 'lucide-react';

// 2025 Best Practice: Stakeholder Feedback Collection System

interface FeedbackItem {
  id: string;
  stakeholder: string;
  role: string;
  feature: string;
  rating: 1 | 2 | 3 | 4 | 5;
  type: 'positive' | 'negative' | 'suggestion' | 'bug';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in-review' | 'accepted' | 'implemented' | 'rejected';
  createdAt: Date;
  attachments?: string[];
  response?: {
    responder: string;
    message: string;
    respondedAt: Date;
  };
}

interface FeedbackMetrics {
  averageRating: number;
  totalFeedback: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byFeature: Record<string, number>;
  satisfactionTrend: Array<{ date: string; rating: number }>;
}

export const StakeholderFeedbackPortal: React.FC = () => {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [metrics, setMetrics] = useState<FeedbackMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<'collect' | 'review' | 'metrics'>('collect');
  const [newFeedback, setNewFeedback] = useState({
    stakeholder: '',
    role: '',
    feature: '',
    rating: 3 as 1 | 2 | 3 | 4 | 5,
    type: 'suggestion' as const,
    description: '',
    priority: 'medium' as const
  });

  // Feature areas for feedback
  const featureAreas = [
    'Email Table Display',
    'Filtering & Search',
    'Status Management',
    'Real-time Updates',
    'Export Functionality',
    'Performance',
    'User Interface',
    'Integration',
    'Security',
    'Overall Experience'
  ];

  // Stakeholder roles
  const stakeholderRoles = [
    'Business Analyst',
    'Product Owner',
    'End User',
    'IT Administrator',
    'Department Manager',
    'External Partner',
    'Executive Sponsor'
  ];

  // Submit feedback
  const submitFeedback = () => {
    const feedback: FeedbackItem = {
      id: `fb-${Date.now()}`,
      ...newFeedback,
      status: 'new',
      createdAt: new Date()
    };

    setFeedbackItems([...feedbackItems, feedback]);
    
    // Reset form
    setNewFeedback({
      stakeholder: '',
      role: '',
      feature: '',
      rating: 3,
      type: 'suggestion',
      description: '',
      priority: 'medium'
    });

    // Show success notification
    alert('Thank you for your feedback! We will review it shortly.');
  };

  // Calculate metrics
  useEffect(() => {
    if (feedbackItems.length === 0) return;

    const totalRating = feedbackItems.reduce((sum, item) => sum + item.rating, 0);
    const avgRating = totalRating / feedbackItems.length;

    const byType = feedbackItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPriority = feedbackItems.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byFeature = feedbackItems.reduce((acc, item) => {
      acc[item.feature] = (acc[item.feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate satisfaction trend (mock data for demo)
    const trend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split('T')[0],
        rating: 3.5 + Math.random() * 1.5
      };
    });

    setMetrics({
      averageRating: avgRating,
      totalFeedback: feedbackItems.length,
      byType,
      byPriority,
      byFeature,
      satisfactionTrend: trend
    });
  }, [feedbackItems]);

  // Feedback collection form
  const renderCollectionForm = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Submit Your Feedback</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
          <input
            type="text"
            value={newFeedback.stakeholder}
            onChange={(e) => setNewFeedback({ ...newFeedback, stakeholder: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Role</label>
          <select
            value={newFeedback.role}
            onChange={(e) => setNewFeedback({ ...newFeedback, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select role</option>
            {stakeholderRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feature Area</label>
          <select
            value={newFeedback.feature}
            onChange={(e) => setNewFeedback({ ...newFeedback, feature: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select feature</option>
            {featureAreas.map(feature => (
              <option key={feature} value={feature}>{feature}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Type</label>
          <select
            value={newFeedback.type}
            onChange={(e) => setNewFeedback({ ...newFeedback, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="positive">Positive Feedback</option>
            <option value="negative">Issue/Problem</option>
            <option value="suggestion">Suggestion</option>
            <option value="bug">Bug Report</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4, 5].map(rating => (
            <button
              key={rating}
              onClick={() => setNewFeedback({ ...newFeedback, rating: rating as any })}
              className={`w-12 h-12 rounded-full border-2 transition-colors ${
                newFeedback.rating >= rating
                  ? 'bg-yellow-400 border-yellow-500'
                  : 'bg-gray-100 border-gray-300'
              }`}
            >
              {rating}
            </button>
          ))}
          <span className="text-sm text-gray-600 ml-2">
            {newFeedback.rating === 1 && 'Very Poor'}
            {newFeedback.rating === 2 && 'Poor'}
            {newFeedback.rating === 3 && 'Average'}
            {newFeedback.rating === 4 && 'Good'}
            {newFeedback.rating === 5 && 'Excellent'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select
          value={newFeedback.priority}
          onChange={(e) => setNewFeedback({ ...newFeedback, priority: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Feedback</label>
        <textarea
          value={newFeedback.description}
          onChange={(e) => setNewFeedback({ ...newFeedback, description: e.target.value })}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Please provide detailed feedback about your experience..."
        />
      </div>

      <button
        onClick={submitFeedback}
        disabled={!newFeedback.stakeholder || !newFeedback.feature || !newFeedback.description}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        <Send className="w-4 h-4 mr-2" />
        Submit Feedback
      </button>
    </div>
  );

  // Feedback review panel
  const renderReviewPanel = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Feedback Review</h2>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {feedbackItems.map(item => (
            <div key={item.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.feature}</h3>
                  <p className="text-sm text-gray-600">
                    {item.stakeholder} ({item.role}) - {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.type === 'positive' ? 'bg-green-100 text-green-800' :
                    item.type === 'negative' ? 'bg-red-100 text-red-800' :
                    item.type === 'bug' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {item.type}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.priority === 'critical' ? 'bg-red-100 text-red-800' :
                    item.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.priority}
                  </span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < item.rating ? 'text-yellow-400' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-700 mb-3">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className={`text-sm px-2 py-1 rounded ${
                  item.status === 'new' ? 'bg-gray-100 text-gray-700' :
                  item.status === 'in-review' ? 'bg-blue-100 text-blue-700' :
                  item.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  item.status === 'implemented' ? 'bg-purple-100 text-purple-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {item.status.replace('-', ' ').toUpperCase()}
                </span>
                <button className="text-sm text-blue-600 hover:text-blue-800">
                  Respond
                </button>
              </div>
              {item.response && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{item.response.responder}:</span> {item.response.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.response.respondedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Metrics dashboard
  const renderMetrics = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Average Rating</h3>
          <div className="text-2xl font-bold text-yellow-500">
            {metrics?.averageRating.toFixed(1) || '0.0'} / 5.0
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Feedback</h3>
          <div className="text-2xl font-bold text-blue-600">
            {metrics?.totalFeedback || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Positive Feedback</h3>
          <div className="text-2xl font-bold text-green-600">
            {metrics?.byType.positive || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Issues Reported</h3>
          <div className="text-2xl font-bold text-red-600">
            {(metrics?.byType.negative || 0) + (metrics?.byType.bug || 0)}
          </div>
        </div>
      </div>

      {/* Feedback by Feature */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Feedback by Feature Area</h3>
        <div className="space-y-2">
          {metrics && Object.entries(metrics.byFeature).map(([feature, count]) => (
            <div key={feature} className="flex items-center justify-between">
              <span className="text-gray-700">{feature}</span>
              <div className="flex items-center">
                <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(count / metrics.totalFeedback) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center">
          <Download className="w-4 h-4 mr-2" />
          Export Feedback Report
        </button>
      </div>
    </div>
  );

  return (
    <div className="stakeholder-feedback-portal p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
          <MessageSquare className="mr-3 text-blue-600" />
          Stakeholder Feedback Portal
        </h1>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6">
          <button
            onClick={() => setActiveTab('collect')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'collect'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Collect Feedback
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'review'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Review ({feedbackItems.filter(f => f.status === 'new').length})
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'metrics'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Metrics & Reports
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'collect' && renderCollectionForm()}
          {activeTab === 'review' && renderReviewPanel()}
          {activeTab === 'metrics' && renderMetrics()}
        </div>
      </div>
    </div>
  );
};