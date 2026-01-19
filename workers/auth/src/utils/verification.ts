import { VER_CODE_EXP } from "../constants/config";

import { sendEmail } from "./email";
import { json } from "./response";
import { genVerCode } from "./text";

export async function registerEmailVer(
    email: string,
    username: string,
    hashedPassword: string,
    salt: string,
    env: Env,
    req: Request
): Promise<Response> {
    const existing = await env.USER_DB.prepare(
        "SELECT * FROM verifications WHERE email = ? OR username = ?"
    )
        .bind(email, username)
        .first();

    if (existing)
        return json(
            { success: false, message: "已經有未完成的驗證請求，請稍後再試" },
            409,
            req
        );

    const code: string = genVerCode();

    const res: Record<string, any> = await sendEmail(
        email,
        "verification",
        "[Zyreny] 請查看你的驗證碼完成帳號註冊",
        env,
        { code }
    );

    const success: boolean = res?.Messages[0]?.Status === "success";
    if (!success) throw new Error("郵件發送失敗");

    // 儲存驗證碼資料
    const result: D1Result = await env.USER_DB.prepare(
        "INSERT INTO verifications (code, email, username, password_hash, salt, type, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
        .bind(
            code,
            email,
            username,
            hashedPassword,
            salt,
            "register",
            Math.floor(Date.now() / 1000) + VER_CODE_EXP
        )
        .run();

    if (result.error)
        return json({ success: false, message: "無法儲存驗證資料" }, 500, req);

    return json(
        { success: true, message: "驗證碼已經發送到你的電子郵件" },
        200,
        req
    );
}
