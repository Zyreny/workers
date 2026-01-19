import {
    HASH_ALGORITHM,
    HASH_FUNCTION,
    HASH_ITERATIONS,
    REFRESH_TOKEN_EXP,
} from "../constants/config";

import { nanoid } from "nanoid";

import { createJWT } from "../utils/jwt";
import { json, json400 } from "../utils/response";
import { validateContentType } from "../utils/validation";
import { buildRefreshCookie } from "../utils/cookie";

export async function handle(req: Request, env: Env): Promise<Response> {
    if (!validateContentType(req))
        return json400("只接受 JSON 格式的請求", req);

    let reqBody: any;
    try {
        reqBody = await req.json();
    } catch (err) {
        return json400("無效的 JSON 格式", req);
    }

    const email: string = reqBody.email;
    const code: string = reqBody.code;

    // 基本驗證
    if (!email || !code) return json400("缺少必要資訊", req);

    // 取得驗證資料
    const lowerEmail: string = email.toLowerCase();
    const data: VerificationData | null = await env.USER_DB.prepare(
        "SELECT * FROM verifications WHERE email = ?",
    )
        .bind(lowerEmail)
        .first();

    if (!data) return json400("驗證碼已過期或不存在", req);

    // 驗證碼比對
    const encoder: TextEncoder = new TextEncoder();
    const codeBytes: Uint8Array = encoder.encode(code);
    const inputBytes: Uint8Array = encoder.encode(data.code);

    if (
        codeBytes.length !== inputBytes.length ||
        !crypto.subtle.timingSafeEqual(codeBytes, inputBytes)
    )
        return json400("驗證碼錯誤", req);

    // 檢查有沒有過期
    const now: number = Date.now();
    if (now / 1000 > data.expires_at) {
        await env.USER_DB.prepare("DELETE FROM verifications WHERE email = ?")
            .bind(lowerEmail)
            .run();

        return json400("驗證碼已過期", req);
    }

    // 根據類型處理
    if (data.type === "register") return await registerUser(env, req, data);

    return json400("無效的驗證類型", req);
}

// 處理註冊
async function registerUser(
    env: Env,
    req: Request,
    data: VerificationData,
): Promise<Response> {
    if (!data.username || !data.password_hash || !data.salt) {
        return json400("驗證資料不完整，無法註冊", req);
    }

    const lowerEmail: string = data.email.toLowerCase();
    const lowerUsername: string = data.username.toLowerCase();

    // 檢查用戶是否已存在
    const existingUser: { id: string } | null = await env.USER_DB.prepare(
        "SELECT id FROM users WHERE username = ? OR email = ?",
    )
        .bind(lowerUsername, lowerEmail)
        .first<{ id: string }>();

    if (existingUser) {
        await env.USER_DB.prepare("DELETE FROM verifications WHERE email = ?")
            .bind(lowerEmail)
            .run();

        return json(
            { success: false, message: "使用者名稱或電子郵件已被註冊" },
            409,
            req,
        );
    }

    // 生成用戶 ID
    const userId: string = nanoid(16);

    // 寫入資料庫
    const result: D1Result = await env.USER_DB.prepare(
        "INSERT INTO users (id, username, email, password_hash, salt, algorithm, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
        .bind(
            userId,
            data.username,
            data.email,
            data.password_hash,
            data.salt,
            `${HASH_ALGORITHM}-${HASH_FUNCTION}`,
            HASH_ITERATIONS,
            Math.floor(Date.now() / 1000),
        )
        .run();

    if (result.error) {
        return json(
            { success: false, message: "無法建立使用者帳號" },
            500,
            req,
        );
    }

    const payload: JwtPayload = {
        sub: userId,
        username: data.username,
        email: data.email,
    };

    // 產生 JWT 存作登入憑證
    const accessToken: string = await createJWT(payload, env.JWT_PRIVATE_KEY);

    // 生成並儲存 Refresh Token
    const refreshId: string = nanoid(64);
    const expiration: number =
        Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXP;
    const refreshData: RefreshTokenData = {
        sub: userId,
        exp: expiration,
    };

    await env.TOKEN_KV.put(
        `refresh:${refreshId}`,
        JSON.stringify(refreshData),
        { expiration: expiration },
    );

    // 建立 Cookie
    const cookie: string = buildRefreshCookie(refreshId);

    // 刪除驗證資料
    await env.USER_DB.prepare("DELETE FROM verifications WHERE email = ?")
        .bind(lowerEmail)
        .run();

    return json(
        {
            success: true,
            message: "註冊成功",
            accessToken,
        },
        200,
        req,
        undefined,
        { "Set-Cookie": cookie },
    );
}
