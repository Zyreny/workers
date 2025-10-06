// JSON 回應
export default function json(
    body: Object,
    status: number,
    headers: Record<string, string>,
    space: number | undefined = undefined
): Response {
    return new Response(JSON.stringify(body, null, space), {
        status: status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}