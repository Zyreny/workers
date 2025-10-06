import baseDocs from "./docs/base.json";

import jsonRes from "./utils/response";

import * as projsAPI from "./api/projs";
import * as newsAPI from "./api/news";

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
            return await projsAPI.handle(apiPath, request, env, corsHeaders);
        }

        if (apiPath.startsWith("/news")) {
            return await newsAPI.handleNews(apiPath, request, env, corsHeaders);
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
