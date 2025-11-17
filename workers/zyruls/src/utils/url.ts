// URL 驗證
export default function isValidUrl(str: string): boolean {
    try {
        const url: URL = new URL(str);
        return ["http:", "https:"].includes(url.protocol);
    } catch (_) {
        return false;
    }
}