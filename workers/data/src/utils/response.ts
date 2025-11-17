// JSON 回應
export function json(
    body: Object,
    status: number,
    spaces: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, spaces), {
        status,
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            ...corsHeaders,
        },
    });
}

// CORS 標頭
export const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};