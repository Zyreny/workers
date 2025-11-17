import newsDocs from "../docs/news.json";

import json from "../utils/response";
import requireApiKey from "../utils/apiKey";

interface NewsRecord {
    id: number;
    category: string;
    title: string;
    content: string;
    created_at: string;
    categoryZH?: string;
}

// 對應中文類別
const CATEGORY_ZH: Record<string, string> = {
    "web-update": "網站更新",
    "proj-update": "專案更新",
    "new-proj": "新作品",
};

// 處理新聞資料相關請求
export async function handle(
    apiPath: string,
    req: Request,
    env: Env
): Promise<Response> {
    const paths: string[] = apiPath.split("/").filter(Boolean);
    const method: string = req.method;

    // API 文檔
    if (!paths[1]) return json(newsDocs, 200, 4);

    // 列出新聞資料
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

        return json(results, 200);
    }

    // 新增新聞資料
    if (paths[1] === "add" && method === "POST") {
        const auth = await requireApiKey(req, env);
        if (!auth.ok)
            return (
                auth.response ??
                json({ success: false, message: "無效的 API Key" }, 403)
            );

        const data: Record<string, any> = auth.data!;

        await env.DATA_DB.prepare(
            "INSERT INTO news (category, title, content, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))"
        )
            .bind(data.category, data.title, data.content)
            .run();

        return json({ success: true, message: "新聞資料新增成功" }, 201);
    }

    // 刪除新聞資料
    if (paths[1] === "del" && method === "DELETE") {
        const auth = await requireApiKey(req, env);
        if (!auth.ok)
            return (
                auth.response ??
                json({ success: false, message: "無效的 API Key" }, 403)
            );

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

        return json({ success: true, message: "新聞資料刪除成功" }, 200);
    }

    return json(
        {
            success: false,
            message: `找不到 "${method} ${apiPath}" 的端點， "GET /" 可以查看這個 API 的文檔`,
        },
        404
    );
}
