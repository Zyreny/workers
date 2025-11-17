// JSON 回應
export function json(
    body: Object,
    status: number,
    space: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, space), {
        status: status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

export function json400(msg: string): Response {
    return json({ success: false, message: msg }, 400);
}

// CORS 標頭
export const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};
