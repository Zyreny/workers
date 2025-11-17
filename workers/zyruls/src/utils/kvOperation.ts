import json from "./response";

// KV 操作
async function kvOperation(
    op: () => Promise<any>,
) {
    try {
        const results = await op();
        return { success: true, data: results };
    } catch (e) {
        const errMsg = (
            e instanceof Error ? e.message : String(e) || ""
        ).toLowerCase();
        const kvLimitHit =
            errMsg.includes("kv") &&
            (errMsg.includes("limit exceeded") ||
                errMsg.includes("quota exceeded") ||
                errMsg.includes("rate limit") ||
                errMsg.includes("too many requests"));

        const response = kvLimitHit
            ? json(
                  {
                      success: false,
                      message:
                          "請稍後再試一次，如果嘗試多次之後還是失敗請等台灣時間早上8點後再試",
                  },
                  503
              )
            : json(
                  {
                      success: false,
                      message:
                          "伺服器錯誤，請稍後再試，如果嘗試多次之後還是失敗請等台灣時間早上8點後再試",
                  },
                  500
              );

        return { success: false, response };
    }
}

// KV 操作代理函式
export default async function kvOrThrow(
    op: () => Promise<any>
): Promise<any> {
    const res = await kvOperation(op);
    if (!res.success) throw res.response;
    return res.data;
}
