// 發送電子郵件
export async function sendEmail(
    to: string,
    template: string,
    subject: string,
    env: Env,
    vars: Record<string, any>
): Promise<any> {
    const templateIdMap: Record<string, number> = {
        verification: 7496518,
    };
    const templateId = templateIdMap[template];

    const { MJ_API_KEY, MJ_SECRET_KEY } = env;

    const body: Record<string, any> = {
        Messages: [
            {
                From: {
                    Email: "hi@zyreny.com",
                    Name: "Zyreny",
                },
                To: [
                    {
                        Email: to,
                    },
                ],
                TemplateID: templateId,
                TemplateLanguage: true,
                Subject: subject,
                Variables: vars,
            },
        ],
    };

    const res: Response = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Basic " + btoa(`${MJ_API_KEY}:${MJ_SECRET_KEY}`),
        },
        body: JSON.stringify(body),
    });

    return await res.json();
}
