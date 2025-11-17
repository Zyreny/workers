import kvOrThrow from "../utils/kvOperation";
import json from "../utils/response";

// 刪除短網址
export async function handle(
    code: string,
    req: Request,
    env: Env
): Promise<Response> {
    const existingCode = await kvOrThrow(() => env.URL_KV.get(code));

    if (!existingCode) {
        return json({ success: false, message: "找不到該短網址" }, 404);
    }

    const clientIP = req.headers.get("CF-Connecting-IP") || "unknown";
    const urlData = JSON.parse(existingCode);

    if (urlData.creator !== clientIP) {
        return json(
            { success: false, message: "你沒有權限刪除這個短網址" },
            403
        );
    }

    await kvOrThrow(() => env.URL_KV.delete(code));

    const indexKey = `index:${urlData.creator}`;

    const existingIndex = await kvOrThrow(() => env.URL_KV.get(indexKey));
    if (existingIndex) {
        const urlIndex = JSON.parse(existingIndex);
        const updatedIndex = urlIndex.filter(
            (item: { code: string }) => item.code !== code
        );

        await kvOrThrow(() =>
            env.URL_KV.put(indexKey, JSON.stringify(updatedIndex))
        );
    }

    return json({ success: true, message: "短網址刪除成功" }, 200);
}
