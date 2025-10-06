import docs from "./docs.json";

import json from "./utils/response";

import * as createAPI from "./api/create";
import * as listAPI from "./api/list";
import * as deleteAPI from "./api/delete";

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
            const apiPath =
                path.replace("/zyruls", "").replace(/\/$/, "") || "/";

            if (apiPath === "/create" && method === "POST") {
                return await createAPI.handle(request, env, corsHeaders);
            }

            if (apiPath === "/list" && method === "GET") {
                return await listAPI.handle(request, env, corsHeaders);
            }

            if (apiPath.startsWith("/del/") && method === "DELETE") {
                const code = apiPath.split("/")[2];
                return await deleteAPI.handle(code, request, env, corsHeaders);
            }

            if (apiPath === "/" && method === "GET") {
                return json(docs, 200, corsHeaders, 4);
            }

            return json(
                {
                    success: false,
                    message: `找不到 "${method} ${apiPath}" 的端點， GET / 可以查看這個 API 的文檔`,
                },
                404,
                corsHeaders
            );
        } catch (e) {
            if (e instanceof Response) return e;
            return json(
                { success: false, message: "伺服器錯誤，請稍後再試" },
                500,
                corsHeaders
            );
        }
    },
};
