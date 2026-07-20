import "dotenv/config";

export default async function deepseek({ modelId = 'deepseek-v4-flash', messages, tools, temperature = 0.1}) {

  const body = {
    model: modelId,
    messages,
    tools,
    temperature
  };

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  })
  
  return response.json();
}

export async function deepseekBalance(messages) {
  const response = await fetch('https://api.deepseek.com/user/balance', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    }
  })
  return response.json();
}