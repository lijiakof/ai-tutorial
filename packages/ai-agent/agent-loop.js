import tools from './tools/index.js';
import deepseek from './models/deepseek.js';

async function agentLoop(userPrompt) {
  const messages = [
    { role: 'system', content: '你是一个智能助手，能够使用工具来完成任务。' },
    { role: 'user', content: userPrompt },
  ];

  const maxTurns = 10;

  for (let i = 0; i < maxTurns; i++) {
    console.log(`Loop ${i + 1}:`);

    const response = await deepseek({
      messages, 
      tools: tools.definition
    });

    const resMessage = response.choices?.[0].message;
    // let content = resMessage?.content;

    console.log(`Thought：${resMessage?.reasoning_content}`)
    if (resMessage?.tool_calls && resMessage.tool_calls.length > 0) {
      const toolCall = resMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await tools.execute(toolName, toolArgs);
      // content = toolResult;
      console.log(`Tool：${toolName}，Result：${toolResult}`)

      // messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult });
      messages.push({ role: 'assistant', content: toolResult });
      console.log(`${"-".repeat(60)}`);
    }
    else {
      console.log(`${"-".repeat(60)}`);
      break;
    }
  }

  const finalResponse = await deepseek({ messages });
  return finalResponse.choices?.[0]?.message?.content;
}

export default agentLoop;