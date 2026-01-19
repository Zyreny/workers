import {
    HASH_ALGORITHM,
    HASH_FUNCTION,
    HASH_ITERATIONS,
} from "../constants/config";

// 使用 PBKDF2 進行密碼雜湊
export async function hashPassword(
    password: string,
    saltB64: string
): Promise<string> {
    const encoder: TextEncoder = new TextEncoder();
    const key: CryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: HASH_ALGORITHM },
        false,
        ["deriveBits"]
    );

    const saltBuffer: Uint8Array = b64ToU8A(saltB64);

    const bits: ArrayBuffer = await crypto.subtle.deriveBits(
        {
            name: HASH_ALGORITHM,
            salt: saltBuffer,
            iterations: HASH_ITERATIONS,
            hash: HASH_FUNCTION,
        },
        key,
        256
    );

    return b64Encode(bits);
}

// 將 string | ArrayBuffer 轉成 base64 編碼
export function b64Encode(input: string | ArrayBuffer): string {
    let bytes: Uint8Array;
    if (typeof input === "string") bytes = new TextEncoder().encode(input);
    else bytes = new Uint8Array(input);

    let binary: string = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
}

// 將 string | ArrayBuffer 轉成 base64URL 編碼
export function b64UrlEncode(input: string | ArrayBuffer): string {
    const b64 = b64Encode(input);
    return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// 將 base64URL 編碼轉成 base64
export function b64UrltoB64(str: string): string {
    let b64: string = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad: number = b64.length % 4;
    b64 += pad ? "=".repeat(4 - pad) : "";
    return b64;
}

// 將 base64 編碼轉成 Uint8Array
export function b64ToU8A(str: string): Uint8Array {
    const binary: string = atob(str);
    const bytes: Uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

// 將 base64URL 轉成字串
export function b64UrlDecode(b64Url: string): string {
    const u8A: Uint8Array = b64ToU8A(b64UrltoB64(b64Url));
    const decoder: TextDecoder = new TextDecoder();
    return decoder.decode(u8A);
}

// 生成隨機 6 位數驗證碼
export function genVerCode(): string {
    const randomNum: number = crypto.getRandomValues(new Uint32Array(1))[0];
    const code: number = randomNum % 1000000;
    return code.toString().padStart(6, "0");
}
