import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import './UserProfile.css';

interface UserProfileProps {
  showSettings?: boolean;
  onSettingsToggle?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  showSettings = false, 
  onSettingsToggle 
}) => {
  const { user, logout, logoutAll, updateProfile, changePassword } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    avatar_url: user?.avatar_url || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!user) return null;

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      await updateProfile(profileData);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrors({ general: error?.message || 'Failed to update profile' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      // User will be logged out automatically after password change
    } catch (error: any) {
      setErrors({ 
        password: error?.message || 'Failed to change password' 
      });
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLogoutAll = async () => {
    if (confirm('This will log you out from all devices. Continue?')) {
      try {
        await logoutAll();
      } catch (error) {
        console.error('Logout all failed:', error);
      }
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0).toUpperCase() || '';
    const last = lastName?.charAt(0).toUpperCase() || '';
    return first + last || user.username.charAt(0).toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#dc2626';
      case 'moderator': return '#d97706';
      case 'user': return '#059669';
      default: return '#6b7280';
    }
  };

  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="profile-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} />
          ) : (
            <div className="avatar-placeholder">
              {getInitials(user.first_name, user.last_name)}
            </div>
          )}
        </div>
        
        <div className="profile-info">
          <h3 className="profile-name">
            {user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}`
              : user.username
            }
          </h3>
          <p className="profile-email">{user.email}</p>
          <span 
            className="profile-role"
            style={{ color: getRoleColor(user.role) }}
          >
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        </div>

        {onSettingsToggle && (
          <button 
            className="settings-toggle"
            onClick={onSettingsToggle}
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {showSettings && (
        <div className="profile-settings">
          <div className="settings-section">
            <div className="section-header">
              <h4>Profile Information</h4>
              {!isEditing && (
                <button 
                  className="edit-button"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="profile-form">
                {errors.general && (
                  <div className="error-message">{errors.general}</div>
                )}
                
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleProfileChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={profileData.last_name}
                    onChange={handleProfileChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Avatar URL</label>
                  <input
                    type="url"
                    name="avatar_url"
                    value={profileData.avatar_url}
                    onChange={handleProfileChange}
                    disabled={isLoading}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => setIsEditing(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="save-button"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-display">
                <div className="info-item">
                  <span className="label">Username:</span>
                  <span className="value">{user.username}</span>
                </div>
                <div className="info-item">
                  <span className="label">Email:</span>
                  <span className="value">{user.email}</span>
                </div>
                <div className="info-item">
                  <span className="label">Member since:</span>
                  <span className="value">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Last login:</span>
                  <span className="value">
                    {user.last_login_at 
                      ? new Date(user.last_login_at).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <div className="section-header">
              <h4>Change Password</h4>
              {!isChangingPassword && (
                <button 
                  className="edit-button"
                  onClick={() => setIsChangingPassword(true)}
                >
                  Change
                </button>
              )}
            </div>

            {isChangingPassword && (
              <form onSubmit={handleChangePassword} className="password-form">
                {errors.password && (
                  <div className="error-message">{errors.password}</div>
                )}
                
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    required
                  />
                  {errors.currentPassword && (
                    <span className="field-error">{errors.currentPassword}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    required
                  />
                  {errors.newPassword && (
                    <span className="field-error">{errors.newPassword}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    required
                  />
                  {errors.confirmPassword && (
                    <span className="field-error">{errors.confirmPassword}</span>
                  )}
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                      setErrors({});
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="save-button"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="settings-section danger-zone">
            <h4>Account Actions</h4>
            <div className="action-buttons">
              <button 
                className="logout-button"
                onClick={handleLogout}
              >
                Sign Out
              </button>
              <button 
                className="logout-all-button"
                onClick={handleLogoutAll}
              >
                Sign Out All Devices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};