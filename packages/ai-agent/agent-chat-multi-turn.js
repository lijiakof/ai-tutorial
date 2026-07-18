
const history = [];

async function agentChatMultiTurn(userPrompt) {
  const body = {
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: '你是一个智能助手，回答用户的问题。' },
      ...history,
      { role: 'user', content: userPrompt },
    ]
  };

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  const responseData = await response.json();
  const message = responseData.choices[0].message;
  
  history.push(
    { role: 'user', content: userPrompt }, 
    { role: 'assistant', content: message.content });

  return message.content;
}

export default agentChatMultiTurn;