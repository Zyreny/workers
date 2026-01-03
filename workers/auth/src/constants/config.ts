// AT, RT 過期時間
export const ACCESS_TOKEN_EXP: number = 900; // 15 mins
export const REFRESH_TOKEN_EXP: number = 60 * 60 * 24 * 7; // 7 days

// 允許的來源
export const ALLOWED_ORIGINS: string[] = [];

// 密碼雜湊參數
export const HASH_ALGORITHM: string = "PBKDF2";
export const HASH_FUNCTION: string = "SHA-256";
export const HASH_ITERATIONS: number = 400000;

// 開發模式
export const DEV_MODE: boolean = true;