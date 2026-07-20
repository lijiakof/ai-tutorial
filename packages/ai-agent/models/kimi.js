import "dotenv/config";

export default async function kimi({modelId = 'kimi-k2.6', messages, tools, temperature = 0.1}) {
  const body = {
    model: modelId,
    messages,
    tools,
    temperature
  };

  const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MOONSHOT_API_KEY}`
    },
    body: JSON.stringify(body)
  })
  
  return response.json();
}