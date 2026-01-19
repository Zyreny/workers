interface Env {
    TOKEN_KV: KVNamespace;
    USER_DB: D1Database;
    MJ_API_KEY: string;
    MJ_SECRET_KEY: string;
    JWT_PRIVATE_KEY: string;
    JWT_PUBLIC_KEY: string;
}

interface VerificationData {
    code: string;
    email: string;
    type: "register" | "reset_password";
    username?: string;
    password_hash?: string;
    salt?: string;
    expires_at: number;
}

interface RegisterRequestBody {
    username: string;
    password: string;
    email: string;
}

interface JsonResponseBody {
    success: boolean;
    message?: string;
    [key: string]: any;
}

interface JwtHeader {
    alg: "EdDSA";
    typ: "JWT";
}

interface JwtPayload {
    sub: string;
    iat?: number;
    exp?: number;
    [key: string]: any;
}

interface RefreshTokenData {
    sub: string;
    exp: number;
    [key: string]: any;
}