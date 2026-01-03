import { validateOrigin } from "./utils/validation";
import { json } from "./utils/response";

import * as registerAPI from "./api/register";
import * as verifyAPI from "./api/verify";

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // 處理 Preflight 請求
        if (request.method === "OPTIONS") {
            const origin: string | null = request.headers.get("Origin");
            if (!origin || !validateOrigin(origin))
                return json(
                    { success: false, message: "無效的 Origin" },
                    403,
                    request
                );

            const headers: Record<string, string> = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                Vary: "Origin",
            };

            return new Response(null, {
                status: 204,
                headers: headers,
            });
        }

        const url: URL = new URL(request.url);
        const apiPath: string =
            url.pathname.replace("/auth", "").replace(/\/$/, "") || "/";
        const method: string = request.method;

        // 路由請求
        // try {
        //     if (apiPath === "/register" && method === "POST")
        //         return await registerAPI.handle(request, env);

        //     if (apiPath === "/verify" && method === "POST")
        //         return await verifyAPI.handle(request, env);
        // } catch (error) {
        //     return json(
        //         { success: false, message: "伺服器錯誤", error: String(error) },
        //         500,
        //         request
        //     );
        // }

        if (apiPath === "/register" && method === "POST")
            return await registerAPI.handle(request, env);

        if (apiPath === "/verify" && method === "POST")
            return await verifyAPI.handle(request, env);

        return new Response("找不到資源", { status: 404 });
    },
};
