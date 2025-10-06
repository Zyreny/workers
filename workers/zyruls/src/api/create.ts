import json from "../utils/response";
import kvOrThrow from "../utils/kvOperation";

interface RequestBody {
    url: string;
    custom?: string;
    password?: string;
    exp?: string;
    meta?: {
        title?: string;
        description?: string;
        image?: string;
    };
}


// 建立短網址
export async function handle(
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const { url, custom, password, exp, meta }: RequestBody = await req.json();

    // 基本驗證
    const contentType = req.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json")) {
        return json(
            { success: false, message: "Content-Type 必須是 application/json" },
            400,
            headers
        );
    }

    // 驗證網址
    if (!url || !isValidUrl(url)) {
        return json(
            { success: false, message: "請輸入有效的原始網址" },
            400,
            headers
        );
    }

    // 處理短網址代碼
    let shortCode = "";
    if (custom) {
        if (
            !/^[a-zA-Z0-9-_]+$/.test(custom) ||
            custom.length < 3 ||
            custom.length > 20
        ) {
            return json(
                {
                    success: false,
                    message:
                        "自訂代碼必須是 3-20 個字符，且只能包含英文字母、數字、連字符和底線",
                },
                400,
                headers
            );
        }

        const existing = await kvOrThrow(() => env.URL_KV.get(custom), headers);

        if (existing) {
            return json(
                { success: false, message: `自訂代碼 "${custom}" 已被使用` },
                409,
                headers
            );
        }

        shortCode = custom;
    } else {
        shortCode = await genShortCode(env, headers);
    }

    // 處理過期時間
    let expDate = null;
    if (exp) {
        expDate = new Date(exp);
        if (isNaN(expDate.getTime()) || expDate <= getTwTime()) {
            return json(
                { success: false, message: "請輸入有效的過期時間" },
                400,
                headers
            );
        }
    }

    // 處理密碼
    let hashedPassword = null;
    if (password) {
        if (password.length > 100) {
            return json(
                { success: false, message: "密碼長度不能超過 100 個字符" },
                400,
                headers
            );
        }
        hashedPassword = await hash(password);
    }

    // 驗證社群預覽
    if (meta) {
        if (meta.image && !isValidUrl(meta.image)) {
            return json(
                { success: false, message: "請輸入有效的縮圖網址" },
                400,
                headers
            );
        }

        if (meta.title && meta.title.length > 100) {
            return json(
                { success: false, message: "標題長度不能超過 100 個字符" },
                400,
                headers
            );
        }

        if (meta.description && meta.description.length > 300) {
            return json(
                { success: false, message: "描述長度不能超過 300 個字符" },
                400,
                headers
            );
        }
    }

    // 儲存資料
    const urlData = {
        url: url,
        createdAt: formatTwTime(),
        password: hashedPassword || null,
        exp: expDate ? formatTwTime(expDate) : null,
        meta: meta
            ? {
                  title: meta.title || null,
                  description: meta.description || null,
                  image: meta.image || null,
              }
            : null,
        creator: req.headers.get("CF-Connecting-IP") || "unknown",
        userAgent: req.headers.get("User-Agent") || "unknown",
    };

    const indexKey = `index:${urlData.creator}`;

    const existingIndex = await kvOrThrow(
        () => env.URL_KV.get(indexKey),
        headers
    );
    const urlIndex = existingIndex ? JSON.parse(existingIndex) : [];

    if (urlIndex.length >= 75) {
        return json(
            { success: false, message: "每個使用者最多只能建立 75 個短網址" },
            403,
            headers
        );
    }

    await kvOrThrow(
        () => env.URL_KV.put(shortCode, JSON.stringify(urlData)),
        headers
    );

    urlIndex.push({
        code: shortCode,
        url: url,
        createdAt: urlData.createdAt,
        hasPassword: !!password,
        exp: urlData.exp,
        meta: urlData.meta,
    });

    await kvOrThrow(
        () => env.URL_KV.put(indexKey, JSON.stringify(urlIndex)),
        headers
    );

    return json(
        {
            success: true,
            message: "短網址建立成功",
            data: {
                shortUrl: `https://zye.me/${shortCode}`,
                code: shortCode,
                originalUrl: url,
                createdAt: urlData.createdAt,
                hasPassword: !!password,
                exp: urlData.exp,
                meta: urlData.meta,
            },
        },
        201,
        headers
    );
}

// 輔助函式

// URL 驗證
function isValidUrl(str: string) {
    try {
        const url = new URL(str);
        return ["http:", "https:"].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

// 產生代碼
async function genShortCode(
    env: Env,
    headers: Record<string, string>
): Promise<string> {
    const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await kvOrThrow(() => env.URL_KV.get(code), headers);

    if (existing) {
        return genShortCode(env, headers);
    }

    return code;
}

// 取得台灣時間
function getTwTime(date = new Date()) {
    const twTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return twTime;
}

// 格式化台灣時間為 ISO 字串
function formatTwTime(date = new Date()) {
    const twTime = getTwTime(date);
    const isoString = twTime.toISOString();
    return isoString.replace("Z", "+08:00");
}

// 文字雜湊
async function hash(text: string): Promise<string> {
    const enc = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}