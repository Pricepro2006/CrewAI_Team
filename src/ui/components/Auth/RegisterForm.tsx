import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import './AuthForms.css';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

interface PasswordStrength {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  entropy: number;
  isCompromised: boolean;
  recommendations: string[];
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ 
  onSuccess, 
  onSwitchToLogin 
}) => {
  const { register, checkPasswordStrength } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);

  // Check password strength when password changes
  useEffect(() => {
    if (formData.password && formData.password.length > 0) {
      const checkStrength = async () => {
        try {
          const strength = await checkPasswordStrength(formData.password);
          setPasswordStrength(strength);
        } catch (error) {
          console.warn('Failed to check password strength:', error);
        }
      };
      
      const timer = setTimeout(checkStrength, 300); // Debounce
      return () => clearTimeout(timer);
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password, checkPasswordStrength]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\\S+@\\S+\\.\\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordStrength && !passwordStrength.isValid) {
      newErrors.password = 'Password does not meet security requirements';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      onSuccess?.();
    } catch (error: any) {
      setErrors({
        general: error?.message || 'Registration failed. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'weak': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="auth-form-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form-header">
          <h2>Create Account</h2>
          <p>Sign up to get started with CrewAI Team.</p>
        </div>

        {errors.general && (
          <div className="auth-error-banner">
            {errors.general}
          </div>
        )}

        <div className="auth-form-body">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name" className="form-label">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your first name"
                disabled={isLoading}
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name" className="form-label">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your last name"
                disabled={isLoading}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="Enter your email"
              disabled={isLoading}
              autoComplete="email"
              required
            />
            {errors.email && (
              <span className="form-error">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username *
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`form-input ${errors.username ? 'error' : ''}`}
              placeholder="Choose a username"
              disabled={isLoading}
              autoComplete="username"
              required
            />
            {errors.username && (
              <span className="form-error">{errors.username}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setShowPasswordStrength(true)}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Create a strong password"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            {errors.password && (
              <span className="form-error">{errors.password}</span>
            )}
            
            {showPasswordStrength && passwordStrength && formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: `${passwordStrength.strength === 'strong' ? 100 : passwordStrength.strength === 'medium' ? 66 : 33}%`,
                      backgroundColor: getStrengthColor(passwordStrength.strength)
                    }}
                  />
                </div>
                <div className="strength-info">
                  <span 
                    className="strength-label"
                    style={{ color: getStrengthColor(passwordStrength.strength) }}
                  >
                    {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)} Password
                  </span>
                  {passwordStrength.isCompromised && (
                    <span className="compromised-warning">
                      ⚠️ This password has been found in data breaches
                    </span>
                  )}
                </div>
                {!passwordStrength.isValid && (
                  <ul className="strength-requirements">
                    {passwordStrength.errors.map((error, index) => (
                      <li key={index} className="requirement-error">
                        {error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Confirm your password"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <span className="form-error">{errors.confirmPassword}</span>
            )}
          </div>
        </div>

        <div className="auth-form-footer">
          <button
            type="submit"
            className={`auth-button primary ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || (passwordStrength && !passwordStrength.isValid)}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          {onSwitchToLogin && (
            <div className="auth-switch">
              <span>Already have an account? </span>
              <button
                type="button"
                className="auth-link"
                onClick={onSwitchToLogin}
                disabled={isLoading}
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};