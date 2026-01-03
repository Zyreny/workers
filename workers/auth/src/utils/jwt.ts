
import { ACCESS_TOKEN_EXP, REFRESH_TOKEN_EXP } from "../constants/config";
import {
    b64Encode,
    b64ToU8A,
    b64UrlDecode,
    b64UrlEncode,
    b64UrltoB64,
} from "./text";

// 建立 JWT
export async function createJWT(
    payload: JwtPayload,
    privateKey: string
): Promise<string> {
    const header: JwtHeader = { alg: "EdDSA", typ: "JWT" };
    const headerB64: string = b64UrlEncode(JSON.stringify(header));

    const iat: number = Math.floor(Date.now() / 1000);
    const exp: number = iat + ACCESS_TOKEN_EXP;
    payload = { ...payload, iat, exp };
    const payloadB64: string = b64UrlEncode(JSON.stringify(payload));

    const privateKeyU8A: Uint8Array = b64ToU8A(b64Encode(privateKey));
    const key: CryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyU8A,
        { name: "Ed25519" },
        false,
        ["sign"]
    );

    const encoder: TextEncoder = new TextEncoder();
    const data: Uint8Array = encoder.encode(`${headerB64}.${payloadB64}`);
    const sig: string = b64UrlEncode(
        await crypto.subtle.sign({ name: "Ed25519" }, key, data)
    );

    return `${headerB64}.${payloadB64}.${sig}`;
}

// 驗證 JWT
export async function verifyJWT(
    token: string,
    publicKey: string
): Promise<boolean> {
    const parts: string[] = token.split(".");
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, sigB64]: string[] = parts;
    const headerStr: string = b64UrlDecode(headerB64);
    const header: JwtHeader = JSON.parse(headerStr);
    if (header.alg !== "EdDSA") return false;

    const publicKeyU8A: Uint8Array = b64ToU8A(b64Encode(publicKey));
    const key: CryptoKey = await crypto.subtle.importKey(
        "spki",
        publicKeyU8A,
        { name: "Ed25519" },
        false,
        ["verify"]
    );

    const sig: Uint8Array = b64ToU8A(b64UrltoB64(sigB64));
    const data: string = `${headerB64}.${payloadB64}`;
    const encoder: TextEncoder = new TextEncoder();
    const dataU8A: Uint8Array = encoder.encode(data);
    const valid = await crypto.subtle.verify(
        { name: "Ed25519" },
        key,
        sig,
        dataU8A
    );
    if (!valid) return false;

    const payloadStr: string = b64UrlDecode(payloadB64);
    const payload: JwtPayload = JSON.parse(payloadStr);
    const now: number = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return false;

    return true;
}

// 解析 JWT
export function parseJWT(token: string): [JwtHeader, JwtPayload] | null {
    const parts: string[] = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64]: string[] = parts;
    const headerStr: string = b64UrlDecode(headerB64);
    const header: JwtHeader = JSON.parse(headerStr);
    const payloadStr: string = b64UrlDecode(payloadB64);
    const payload: JwtPayload = JSON.parse(payloadStr);

    return [header, payload];
}