import { sendEmail } from "./email";

export async function registerEmailVer(
    email: string,
    username: string,
    hashedPassword: string,
    salt: string,
    env: Env
): Promise<string> {
    const lowerUsername = username.toLowerCase();
    const emailKey = `email:${email}`;
    const usernameKey = `username:${lowerUsername}`;

    // 檢查是否已經有待驗證的資料
    const [hasEmail, hasUsername] = await Promise.all([
        env.VER_KV.get(emailKey),
        env.VER_KV.get(usernameKey),
    ]);

    if (hasEmail || hasUsername) {
        throw new Error("Pending verification");
    }

    const code = genVerCode();

    // 儲存驗證碼
    const data: VerificationData = {
        code,
        email,
        type: "register",
        username,
        password_hash: hashedPassword,
        salt,
        timestamp: Date.now(),
    };
    
    // 儲存驗證資料與使用者名稱佔位符
    await Promise.all([
        env.VER_KV.put(emailKey, JSON.stringify(data), {
            expirationTtl: 600,
        }),
        env.VER_KV.put(usernameKey, email, {
            expirationTtl: 600,
        }),
    ]);

    const res = await sendEmail(
        email,
        "verification",
        "[Zyreny] 請查看你的驗證碼完成帳號註冊",
        env,
        { code }
    );
    console.log("Mailjet API response:", JSON.stringify(res, null, 2));
    const success = res.Messages[0]?.Status === "success";
    if (!success) {
        await Promise.all([
            env.VER_KV.delete(emailKey),
            env.VER_KV.delete(usernameKey),
        ]);
        throw new Error("郵件發送失敗");
    }

    return code;
}

// 生成隨機 6 位數驗證碼
function genVerCode(): string {
    const randomNum = crypto.getRandomValues(new Uint32Array(1))[0];
    const code = randomNum % 1000000;
    return code.toString().padStart(6, "0");
}
