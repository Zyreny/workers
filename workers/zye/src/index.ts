interface Env {
    URL_KV: KVNamespace;
}

import home from "./templates/home.html";
import notFound from "./templates/notFound.html";
import password from "./templates/password.html";

export default {
  	async fetch(request: Request, env: Env): Promise<Response> {
		// CORS 標頭
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		};

		// 處理 Preflight 請求
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		const url = new URL(request.url);
		const path = url.pathname;

		// 處理靜態資源請求
		if (path === "/" && request.method === "GET") {
			return htmlRes(home, 200, corsHeaders);
		}

		if (path !== "/" && request.method === "GET") {
			const code = path.split("/")[1];
			return await handleRedirect(code, request, env, corsHeaders);
		}

		if (path === "/verify" && request.method === "POST") {
			return await handleVerify(request, env, corsHeaders);
		}

		return new Response("找不到頁面", { 
      		status: 404,
      		headers: corsHeaders 
  		});
	},
};

// 重新導向
async function handleRedirect(code: string, req: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  	try {
    	const urlDataString = await env.URL_KV.get(code);

		if (!urlDataString) {
			return handleNotFound(code, headers);
		}

		const urlData = JSON.parse(urlDataString);

		const expCheck = await checkExpField(urlData, code, env, headers);
		if (expCheck) return expCheck;

		// 檢查是否有密碼
		if (urlData.password) {
			return handlePassword(code, headers);
		}

		const crawlerCheck = await isCrawler(req, urlData, headers);
		if (crawlerCheck) return crawlerCheck;

		// 進行重新導向
		return Response.redirect(urlData.url, 302);
  	} catch (e) {
    	return new Response("伺服器錯誤", {
			status: 500, 
			headers: {
				"Content-Type": "text/html; charset=utf-8",
          		...headers 
			}
		});
  	}
}

// 找不到短網址
async function handleNotFound(code: string, headers: Record<string, string>): Promise<Response> {
	const html = await loadTemplate("notFound", { code });

 	return htmlRes(html, 404, headers);
}

// 密碼頁面
async function handlePassword(code: string, headers: Record<string, string>, errMsg = ""): Promise<Response> {
	const errSection = errMsg ? `<div class="error-message">${errMsg}</div>` : "";
	const html = await loadTemplate("password", { code, errSection });

	return htmlRes(html, 200, headers);
}

// 生成預覽頁面
async function genMeta(url: string, meta: Record<string, any>, code: string, headers: Record<string, string>): Promise<Response> {
	const hasCustomMeta = meta && (meta.title || meta.description || meta.image);

	const shortUrl = `https://zye.me/${code}`;

	let title, description, image;

	if (hasCustomMeta) {
		title = meta.title || "正在重新導向...";
		description = meta.description || "";
		image = meta.image || ""; 
	} else {
		try {
			const res = await fetch(url, { 
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)",
					"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
					"Cache-Control": "no-cache"
				},
				cf: {
					cacheTtl: 300,
					cacheEverything: true
				}
			} as RequestInit & { cf?: any });

			if (res.ok) {
				const html = await res.text();

				const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
				const isMatch = match ? match[1] : null;

				title = getMetaContent(html, ["og:title", "twitter:title"]) || isMatch || "查看連結內容";
				description = getMetaContent(html, ["og:description", "twitter:description", "description"]) || "";
				image = getMetaContent(html, ["og:image", "twitter:image"]);

				title = decodeHtml(title.trim());
				description = decodeHtml(description.trim());
			} else {
				title = "查看連結內容"
				description = ""; 
				image = "";
			}
		} catch (e) {
			title = "查看連結內容"
			description = ""; 
			image = "";
		}
	}

	const htmlTitle = hasCustomMeta && title ? title : "正在重新導向...";

	const html = `
		<!DOCTYPE html>
		<html lang="zh-TW">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${escapeHtml(htmlTitle)}</title>

			<link rel="icon" href="/favicon.ico" sizes="32x32" />
			<link rel="icon" type="image/svg+xml" href="/icon.svg" />
			<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
			<link rel="manifest" href="/site.webmanifest" />

			<meta property="og:type" content="website">
			<meta property="og:url" content="${escapeHtml(shortUrl)}">
			<meta property="og:title" content="${escapeHtml(title)}">
			<meta property="og:description" content="${escapeHtml(description)}">
			${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}

			<meta property="twitter:card" content="summary_large_image">
			<meta property="twitter:url" content="${escapeHtml(shortUrl)}">
			<meta property="twitter:title" content="${escapeHtml(title)}">
			<meta property="twitter:description" content="${escapeHtml(description)}">
			${image ? `<meta property="twitter:image" content="${escapeHtml(image)}">` : ""}

			<style>
				body {
					min-height: 100vh;
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
				}
			</style>
		</head>

		<body>
			<h1>正在重新導向...</h1>
			<p>如果沒有自動跳轉，請點擊 <a href="">這裡</a></p>

			<script>
				// 檢測是否為爬蟲
				function isCrawler() {
					const userAgent = navigator.userAgent.toLowerCase();
					const crawlers = [
						"facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
						"telegram", "skype", "line", "discord", "slackbot", "googlebot",
						"bingbot", "yandexbot", "baiduspider", "pinterest", "instagram"
					];
					return crawlers.some(crawler => userAgent.includes(crawler));
				}

				if (!isCrawler()) {
					window.location.replace("${escapeHtml(url)}");
				}
			</script>
		</body>
		</html>
	`

	return htmlRes(html, 200, headers);
}

async function handleVerify(req: Request, env: Env, headers: Record<string, string>): Promise<Response> {
	try {
		const formData = await req.formData();
		const codeEntry = formData.get("code");
		const passwordEntry = formData.get("password");
		const code = typeof codeEntry === "string" ? codeEntry : null;
		const password = typeof passwordEntry === "string" ? passwordEntry : null;

		if (!code || !password) return new Response("缺少必要參數", {
			status: 400, 
			headers: headers,
		})

		const urlDataString = await env.URL_KV.get(code);
		if (!urlDataString) return handleNotFound(code, headers);

		const hashedPassword = await hash(password);
		const urlData = JSON.parse(urlDataString);

		const expCheck = await checkExpField(urlData, code, env, headers);
		if (expCheck) return expCheck;

		if (hashedPassword !== urlData.password) {
			return handlePassword(code, headers, "密碼錯誤，請重新輸入");
		}

		const crawlerCheck = await isCrawler(req, urlData, headers);
		if (crawlerCheck) return crawlerCheck;

		return Response.redirect(urlData.url, 302);
	} catch (e) {
		return new Response("伺服器錯誤", {
			status: 500, 
			headers: {
				"Content-Type": "text/html; charset=utf-8",
          		...headers 
			}
		});
	}
}

// 輔助函式

// HTML 回應
function htmlRes(html: string, status: number, headers: Record<string, string>): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

// 取得台灣時間
function getTwTime(date = new Date()) {
  const twTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return twTime;
}

// 取得 meta 內容
function getMetaContent(html: string, props: string[]): string | null {
  	for (const prop of props) {
		const patterns = [
			new RegExp(`<meta[^>]*property=['"]${prop}['"][^>]*content=['"]([^'"]*?)['"][^>]*>`, 'i'),
			new RegExp(`<meta[^>]*content=['"]([^'"]*?)['"][^>]*property=['"]${prop}['"][^>]*>`, 'i'),
			new RegExp(`<meta[^>]*name=['"]${prop}['"][^>]*content=['"]([^'"]*?)['"][^>]*>`, 'i'),
			new RegExp(`<meta[^>]*content=['"]([^'"]*?)['"][^>]*name=['"]${prop}['"][^>]*>`, 'i')
		];

		for (const pattern of patterns) {
			const match = html.match(pattern);
			if (match && match[1].trim()) {
				return match[1];
			}
		}
	}
  return null;
}

// 解碼 HTML 實體
function decodeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#039;": "'",
    "&#x27;": "'",
    "&apos;": "'",
    "&nbsp;": " "
  };
  
  return text.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

// 轉義 HTML
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 文字雜湊
async function hash(text: string): Promise<string> {
	const enc = new TextEncoder().encode(text);
	const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
	return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// 檢查過期
async function checkExpField(urlData: Record<string, any>, code: string, env: Env, headers: Record<string, string>): Promise<Response | null> {
	const expField = urlData.exp;
	const now = getTwTime();
	const expTime = new Date(expField);

	if (expField && now > expTime) {
		// 已過期，刪除資料
		await env.URL_KV.delete(code);
		return handleNotFound(code, headers);
	}

	return null;
}

// 檢查爬蟲
async function isCrawler(req: Request, urlData: Record<string, any>, headers: Record<string, string>): Promise<Response | null> {
	const userAgent = (req.headers.get("User-Agent") || "").toLowerCase();
	const isSocialCrawler = /bot|crawl|spider|slurp|mediapartners/i.test(userAgent);

	const url = new URL(req.url);
	const forcePreview = url.searchParams.get("preview") === "1";

	if (isSocialCrawler || forcePreview) return await genMeta(urlData.url, urlData.meta || {}, urlData.code, headers);

	return null;
}

function renderTemplate(template: string, data: Record<string, any>): string {
	return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key) => {
		const keys = key.split(".");
		let value = data;

		for (const k of keys) {
			value = value?.[k];
		}

		return value !== undefined ? String(value) : match;
	});
}

async function loadTemplate(name: string, data: Record<string, any>): Promise<string> {
	try {
		let template = "";

		switch (name) {
			case "notFound":
				template = notFound;
				break;
			case "password":
				template = password;
				break;
		};
		return renderTemplate(template, data);
	} catch (e) {
		throw new Error(`Error: ${e}`);
	}
}