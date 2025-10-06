import jsonRes from "./response";

// 驗證 API Key
async function verifyApiKey(apiKey: string, env: Env): Promise<boolean> {
    if (!apiKey) return false;

    const encoder: TextEncoder = new TextEncoder();
    const data: Uint8Array = encoder.encode(apiKey);
    const hashBuffer: ArrayBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray: number[] = Array.from(new Uint8Array(hashBuffer));
    const hashHex: string = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex === (await env.API_KEY_HASH.get());
}

export default async function requireApiKey(
    req: Request,
    env: Env,
    headers: Record<string, string>
): Promise<{ ok: boolean; response?: Response; data?: Record<string, any> }> {
    let data: Record<string, any> = {};
    try {
        data = await req.json();
    } catch {
        return {
            ok: false,
            response: jsonRes(
                { success: false, message: "無效的 JSON 格式" },
                400,
                headers
            ),
        };
    }

    if (!(await verifyApiKey(data.apiKey, env))) {
        return {
            ok: false,
            response: jsonRes(
                { success: false, message: "無效的 API Key" },
                403,
                headers
            ),
        }
    }

    return { ok: true, data };
}