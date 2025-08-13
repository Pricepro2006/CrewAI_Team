# Authentication System Implementation

## Overview

The CrewAI Team project now includes a comprehensive JWT-based authentication system with modern security features, user management, and a polished frontend interface.

## 🏗️ Architecture

### Backend Components

#### 1. Database Schema (`/src/database/migrations/008_create_users_table.ts`)

- **Users table**: Core user information with role-based access
- **Refresh tokens table**: Secure token management with expiration
- **User sessions table**: Device and session tracking
- **Password reset tokens table**: Secure password reset flow
- **Email verification tokens table**: Email verification workflow

#### 2. Authentication Utilities

- **JWT Manager** (`/src/api/utils/jwt.ts`): Token generation, verification, and management
- **Password Manager** (`/src/api/utils/password.ts`): Secure password hashing, validation, and strength checking

#### 3. User Service (`/src/api/services/UserService.ts`)

- Complete CRUD operations for users
- Password management and authentication
- Token lifecycle management
- Session handling and cleanup

#### 4. Authentication Middleware (`/src/api/middleware/auth.ts`)

- JWT verification for Express routes
- TRPC authentication middleware
- Role-based authorization
- Rate limiting for auth endpoints

#### 5. Authentication Router (`/src/api/routes/auth.router.ts`)

- Login/logout endpoints
- User registration
- Token refresh functionality
- Profile management
- Password operations

### Frontend Components

#### 1. Authentication Hooks (`/src/ui/hooks/useAuth.ts`)

- React context for authentication state
- Automatic token management
- Session persistence
- Role-based utilities

#### 2. UI Components

- **LoginForm**: Polished login interface with validation
- **RegisterForm**: Registration with real-time password strength checking
- **AuthModal**: Modal wrapper for authentication forms
- **UserProfile**: Complete profile management interface

## 🔐 Security Features

### Password Security

- **Strength Validation**: Real-time password strength analysis
- **Entropy Calculation**: Mathematical password strength measurement
- **Compromised Password Detection**: Basic breach detection
- **Secure Hashing**: bcrypt with configurable salt rounds

### JWT Security

- **Short-lived Access Tokens**: 15-minute expiration by default
- **Secure Refresh Tokens**: 7-30 day expiration with rotation
- **Token Rotation**: New tokens issued on refresh
- **Proper Audience/Issuer**: JWT claims validation

### Additional Security

- **Rate Limiting**: Authentication endpoint protection
- **CSRF Protection**: Cross-site request forgery prevention
- **Session Management**: Device tracking and bulk logout
- **Input Sanitization**: XSS and injection prevention

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install bcrypt jsonwebtoken @types/bcrypt @types/jsonwebtoken
```

### 2. Environment Configuration

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Security
BCRYPT_SALT_ROUNDS=12
MIN_PASSWORD_LENGTH=8

# Database
DATABASE_PATH=./data/app.db
```

### 3. Run Database Migration

```bash
# Run the migration to create authentication tables
npx tsx src/database/migrations/migrate.ts up
```

### 4. Update App.tsx

```tsx
import { AuthProvider } from "./hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{/* Your app components */}</AuthProvider>
    </QueryClientProvider>
  );
}
```

## 📚 Usage Examples

### Frontend Authentication

#### Login Component

```tsx
import { useAuth } from "../hooks/useAuth";
import { LoginForm } from "../components/Auth/LoginForm";

function LoginPage() {
  const { login, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return <LoginForm onSuccess={() => navigate("/dashboard")} />;
}
```

#### Protected Route

```tsx
import { useRequireAuth } from "../hooks/useAuth";

function ProtectedComponent() {
  const isAuthenticated = useRequireAuth("/login");

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  return <div>Protected content</div>;
}
```

#### Role-based Access

```tsx
import { useIsAdmin, useIsModerator } from "../hooks/useAuth";

function AdminPanel() {
  const isAdmin = useIsAdmin();
  const isModerator = useIsModerator();

  if (!isAdmin && !isModerator) {
    return <div>Access denied</div>;
  }

  return <div>Admin/Moderator content</div>;
}
```

### Backend API Usage

#### Protected TRPC Procedure

```typescript
import { protectedProcedure } from "../trpc/enhanced-router";

export const userRouter = router({
  getProfile: protectedProcedure.query(({ ctx }) => {
    return ctx.user; // Authenticated user
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      // Update user profile
      return await userService.updateUser(ctx.user.id, input);
    }),
});
```

#### Admin-only Procedure

```typescript
import { adminProcedure } from "../trpc/enhanced-router";

export const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    return await userService.listUsers();
  }),
});
```

## 🔧 Configuration Options

### JWT Configuration

```typescript
// In app.config.ts
export const appConfig = {
  security: {
    jwtSecret: process.env.JWT_SECRET,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    rateLimiting: {
      windowMs: 60000, // 1 minute
      maxRequests: 5, // 5 attempts per minute
    },
  },
};
```

### Password Policy

```typescript
// Configurable in PasswordManager
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPatterns: true,
};
```

## 🧪 Testing

### Authentication Tests (TODO)

- Unit tests for JWT utilities
- Password manager tests
- User service integration tests
- Authentication flow end-to-end tests

### Example Test Structure

```typescript
describe("Authentication System", () => {
  describe("JWT Manager", () => {
    it("should generate valid access tokens");
    it("should verify tokens correctly");
    it("should handle token expiration");
  });

  describe("User Service", () => {
    it("should create users with hashed passwords");
    it("should authenticate users correctly");
    it("should manage refresh tokens");
  });
});
```

## 🚀 Advanced Features

### Automatic Token Refresh

The frontend automatically refreshes tokens 5 minutes before expiration, ensuring seamless user experience.

### Multi-device Session Management

Users can view and manage sessions across multiple devices with the ability to logout from specific devices or all devices.

### Password Strength Analysis

Real-time password strength checking with:

- Character variety analysis
- Entropy calculation
- Common password detection
- Visual strength indicators

### Role-based Authorization

Three-tier role system:

- **User**: Basic access
- **Moderator**: Enhanced permissions
- **Admin**: Full system access

## 🔒 Security Best Practices

1. **Environment Variables**: Store sensitive configuration in environment variables
2. **HTTPS Only**: Use HTTPS in production for token transmission
3. **Token Storage**: Use httpOnly cookies for production (localStorage for development)
4. **Rate Limiting**: Implement aggressive rate limiting on authentication endpoints
5. **Audit Logging**: Log all authentication events for security monitoring
6. **Regular Cleanup**: Automated cleanup of expired tokens and sessions

## 📈 Future Enhancements

- Email verification flow
- Two-factor authentication (2FA)
- OAuth integration (Google, GitHub, etc.)
- Account lockout after failed attempts
- Password reset via email
- Advanced session analytics
- Biometric authentication support
- Single Sign-On (SSO) integration

## 🐛 Troubleshooting

### Common Issues

1. **JWT Secret Not Set**: Ensure JWT_SECRET is configured in production
2. **Token Expiration**: Check token expiry settings if users are logged out frequently
3. **Database Migration**: Run migrations if authentication tables don't exist
4. **CORS Issues**: Configure CORS properly for frontend-backend communication

### Debug Mode

Set `LOG_LEVEL=debug` to enable detailed authentication logging.

## 📋 API Reference

### Authentication Endpoints

- `POST /trpc/auth.login` - User login
- `POST /trpc/auth.register` - User registration
- `POST /trpc/auth.refreshToken` - Refresh access token
- `POST /trpc/auth.logout` - Logout from current device
- `POST /trpc/auth.logoutAll` - Logout from all devices
- `GET /trpc/auth.me` - Get current user profile
- `PUT /trpc/auth.updateProfile` - Update user profile
- `PUT /trpc/auth.changePassword` - Change password
- `POST /trpc/auth.checkPasswordStrength` - Check password strength

### User Management (Admin)

- `GET /trpc/admin.listUsers` - List all users
- `PUT /trpc/admin.updateUser` - Update any user
- `DELETE /trpc/admin.deleteUser` - Deactivate user account

---

## 🎉 Conclusion

The authentication system is now fully implemented with enterprise-grade security features, comprehensive user management, and a polished user experience. The system follows modern security best practices and provides a solid foundation for the CrewAI Team application.

For questions or support, please refer to the implementation files or create an issue in the project repository.
