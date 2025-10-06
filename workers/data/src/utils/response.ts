// JSON 回應
export default function jsonRes(
    body: Object,
    status: number,
    headers: Record<string, string>,
    spaces: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, spaces), {
        status,
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            ...headers,
        },
    });
}