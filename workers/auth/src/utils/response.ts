import { validateOrigin } from "./validation";

// JSON 回應
export function json(
    body: JsonResponseBody,
    status: number,
    req: Request,
    space: number | undefined = undefined,
    header: Record<string, string> = {}
): Response {
    return new Response(JSON.stringify(body, null, space), {
        status: status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders(req),
            ...header,
        },
    });
}

// 400 錯誤回應
export function json400(msg: string, req: Request): Response {
    return json({ success: false, message: msg }, 400, req);
}

// CORS 標頭
function corsHeaders(req: Request): Record<string, string> {
    const origin: string = req.headers.get("Origin") || "";
    if (!origin || !validateOrigin(origin)) return {};
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
    };
}
