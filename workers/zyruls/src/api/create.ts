import { json, json400 } from "../utils/response";
import kvOrThrow from "../utils/kvOperation";
import isValidUrl from "../utils/url";
import { formatTwTime, getTwTime } from "../utils/time";
import hash from "../utils/hash";
import genShortCode from "../utils/code";

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
export async function handle(req: Request, env: Env): Promise<Response> {
    const { url, custom, password, exp, meta }: RequestBody = await req.json();

    // 基本驗證
    const contentType: string | null = req.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json"))
        return json400("Content-Type 必須是 application/json");

    // 驗證網址
    if (!url || !isValidUrl(url)) return json400("請輸入有效的原始網址");

    // 處理短網址代碼
    let shortCode: string = "";
    if (custom) {
        if (
            !/^[a-zA-Z0-9-_]+$/.test(custom) ||
            custom.length < 3 ||
            custom.length > 20
        )
            return json400(
                "自訂代碼必須是 3-20 個字符，且只能包含英文字母、數字、連字符和底線"
            );

        const existing: string | null = await kvOrThrow(() =>
            env.URL_KV.get(custom)
        );

        if (existing) {
            return json(
                { success: false, message: `自訂代碼 "${custom}" 已被使用` },
                409
            );
        }

        shortCode = custom;
    } else {
        shortCode = await genShortCode(env);
    }

    // 處理過期時間
    let expDate: Date | null = null;
    if (exp) {
        expDate = new Date(exp);
        if (isNaN(expDate.getTime()) || expDate <= getTwTime())
            return json400("請輸入有效的過期時間");
    }

    // 處理密碼
    let hashedPassword: string | null = null;
    if (password) {
        if (password.length > 100)
            return json400("密碼長度不能超過 100 個字符");
        hashedPassword = await hash(password);
    }

    // 驗證社群預覽
    if (meta) {
        if (meta.image && !isValidUrl(meta.image))
            return json400("請輸入有效的縮圖網址");

        if (meta.title && meta.title.length > 100) {
            return json400("標題長度不能超過 100 個字符");
        }

        if (meta.description && meta.description.length > 300) {
            return json400("描述長度不能超過 300 個字符");
        }
    }

    // 儲存資料
    const urlData: Record<string, any> = {
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

    const indexKey: string = `index:${urlData.creator}`;

    const existingIndex: string | null = await kvOrThrow(() =>
        env.URL_KV.get(indexKey)
    );
    const urlIndex: Array<Record<string, any>> = existingIndex
        ? JSON.parse(existingIndex)
        : [];

    if (urlIndex.length >= 75) {
        return json(
            { success: false, message: "每個使用者最多只能建立 75 個短網址" },
            403
        );
    }

    await kvOrThrow(() => env.URL_KV.put(shortCode, JSON.stringify(urlData)));

    urlIndex.push({
        code: shortCode,
        url: url,
        createdAt: urlData.createdAt,
        hasPassword: !!password,
        exp: urlData.exp,
        meta: urlData.meta,
    });

    await kvOrThrow(() => env.URL_KV.put(indexKey, JSON.stringify(urlIndex)));

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
        201
    );
}
