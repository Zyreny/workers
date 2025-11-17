// 文字雜湊
export default async function hash(text: string): Promise<string> {
    const enc: Uint8Array = new TextEncoder().encode(text);
    const hashBuffer: ArrayBuffer = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
