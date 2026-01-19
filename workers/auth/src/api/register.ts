import { json, json400 } from "../utils/response";
import { hashPassword } from "../utils/text";
import { registerEmailVer } from "../utils/verification";

export async function handle(req: Request, env: Env): Promise<Response> {
    // 基本驗證
    const contentType: string | null = req.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json"))
        return json400("只接受 JSON 格式的請求", req);

    let reqBody: any;
    try {
        reqBody = await req.json();
    } catch (err) {
        return json400("無效的 JSON 格式", req);
    }

    const { username, password, email }: RegisterRequestBody = reqBody;

    if (!username || !password || !email) return json400("缺少必要資訊", req);

    if (username.length < 3 || username.length > 20)
        return json400("使用者名稱長度需介於 3 到 20 個字元之間", req);

    const usernameRegex: RegExp = /^\w+$/;
    const lowerUsername: string = username.toLowerCase();
    if (!usernameRegex.test(lowerUsername))
        return json400("使用者名稱只能包含字母、數字和底線", req);

    const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lowerEmail: string = email.toLowerCase();
    if (!emailRegex.test(lowerEmail)) return json400("無效的電子郵件格式", req);

    if (password.length < 8 || password.length > 64)
        return json400("密碼長度必須介於 8 到 64 個字元之間", req);

    const passwordRegex: RegExp =
        /^[A-Za-z0-9~`!@#$%^&*()+=_\-{}[\]\\|:;"'?/<>,.]+$/;
    if (!passwordRegex.test(password))
        return json400("密碼只能包含英文字母、數字和特殊字元", req);

    // 檢查使用者名稱或電子郵件是否已存在
    const existingUser: { id: string } | null = await env.USER_DB.prepare(
        "SELECT id FROM users WHERE username = ? OR email = ?"
    )
        .bind(lowerUsername, email)
        .first<{ id: string }>();

    if (existingUser)
        return json(
            { success: false, message: "使用者名稱或電子郵件已被註冊" },
            409,
            req
        );

    const saltArray: Uint8Array = crypto.getRandomValues(new Uint8Array(16));
    const salt: string = btoa(String.fromCharCode(...saltArray));
    const hashedPassword: string = await hashPassword(password, salt);

    // 發送驗證碼郵件
    const res = await registerEmailVer(lowerEmail, lowerUsername, hashedPassword, salt, env, req);

    return res;
}
