import projsDocs from "../docs/projs.json";

import jsonRes from "../utils/response";
import requireApiKey from "../utils/apiKey";

interface ProjRecord {
    id: number;
    name: string;
    title: string;
    desc: string;
    created_at: string;
}

// 處理作品資料相關請求
export async function handle(
    apiPath: string,
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<Response> {
    const paths: string[] = apiPath.split("/").filter(Boolean);
    const method: string = req.method;

    // API 文檔
    if (!paths[1]) return jsonRes(projsDocs, 200, headers, 4);

    // 取得作品列表
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

    // 新增作品資料
    if (paths[1] === "add" && method === "POST") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok)
            return (
                auth.response ??
                jsonRes(
                    { success: false, message: "無效的 API Key" },
                    403,
                    headers
                )
            );

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

    // 刪除作品資料
    if (paths[1] === "del" && method === "DELETE") {
        const auth = await requireApiKey(req, env, headers);
        if (!auth.ok)
            return (
                auth.response ??
                jsonRes(
                    { success: false, message: "無效的 API Key" },
                    403,
                    headers
                )
            );

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
