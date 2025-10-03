interface Env {
    URL_KV: KVNamespace;
}

export default {
    async fetch(request, env: Env) {
        const url = new URL(request.url);
        const path = url.pathname;

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

        try {
            // 處理 API 請求
            const apiPath = path.replace("/zyruls", "") || "/";

            if (apiPath === "/create" && request.method === "POST") {
                return await handleCreate(request, env, corsHeaders);
            }

            if (apiPath === "/list" && request.method === "GET") {
                return await handleList(request, env, corsHeaders);
            }

            if (apiPath.startsWith("/del/") && request.method === "DELETE") {
                const code = apiPath.split("/")[2];
                return await handleDelete(code, request, env, corsHeaders);
            }

            if (apiPath === "/" && request.method === "GET") {
                return handleApiDocs(corsHeaders);
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
} satisfies ExportedHandler<Env>;

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

// API 文檔
function handleApiDocs(headers: Record<string, string>): Response {
    const docs = {
        name: "Zyruls 縮網址 API",
        version: "v1.0.0",
        description:
            "這個 API 可以讓你建立短網址或是列出、刪除你建立的短網址，建立的短網址會在 zye.me/XXX 上。此 API 使用 Cloudflare Worker 無伺服器後端服務部署在 api.zyreny.com/zyruls 、短網址服務的鍵值儲存庫使用 Cloudflare KV",
        baseUrl: "https://api.zyreny.com/zyruls",
        endpoints: {
            "GET /": {
                description: "這個 API 的文檔",
            },
            "POST /create": {
                description: "建立新的短網址",
                body: {
                    url: "string (必填) - 要縮短的原始網址",
                    custom: "string - 自訂代碼，若有指定自訂代碼則短網址格式為 zye.me/{custom} (限定 3-20 字符、大小寫英文、下底線和連字號)",
                    password: "string - 密碼保護",
                    exp: "string - 過期時間 (ISO 8601 格式)",
                    meta: {
                        title: "string - 自訂標題 (最多 100 字符)",
                        description: "string - 自訂描述 (最多 300 字符)",
                        image: "string - 縮圖網址",
                    },
                },
                exampleRequest: {
                    url: "https://example.zyreny.com/very/long/url",
                    custom: "custom_link",
                    password: "secret123",
                    exp: "2025-12-31T23:59:59Z",
                    meta: {
                        title: "Zyruls 縮網址",
                        description:
                            "Zyruls 是一個用來縮短網址的工具，把原本非常多字的連結縮短成大約 10 個字符，甚至更少！",
                        image: "https://example.zyreny.com/image.png",
                    },
                },
                response: {
                    success: "boolean - 是否成功",
                    message: "string - 回應訊息",
                    data: {
                        shortUrl: "string - 生成出來的短網址",
                        code: "string - 短網址代碼",
                        originalUrl: "string - 原始網址",
                        createdAt: "string - 建立時間 (ISO 8601 格式)",
                        hasPassword: "boolean - 是否有設定密碼",
                        exp: "string | null - 過期時間 (ISO 8601 格式)",
                        meta: {
                            title: "string | null - 自訂標題",
                            description: "string | null - 自訂描述",
                            image: "string | null - 縮圖網址",
                        },
                    },
                },
                exampleResponse: {
                    success: true,
                    message: "短網址建立成功",
                    data: {
                        shortUrl: "https://zye.me/custom_link",
                        code: "custom_link",
                        originalUrl: "https://example.zyreny.com/your/long/url",
                        createdAt: "2025-09-28T12:34:56Z",
                        hasPassword: true,
                        exp: "2025-12-31T23:59:59Z",
                        meta: {
                            title: "Zyruls 縮網址",
                            description:
                                "Zyruls 是一個用來縮短網址的工具，把原本非常多字的連結縮短成大約 10 個字符，甚至更少！",
                            image: "https://zyreny.com/og_img.png",
                        },
                    },
                },
            },
            "GET /list": {
                description: "列出同一個 IP 位置建立的短網址",
                response: {
                    success: "boolean - 是否成功",
                    urls: [
                        {
                            code: "string - 短網址代碼",
                            url: "string - 原始網址",
                            createdAt: "string - 建立時間 (ISO 8601 格式)",
                            hasPassword: "boolean - 是否有設定密碼",
                            exp: "string | null - 過期時間 (ISO 8601 格式)",
                            meta: {
                                title: "string | null - 自訂標題",
                                description: "string | null - 自訂描述",
                                image: "string | null - 縮圖網址",
                            },
                        },
                    ],
                    total: "number - 總共的短網址數量",
                },
                exampleResponse: {
                    success: true,
                    urls: [
                        {
                            code: "home",
                            url: "https://zyreny.com/",
                            createdAt: "2025-09-28T15:02:40.712+08:00",
                            hasPassword: false,
                            exp: null,
                            meta: {
                                title: null,
                                description: null,
                                image: null,
                            },
                        },
                        {
                            code: "ZyrNT",
                            url: "https://chromewebstore.google.com/detail/zyrnt/ipeioiohfjiohgndlhoglhloipocenoj",
                            createdAt: "2025-09-20T15:40:47.830+08:00",
                            hasPassword: false,
                            exp: null,
                            meta: {
                                title: null,
                                description: null,
                                image: null,
                            },
                        },
                    ],
                    total: 2,
                },
            },
            "DELETE /del/{code}": {
                description: "刪除短網址",
                parameters: {
                    code: "string (必填) - 要刪除的短網址代碼",
                },
                response: {
                    success: "boolean - 是否成功",
                    message: "string - 回應訊息",
                },
                exampleResponse: {
                    success: true,
                    message: "短網址刪除成功",
                },
            },
        },
        errorCodes: {
            500: "伺服器錯誤",
            503: "服務暫時無法使用",
            400: "請求參數錯誤 (如缺少必填參數、參數格式錯誤等)",
            403: "沒有存取權限",
            404: "找不到存取內容",
            409: "自訂代碼已被使用",
        },
    };

    return jsonRes(docs, 200, headers, 4);
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
