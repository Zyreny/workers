import { ALLOWED_ORIGINS } from "../constants/config";
import { json400 } from "./response";

// 檢查來源
export function validateOrigin(origin: string | null): boolean {
    if (!origin) return false;
    const zyrenyRegex: RegExp = /^https:\/\/.*\.zyreny\.com$/;
    return zyrenyRegex.test(origin) || ALLOWED_ORIGINS.includes(origin);
}

export function validateContentType(req: Request): boolean {
    const contentType: string | null = req.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json"))
        return false;

    return true;
}
