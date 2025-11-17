// 取得台灣時間
export function getTwTime(date = new Date()): Date {
    const twTime: Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return twTime;
}

// 格式化台灣時間為 ISO 字串
export function formatTwTime(date = new Date()): string {
    const twTime: Date = getTwTime(date);
    const isoString: string = twTime.toISOString();
    return isoString.replace("Z", "+08:00");
}