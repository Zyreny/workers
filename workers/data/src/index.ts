interface Env {
    DATA_DB: D1Database;
    API_KEY_HASH: {
        get(): Promise<string>;
    };
}

interface ProjRecord {
    id: number;
    name: string;
    title: string;
    desc: string;
    created_at: string;
}

interface NewsRecord {
    id: number;
    category: string;
    title: string;
    content: string;
    created_at: string;
    categoryZH?: string;
}

import baseDocs from "./docs/base.json";
import projsDocs from "./docs/projs.json";
import newsDocs from "./docs/news.json";

const CATEGORY_ZH: Record<string, string> = {
    "web-update": "網站更新",
    "proj-update": "專案更新",
    "new-proj": "新作品",
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // CORS 標頭
        const corsHeaders: Record<string, string> = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        const method: string = request.method;

        // 處理 Preflight 請求
        if (method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        const url: URL = new URL(request.url);
        const apiPath: string =
            url.pathname.replace("/data", "").replace(/\/$/, "") || "/";

        // 路由請求
        if (apiPath.startsWith("/projs")) {
            return await handleProjs(apiPath, request, env, corsHeaders);
        }

        if (apiPath.startsWith("/news")) {
            return await handleNews(apiPath, request, env, corsHeaders);
        }

        if (apiPath === "/") {
            return jsonRes(baseDocs, 200, corsHeaders, 4);
        }

        return jsonRes(
            {
                success: false,
                message: `找不到 "${method} ${apiPath}" 的端點， "GET /" 可以查看這個 API 的文檔`,
            },
            404,
            corsHeaders
        );
    },
};

// 處理作品資料相關請求
async function handleProjs(
    apiPath: string,
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const paths: string[] = apiPath.split("/").filter(Boolean);
    const method: string = req.method;

    if (!paths[1]) return jsonRes(projsDocs, 200, headers, 4);

    if (paths[1] === "list" && method === "GET") {
        let query: string = "SELECT * FROM projs ORDER BY id DESC";
        let limit: number | null = null;

        if (paths[2] && !isNaN(Number(paths[2]))) {
            limit = Number(paths[2]);
            query += " LIMIT ?";
        }

        const stmt: D1PreparedStatement = env.DATA_DB.prepare(query);
        const { results }: { results: ProjRecord[] } =
            limit !== null ? await stmt.bind(limit).all() : await stmt.all();
        return jsonRes(results, 200, headers);
    }

    if (paths[1] === "add" && method === "POST") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok) return auth.response ?? jsonRes({ success: false, message: "無效的 API Key" }, 403, headers);

        const data: Record<string, any> = auth.data!;

        await env.DATA_DB.prepare(
            "INSERT INTO projs (name, title, desc, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
        )
            .bind(data.name, data.title, data.description)
            .run();

        return jsonRes(
            { success: true, message: "作品資料新增成功" },
            201,
            headers
        );
    }

    if (paths[1] === "del" && method === "DELETE") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok) return auth.response ?? jsonRes({ success: false, message: "無效的 API Key" }, 403, headers);

        let query: string = "DELETE FROM projs";
        let id: number | null = null;

        if (paths[2] && !isNaN(Number(paths[2]))) {
            id = Number(paths[2]);
            query += " WHERE id = ?";
        } else {
            query +=
                " WHERE id = (SELECT id FROM projs ORDER BY id DESC LIMIT 1)";
        }

        const stmt: D1PreparedStatement = env.DATA_DB.prepare(query);
        await (id !== null ? stmt.bind(id).run() : stmt.run());

        return jsonRes(
            { success: true, message: "作品資料刪除成功" },
            200,
            headers
        );
    }

    return jsonRes(
        {
            success: false,
            message: `找不到 "${method} ${apiPath}" 的端點， "GET /projs" 可以查看這個 API 的文檔`,
        },
        404,
        headers
    );
}

// 處理新聞資料相關請求
async function handleNews(
    apiPath: string,
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const paths: string[] = apiPath.split("/").filter(Boolean);
    const method: string = req.method;

    if (!paths[1]) return jsonRes(newsDocs, 200, headers, 4);

    if (paths[1] === "list" && method === "GET") {
        let query: string = "SELECT * FROM news";
        let params: any[] = [];

        if (paths[2] === "days" && paths[3] && !isNaN(Number(paths[3]))) {
            const days: number = Number(paths[3]);
            query += " WHERE created_at >= date('now', '+8 hours', ?)";
            params.push(`-${days} days`);
        } else if (paths[2] && !isNaN(Number(paths[2]))) {
            const limit: number = Number(paths[2]);
            query += " LIMIT ?";
            params.push(limit);
        }

        query += " ORDER BY created_at DESC";

        const stmt: D1PreparedStatement = env.DATA_DB.prepare(query);
        const { results }: { results: NewsRecord[] } =
            params.length > 0
                ? await stmt.bind(...params).all()
                : await stmt.all();

        results.forEach(
            (result: any) =>
                (result.categoryZH = CATEGORY_ZH[result.category as string])
        );

        return jsonRes(results, 200, headers);
    }

    if (paths[1] === "add" && method === "POST") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok) return auth.response ?? jsonRes({ success: false, message: "無效的 API Key" }, 403, headers);

        const data: Record<string, any> = auth.data!;

        await env.DATA_DB.prepare(
            "INSERT INTO news (category, title, content, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
        )
            .bind(data.category, data.title, data.content)
            .run();

        return jsonRes(
            { success: true, message: "新聞資料新增成功" },
            201,
            headers
        );
    }

    if (paths[1] === "del" && method === "DELETE") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok) return auth.response ?? jsonRes({ success: false, message: "無效的 API Key" }, 403, headers);

        let query: string = "DELETE FROM news";
        let id: number | null = null;

        if (paths[2] && !isNaN(Number(paths[2]))) {
            id = Number(paths[2]);
            query += " WHERE id = ?";
        } else {
            query += " WHERE id = (SELECT MAX(id) FROM news)";
        }

        const stmt: D1PreparedStatement = env.DATA_DB.prepare(query);
        await (id !== null ? stmt.bind(id).run() : stmt.run());

        return jsonRes(
            { success: true, message: "新聞資料刪除成功" },
            200,
            headers
        );
    }

    return jsonRes(
        {
            success: false,
            message: `找不到 "${method} ${apiPath}" 的端點， "GET /" 可以查看這個 API 的文檔`,
        },
        404,
        headers
    );
}

// 輔助函式

// JSON 回應
function jsonRes(
    body: Object,
    status: number,
    headers: Record<string, string>,
    spaces: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, spaces), {
        status,
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            ...headers,
        },
    });
}

// 驗證 API Key
async function verifyApiKey(apiKey: string, env: Env): Promise<boolean> {
    if (!apiKey) return false;

    const encoder: TextEncoder = new TextEncoder();
    const data: Uint8Array = encoder.encode(apiKey);
    const hashBuffer: ArrayBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray: number[] = Array.from(new Uint8Array(hashBuffer));
    const hashHex: string = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex === (await env.API_KEY_HASH.get());
}

async function requireApiKey(
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<{ ok: boolean; response?: Response; data?: Record<string, any> }> {
    let data: Record<string, any> = {};
    try {
        data = await req.json();
    } catch {
        return {
            ok: false,
            response: jsonRes(
                { success: false, message: "無效的 JSON 格式" },
                400,
                headers
            ),
        };
    }

    if (!(await verifyApiKey(data.apiKey, env))) {
        return {
            ok: false,
            response: jsonRes(
                { success: false, message: "無效的 API Key" },
                403,
                headers
            ),
        }
    }

    return { ok: true, data };
}
