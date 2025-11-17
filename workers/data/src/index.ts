import baseDocs from "./docs/base.json";

import { json, corsHeaders } from "./utils/response";

import * as projsAPI from "./api/projs";
import * as newsAPI from "./api/news";

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
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
            return await projsAPI.handle(apiPath, request, env);
        }

        if (apiPath.startsWith("/news")) {
            return await newsAPI.handle(apiPath, request, env);
        }

        if (apiPath === "/") {
            return json(baseDocs, 200, 4);
        }

        return json(
            {
                success: false,
                message: `找不到 "${method} ${apiPath}" 的端點， "GET /" 可以查看這個 API 的文檔`,
            },
            404
        );
    },
};
