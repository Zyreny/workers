interface Env {
    DATA_DB: D1Database;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response | string> {
        // CORS 標頭
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, API-Key",
        };

        // 處理 Preflight 請求
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        const url = new URL(request.url);
        const paths = url.pathname.split("/").filter(Boolean);

        if (!paths[1])
            return jsonRes({
                "/projs": "作品資料操作",
                "/news": "新聞資料操作",
            });

        if (paths[1] === "projs") {
            if (!paths[2]) {
                return jsonRes({
                    "免API Key驗證的端點": {
                        "/list": "列出所有作品資料",
                        "/[數字]": "列出最新的[數字]筆作品資料",
                    },
                    "需要API Key驗證的端點": {
                        "/add": "新增一筆作品資料",
                        "/del": "刪除最新的作品資料",
                        "/del/[ID]": "刪除ID為[ID]的作品資料",
                    },
                });
            }

            if (paths[2] === "list") {
                const { results } = await env.DATA_DB.prepare(
                    "SELECT * FROM projs ORDER BY id DESC"
                ).all();
                return jsonRes(results);
            }

            if (!isNaN(Number(paths[2]))) {
                const { results } = await env.DATA_DB.prepare(
                    "SELECT * FROM projs ORDER BY id DESC LIMIT ?"
                )
                    .bind(paths[2])
                    .all();
                return jsonRes(results);
            }

            if (paths[2] === "add") {
                if (request.method !== "POST")
                    return new Response("只接受POST請求", { status: 405 });
                const data: Record<string, any> = await request.json();
                const valid = await verifyApiKey(data.apiKey, env);
                if (!valid.ok) return valid.res;

                const results = await env.DATA_DB.prepare(
                    "INSERT INTO projs (name, title, desc, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
                )
                    .bind(data.name, data.title, data.desc)
                    .run();

                return jsonRes({
                    message: "作品資料新增成功",
                    id: (results as any).lastInsertRowid,
                    apiKey: "API Key正確",
                });
            }

            if (paths[2] === "del") {
                if (request.method !== "DELETE")
                    return new Response("只接受DELETE請求", { status: 405 });
                const data: Record<string, any> = await request.json();
                const valid = await verifyApiKey(data.apiKey, env);
                if (!valid.ok) return valid.res;

                if (!paths[3]) {
                    await env.DATA_DB.prepare(
                        "DELETE FROM projs WHERE id = (SELECT MAX(id) FROM projs)"
                    ).run();
                    return jsonRes({
                        message: "已刪除最後一筆作品資料",
                        apiKey: "API Key正確",
                    });
                } else {
                    await env.DATA_DB.prepare("DELETE FROM projs WHERE name = ?")
                        .bind(paths[3])
                        .run();
                    return jsonRes({
                        message: `已刪除ID為${paths[3]}的作品資料`,
                        apiKey: "API Key正確",
                    });
                }
            }
        }

        if (paths[1] === "news") {
            const categoryZH = {
                "web-update": "網站更新",
                "proj-update": "專案更新",
                "new-proj": "新作品",
            };

            if (!paths[2]) {
                return jsonRes({
                    "免API Key驗證的端點": {
                        "/list": "列出所有新聞資料",
                        "/list/[天數]": "列出最近[天數]天內的新聞資料",
                        "/[數字]": "列出最新的[數字]筆新聞資料",
                    },
                    "需要API Key驗證的端點": {
                        "/add": "新增一筆新聞資料",
                        "/del": "刪除最新的新聞資料",
                        "/del/[ID序號]": "刪除第[ID序號]筆新聞資料",
                    },
                });
            }

            if (paths[2] === "list") {
                if (!paths[3]) {
                    const { results } = await env.DATA_DB.prepare(
                        "SELECT * FROM news ORDER BY id DESC"
                    ).all();

                    results.forEach(
                        (result) =>
                            (result.categoryZH = categoryZH[result.category as keyof typeof categoryZH])
                    );
                    return jsonRes(results);
                } else if (!isNaN(Number(paths[3]))) {
                    const { results } = await env.DATA_DB.prepare(
                        "SELECT * FROM news WHERE created_at >= date('now', '+8 hours', ?) ORDER BY created_at DESC"
                    )
                        .bind(`-${paths[3]} day`)
                        .all();

                    results.forEach(
                        (result) =>
                            (result.categoryZH = categoryZH[result.category as keyof typeof categoryZH])
                    );
                    return jsonRes(results);
                }
            }

            if (!isNaN(Number(paths[2]))) {
                const { results } = await env.DATA_DB.prepare(
                    "SELECT * FROM news ORDER BY id DESC LIMIT ?"
                )
                    .bind(paths[2])
                    .all();

                results.forEach(
                    (result) =>
                        (result.categoryZH = categoryZH[result.category as keyof typeof categoryZH])
                );
                return jsonRes(results);
            }

            if (paths[2] === "add") {
                if (request.method !== "POST")
                    return new Response("只接受POST請求", { status: 405 });
                const data: Record<string, any> = await request.json();
                const valid = await verifyApiKey(data.apiKey, env);
                if (!valid.ok) return valid.res;

                const results = await env.DATA_DB.prepare(
                    "INSERT INTO news (category, title, content, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
                )
                    .bind(data.category, data.title, data.content)
                    .run();

                return jsonRes({
                    message: "新聞資料新增成功",
                    id: (results as any).lastInsertRowid,
                    apiKey: "API Key正確",
                });
            }

            if (paths[2] === "del") {
                if (request.method !== "DELETE")
                    return new Response("只接受DELETE請求", { status: 405 });
                const data: Record<string, any> = await request.json();
                const valid = await verifyApiKey(data.apiKey, env);
                if (!valid.ok) return valid.res;

                if (!paths[3]) {
                    await env.DATA_DB.prepare(
                        "DELETE FROM news WHERE id = (SELECT MAX(id) FROM news)"
                    ).run();
                    return jsonRes({
                        message: "已刪除最後一筆新聞資料",
                        apiKey: "API Key正確",
                    });
                } else if (!isNaN(Number(paths[3]))) {
                    await env.DATA_DB.prepare("DELETE FROM news WHERE id = ?")
                        .bind(paths[3])
                        .run();
                    return jsonRes({
                        message: `已刪除ID序號為${paths[3]}的新聞資料`,
                        apiKey: "API Key正確",
                    });
                }
            }
        }

        return new Response("找不到端點", { status: 404 });
    },
};

function jsonRes(data: Record<string, any>, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}

async function verifyApiKey(apiKey: string | undefined, env: any) {
    if (!apiKey)
        return { ok: false, res: new Response("API Key為空", { status: 400 }) };

    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    if (hashHex !== (await env.API_KEY_HASH.get()))
        return { ok: false, res: jsonRes("API Key無效", { status: 401 }) };
    else return { ok: true };
}
