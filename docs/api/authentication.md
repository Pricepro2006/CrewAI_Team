# Authentication API

## Overview

The Authentication API provides endpoints for user registration, login, token management, and password operations. All authentication uses JWT tokens with configurable expiration times.

## Endpoints

### Register New User

Create a new user account.

```http
POST /api/auth/register
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "company": "Acme Corp" // optional
}
```

#### Response

```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-20T12:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Validation Rules

- Email: Valid email format, unique
- Password: Minimum 8 characters, at least one uppercase, one lowercase, one number
- Name: 2-100 characters

### Login

Authenticate user and receive JWT token.

```http
POST /api/auth/login
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Response

```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "permissions": ["read", "write"],
    "lastLogin": "2025-01-20T12:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400 // seconds
}
```

#### Error Responses

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### Refresh Token

Exchange a valid token for a new one before expiration.

```http
POST /api/auth/refresh
Authorization: Bearer <current-token>
```

#### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400
}
```

### Logout

Invalidate the current token.

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### Response

```json
{
  "message": "Successfully logged out"
}
```

### Get Current User

Retrieve authenticated user's profile.

```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Response

```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "permissions": ["read", "write"],
    "company": "Acme Corp",
    "createdAt": "2025-01-20T12:00:00Z",
    "updatedAt": "2025-01-20T12:00:00Z"
  }
}
```

### Update Profile

Update authenticated user's profile information.

```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Jane Doe",
  "company": "New Corp",
  "timezone": "America/New_York"
}
```

#### Response

```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "Jane Doe",
    "company": "New Corp",
    "timezone": "America/New_York",
    "updatedAt": "2025-01-20T12:30:00Z"
  }
}
```

### Change Password

Change the authenticated user's password.

```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

#### Response

```json
{
  "message": "Password successfully changed"
}
```

### Request Password Reset

Initiate password reset process.

```http
POST /api/auth/forgot-password
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "user@example.com"
}
```

#### Response

```json
{
  "message": "Password reset instructions sent to email"
}
```

### Reset Password

Complete password reset with token from email.

```http
POST /api/auth/reset-password
Content-Type: application/json
```

#### Request Body

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword789!"
}
```

#### Response

```json
{
  "message": "Password successfully reset"
}
```

### Verify Email

Verify email address with token from email.

```http
POST /api/auth/verify-email
Content-Type: application/json
```

#### Request Body

```json
{
  "token": "verification-token-from-email"
}
```

#### Response

```json
{
  "message": "Email successfully verified"
}
```

## JWT Token Structure

Tokens contain the following claims:

```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "role": "user",
  "permissions": ["read", "write"],
  "iat": 1737385200,
  "exp": 1737471600,
  "iss": "crewai-team",
  "aud": "crewai-api",
  "jti": "unique-token-id"
}
```

## Security Headers

All authentication endpoints include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Rate Limiting

Authentication endpoints have specific rate limits:

- Registration: 5 requests per hour per IP
- Login: 5 failed attempts per 15 minutes per IP/email
- Password reset: 3 requests per hour per email

## Two-Factor Authentication (Optional)

### Enable 2FA

```http
POST /api/auth/2fa/enable
Authorization: Bearer <token>
```

#### Response

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgo...",
  "backupCodes": [
    "12345678",
    "87654321",
    "11223344"
  ]
}
```

### Verify 2FA

```http
POST /api/auth/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "code": "123456"
}
```

### Login with 2FA

```http
POST /api/auth/login
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "totpCode": "123456"
}
```

## Session Management

### List Active Sessions

```http
GET /api/auth/sessions
Authorization: Bearer <token>
```

#### Response

```json
{
  "sessions": [
    {
      "id": "session-123",
      "device": "Chrome on Windows",
      "ip": "192.168.1.1",
      "location": "New York, US",
      "lastActive": "2025-01-20T12:00:00Z",
      "current": true
    }
  ]
}
```

### Revoke Session

```http
DELETE /api/auth/sessions/:sessionId
Authorization: Bearer <token>
```

## Code Examples

### JavaScript/TypeScript

```typescript
// Login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!'
  })
});

const { token, user } = await response.json();

// Store token
localStorage.setItem('authToken', token);

// Use token in subsequent requests
const emails = await fetch('http://localhost:3000/api/emails', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Python

```python
import requests

# Login
response = requests.post('http://localhost:3000/api/auth/login', json={
    'email': 'user@example.com',
    'password': 'SecurePassword123!'
})

data = response.json()
token = data['token']

# Use token
headers = {'Authorization': f'Bearer {token}'}
emails = requests.get('http://localhost:3000/api/emails', headers=headers)
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'

# Use token
curl -X GET http://localhost:3000/api/emails \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Best Practices

1. **Store tokens securely**: Use httpOnly cookies or secure storage
2. **Implement token refresh**: Refresh tokens before expiration
3. **Handle 401 errors**: Redirect to login on unauthorized
4. **Use HTTPS**: Always use encrypted connections
5. **Validate on server**: Never trust client-side validation alone
6. **Rate limit**: Implement client-side throttling
7. **Clear tokens on logout**: Remove from all storage locations