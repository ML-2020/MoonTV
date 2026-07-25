/**
 * MoonTV 视频代理 Worker
 *
 * 原理：浏览器 → Cloudflare 边缘节点 → 源站
 * 用 Cloudflare 全球网络替代用户直连慢源站
 *
 * m3u8 清单会被改写，所有 ts 分片也自动走代理
 */

const worker = {
  async fetch(request, env, ctx) {
    const reqUrl = new URL(request.url);

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const targetUrl = reqUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response('MoonTV Video Proxy\nUsage: /?url=<encoded_url>', {
        headers: { 'content-type': 'text/plain' },
      });
    }

    // 使用 Cloudflare 内置缓存
    const cache = caches.default;
    const cacheKey = `https://moontv-proxy/${encodeURIComponent(targetUrl)}`;

    let cached = await cache.match(cacheKey);
    if (cached) return cached;

    // 从源站获取
    let response;
    try {
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: '*/*',
          Referer: new URL(targetUrl).origin,
        },
        cf: { cacheTtl: 3600 },
      });
    } catch (err) {
      return new Response(`Proxy fetch error: ${err.message}`, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (!response.ok && response.status >= 400) {
      return new Response(`Source returned ${response.status}`, {
        status: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 判断是否为 m3u8 清单文件
    const contentType = response.headers.get('content-type') || '';
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl') ||
      targetUrl.includes('.m3u8');

    if (isM3u8) {
      // ---- m3u8 清单：改写内部地址，让 ts/子清单也走代理 ----
      let text = await response.text();
      text = rewriteM3U8(text, reqUrl.origin, targetUrl);

      response = new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30', // 清单缓存 30 秒
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      // ---- ts 分片 / 其他：直接透传 ----
      response = new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600, immutable',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};

/**
 * 改写 m3u8 内容：把绝对路径和相对路径都替换为代理地址
 */
function rewriteM3U8(text, proxyOrigin, sourceUrl) {
  const base = new URL(sourceUrl);
  const lines = text.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 注释和空行 → 原样保留
    if (trimmed.startsWith('#') || trimmed === '') {
      result.push(line);
      continue;
    }

    // 解析为绝对 URL（处理相对路径）
    let absolute;
    try {
      absolute = new URL(trimmed, base).href;
    } catch {
      result.push(line);
      continue;
    }

    // 替换为代理地址
    result.push(`${proxyOrigin}/?url=${encodeURIComponent(absolute)}`);
  }

  return result.join('\n');
}

export default worker;
