import { to } from 'await-to-js';

export const httpRequest = {
  definition: {
    name: 'http_request',
    description: '发送 HTTP GET 请求获取 URL 内容。用于获取 API 数据或网页内容。',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要请求的 URL',
        },
      },
      required: ['url'],
    },
  },

  execute: async ({ url }) => {
    const [error, result] = await to(fetch(url, { signal: AbortSignal.timeout(5000) }));
    if (error) {
      return JSON.stringify({ url, error: `请求失败: ${error.message}` });
    }
    const text = await result.text();
    // 截断，防止上下文爆炸
    const truncated = text.length > 2000 ? text.slice(0, 2000) + '...(已截断)' : text;
    return JSON.stringify({ url, status: result.status, content: truncated });
  },
};