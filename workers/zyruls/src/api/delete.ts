import kvOrThrow from "../utils/kvOperation";
import { json } from "../utils/response";

// 刪除短網址
export async function handle(
    code: string,
    req: Request,
    env: Env
): Promise<Response> {
    const existingCode: string | null = await kvOrThrow(() =>
        env.URL_KV.get(code)
    );

    if (!existingCode) {
        return json({ success: false, message: "找不到該短網址" }, 404);
    }

    const clientIP: string = req.headers.get("CF-Connecting-IP") || "unknown";
    const urlData: { creator: string } = JSON.parse(existingCode);

    if (urlData.creator !== clientIP) {
        return json(
            { success: false, message: "你沒有權限刪除這個短網址" },
            403
        );
    }

    await kvOrThrow(() => env.URL_KV.delete(code));

    const indexKey: string = `index:${urlData.creator}`;

    const existingIndex: string | null = await kvOrThrow(() => env.URL_KV.get(indexKey));
    if (existingIndex) {
        const urlIndex: Array<{ code: string }> = JSON.parse(existingIndex);
        const updatedIndex: Array<{ code: string }> = urlIndex.filter(
            (item: { code: string }) => item.code !== code
        );

        await kvOrThrow(() =>
            env.URL_KV.put(indexKey, JSON.stringify(updatedIndex))
        );
    }

    return json({ success: true, message: "短網址刪除成功" }, 200);
}
