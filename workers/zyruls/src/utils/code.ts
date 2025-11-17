import kvOrThrow from "./kvOperation";

// 產生代碼
export default async function genShortCode(env: Env): Promise<string> {
    const chars: string =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code: string = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing: string | null = await kvOrThrow(() => env.URL_KV.get(code));

    if (existing) {
        return genShortCode(env);
    }

    return code;
}
