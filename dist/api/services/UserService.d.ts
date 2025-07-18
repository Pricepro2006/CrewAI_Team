export interface User {
    id: string;
    email: string;
    username: string;
    passwordHash?: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastLoginAt?: string;
}
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin",
    MODERATOR = "moderator"
}
export interface CreateUserInput {
    email: string;
    username: string;
    password: string;
    role?: UserRole;
}
export interface LoginInput {
    emailOrUsername: string;
    password: string;
}
export interface JWTPayload {
    userId: string;
    email: string;
    username: string;
    role: UserRole;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export declare class UserService {
    private db;
    private readonly saltRounds;
    private readonly jwtSecret;
    private readonly jwtExpiresIn;
    private readonly refreshTokenExpiresIn;
    constructor();
    private initializeDatabase;
    create(input: CreateUserInput): Promise<User>;
    login(input: LoginInput): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    verifyToken(token: string): Promise<JWTPayload>;
    refreshTokens(refreshToken: string): Promise<AuthTokens>;
    logout(userId: string, refreshToken?: string): Promise<void>;
    getById(id: string): Promise<User | null>;
    getByEmail(email: string): Promise<User | null>;
    updateRole(userId: string, role: UserRole): Promise<void>;
    deactivate(userId: string): Promise<void>;
    reactivate(userId: string): Promise<void>;
    list(limit?: number, offset?: number): Promise<User[]>;
    getUserStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        usersByRole: Record<string, number>;
        recentSignups: number;
    }>;
    private generateTokens;
    private storeRefreshToken;
    cleanupExpiredTokens(): Promise<void>;
}
//# sourceMappingURL=UserService.d.ts.map