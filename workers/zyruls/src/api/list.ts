import kvOrThrow from "../utils/kvOperation";
import json from "../utils/response";

// 列出使用者的短網址
export async function handle(req: Request, env: Env): Promise<Response> {
    const clientIP = req.headers.get("CF-Connecting-IP") || "unknown";
    const indexKey = `index:${clientIP}`;

    const existingIndex = await kvOrThrow(() => env.URL_KV.get(indexKey));
    const urlIndex = existingIndex ? JSON.parse(existingIndex) : [];

    return json(
        { success: true, urls: urlIndex.reverse(), total: urlIndex.length },
        200
    );
}
