import { DEV_MODE, REFRESH_TOKEN_EXP } from "../constants/config";

export function buildRefreshCookie(
    value: string,
    maxAge: number = REFRESH_TOKEN_EXP
): string {
    const domain: string = DEV_MODE ? "localhost" : ".zyreny.com";
    return [
        `refresh=${value}`,
        `HttpOnly`,
        `Secure`,
        `SameSite=None`,
        `Path=/`,
        `Domain=${domain}`,
        `Max-Age=${maxAge}`,
    ].join("; ");
}
