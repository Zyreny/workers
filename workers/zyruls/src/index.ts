import docs from "./docs.json";

import { json, corsHeaders } from "./utils/response";

import * as createAPI from "./api/create";
import * as listAPI from "./api/list";
import * as deleteAPI from "./api/delete";

export default {
    async fetch(request: Request, env: Env) {
        // 處理 Preflight 請求
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders,
            });
        }

        const url: URL = new URL(request.url);
        const path: string = url.pathname;
        const method: string = request.method;

        try {
            // 處理 API 請求
            const apiPath: string =
                path.replace("/zyruls", "").replace(/\/$/, "") || "/";

            if (apiPath === "/create" && method === "POST")
                return await createAPI.handle(request, env);

            if (apiPath === "/list" && method === "GET")
                return await listAPI.handle(request, env);

            if (apiPath.startsWith("/del/") && method === "DELETE") {
                const code: string = apiPath.split("/")[2];
                return await deleteAPI.handle(code, request, env);
            }

            if (apiPath === "/" && method === "GET") return json(docs, 200, 4);

            return json(
                {
                    success: false,
                    message: `找不到 "${method} ${apiPath}" 的端點， GET / 可以查看這個 API 的文檔`,
                },
                404
            );
        } catch (e) {
            if (e instanceof Response) return e;
            return json(
                { success: false, message: "伺服器錯誤，請稍後再試" },
                500
            );
        }
    },
};
