interface Env {
    URL_KV: KVNamespace;
}

import docs from "./docs.json";

export default {
    async fetch(request: Request, env: Env) {
        // CORS 標頭
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // 處理 Preflight 請求
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // 處理 API 請求
            const apiPath = path.replace("/zyruls", "").replace(/\/$/, "") || "/";

            if (apiPath === "/create" && method === "POST") {
                return await handleCreate(request, env, corsHeaders);
            }

            if (apiPath === "/list" && method === "GET") {
                return await handleList(request, env, corsHeaders);
            }

            if (apiPath.startsWith("/del/") && method === "DELETE") {
                const code = apiPath.split("/")[2];
                return await handleDelete(code, request, env, corsHeaders);
            }

            if (apiPath === "/" && method === "GET") {
                return jsonRes(docs, 200, corsHeaders, 4);
            }

            return jsonRes(
                {
                    success: false,
                    message: `找不到 "${apiPath}" 的端點， GET / 可以查看這個 API 的文檔`,
                },
                404,
                corsHeaders
            );
        } catch (e) {
            if (e instanceof Response) return e;
            return jsonRes(
                { success: false, message: "伺服器錯誤，請稍後再試" },
                500,
                corsHeaders
            );
        }
    },
};

// 建立短網址
async function handleCreate(
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
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

    const { url, custom, password, exp, meta }: RequestBody = await req.json();

    // 基本驗證
    const contentType = req.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json")) {
        return jsonRes(
            { success: false, message: "Content-Type 必須是 application/json" },
            400,
            headers
        );
    }

    // 驗證網址
    if (!url || !isValidUrl(url)) {
        return jsonRes(
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
            return jsonRes(
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
            return jsonRes(
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
            return jsonRes(
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
            return jsonRes(
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
            return jsonRes(
                { success: false, message: "請輸入有效的縮圖網址" },
                400,
                headers
            );
        }

        if (meta.title && meta.title.length > 100) {
            return jsonRes(
                { success: false, message: "標題長度不能超過 100 個字符" },
                400,
                headers
            );
        }

        if (meta.description && meta.description.length > 300) {
            return jsonRes(
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
        return jsonRes(
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

    return jsonRes(
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

// 列出使用者的短網址
async function handleList(
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const clientIP = req.headers.get("CF-Connecting-IP") || "unknown";
    const indexKey = `index:${clientIP}`;

    const existingIndex = await kvOrThrow(
        () => env.URL_KV.get(indexKey),
        headers
    );
    const urlIndex = existingIndex ? JSON.parse(existingIndex) : [];

    return jsonRes(
        { success: true, urls: urlIndex.reverse(), total: urlIndex.length },
        200,
        headers,
        4
    );
}

// 刪除短網址
async function handleDelete(
    code: string,
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const existingCode = await kvOrThrow(() => env.URL_KV.get(code), headers);

    if (!existingCode) {
        return jsonRes(
            { success: false, message: "找不到該短網址" },
            404,
            headers
        );
    }

    const clientIP = req.headers.get("CF-Connecting-IP") || "unknown";
    const urlData = JSON.parse(existingCode);

    if (urlData.creator !== clientIP) {
        return jsonRes(
            { success: false, message: "你沒有權限刪除這個短網址" },
            403,
            headers
        );
    }

    {
        await kvOrThrow(() => env.URL_KV.delete(code), headers);
    }

    const indexKey = `index:${urlData.creator}`;

    const existingIndex = await kvOrThrow(
        () => env.URL_KV.get(indexKey),
        headers
    );
    if (existingIndex) {
        const urlIndex = JSON.parse(existingIndex);
        const updatedIndex = urlIndex.filter(
            (item: { code: string }) => item.code !== code
        );

        await kvOrThrow(
            () => env.URL_KV.put(indexKey, JSON.stringify(updatedIndex)),
            headers
        );
    }

    return jsonRes({ success: true, message: "短網址刪除成功" }, 200, headers);
}

// 輔助函式

// JSON 回應
function jsonRes(
    body: Object,
    status: number,
    headers: Record<string, string>,
    space: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, space), {
        status: status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}

// URL 驗證
function isValidUrl(str: string) {
    try {
        const url = new URL(str);
        return ["http:", "https:"].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

// KV 操作
async function kvOperation(
    op: () => Promise<any>,
    headers: Record<string, string>
) {
    try {
        const results = await op();
        return { success: true, data: results };
    } catch (e) {
        const errMsg = (
            e instanceof Error ? e.message : String(e) || ""
        ).toLowerCase();
        const kvLimitHit =
            errMsg.includes("kv") &&
            (errMsg.includes("limit exceeded") ||
                errMsg.includes("quota exceeded") ||
                errMsg.includes("rate limit") ||
                errMsg.includes("too many requests"));

        const response = kvLimitHit
            ? jsonRes(
                  {
                      success: false,
                      message:
                          "請稍後再試一次，如果嘗試多次之後還是失敗請等台灣時間早上8點後再試",
                  },
                  503,
                  headers
              )
            : jsonRes(
                  {
                      success: false,
                      message:
                          "伺服器錯誤，請稍後再試，如果嘗試多次之後還是失敗請等台灣時間早上8點後再試",
                  },
                  500,
                  headers
              );

        return { success: false, response };
    }
}

// KV 操作代理函式
async function kvOrThrow(
    op: () => Promise<any>,
    headers: Record<string, string>
): Promise<any> {
    const res = await kvOperation(op, headers);
    if (!res.success) throw res.response;
    return res.data;
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
