import { createJWT } from "../utils/jwt";
import { json, json400 } from "../utils/response";
import { nanoid } from "nanoid";
import { validateContentType } from "../utils/validation";
import { REFRESH_TOKEN_EXP } from "../constants/config";
import { buildRefreshCookie } from "../utils/cookie";

export async function handle(req: Request, env: Env): Promise<Response> {
    if (!validateContentType(req))
        return json400("Content-Type 必須是 application/json", req);

    const { email, code }: { email: string; code: string } = await req.json();

    if (!email || !code) return json400("缺少必要資訊", req);

    // 取得驗證資料
    const dataStr: string | null = await env.VER_KV.get(`email:${email}`);
    if (!dataStr) return json400("驗證碼已過期或不存在", req);

    const data: VerificationData = JSON.parse(dataStr);

    // 驗證碼比對
    if (data.code !== code) return json400("驗證碼錯誤", req);

    // 檢查有沒有過期
    const now: number = Date.now();
    if (now - data.timestamp > 600000) {
        await env.VER_KV.delete(`email:${email}`);
        if (data.username) {
            await env.VER_KV.delete(`username:${data.username.toLowerCase()}`);
        }
        return json400("驗證碼已過期", req);
    }

    // 根據類型處理
    if (data.type === "register")
        return await registerUser(env, req, data, email);

    return json400("無效的驗證類型", req);
}

// 處理註冊
async function registerUser(
    env: Env,
    req: Request,
    data: VerificationData,
    email: string
): Promise<Response> {
    if (!data.username || !data.password_hash || !data.salt) {
        return json400("註冊資料不完整", req);
    }

    // 檢查用戶是否已存在
    const existingUser: { id: string } | null = await env.USER_DB.prepare(
        "SELECT id FROM users WHERE username = ? OR email = ?"
    )
        .bind(data.username, data.email)
        .first<{ id: string }>();

    if (existingUser) {
        await env.VER_KV.delete(`email:${email}`);
        if (data.username) {
            await env.VER_KV.delete(`username:${data.username.toLowerCase()}`);
        }
        return json(
            { success: false, message: "使用者名稱或電子郵件已被註冊" },
            409,
            req
        );
    }

    // 生成用戶 ID
    const userId: string = nanoid(16);

    // 寫入資料庫
    await env.USER_DB.prepare(
        "INSERT INTO users (id, username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
        .bind(
            userId,
            data.username,
            data.email,
            data.password_hash,
            data.salt,
            Math.floor(Date.now() / 1000)
        )
        .run();

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
        { expiration: expiration }
    );

    // 建立 Cookie
    const cookie: string = buildRefreshCookie(refreshId);

    // 刪除驗證資料
    await env.VER_KV.delete(`email:${email}`);
    if (data.username) {
        await env.VER_KV.delete(`username:${data.username.toLowerCase()}`);
    }

    return json(
        {
            success: true,
            message: "註冊成功",
            accessToken,
        },
        200,
        req,
        undefined,
        { "Set-Cookie": cookie }
    );
}
