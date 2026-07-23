import tools from './tools/index.js';
import deepseek from './models/deepseek.js';

const messages = [
  { role: 'system', content: '你是一个智能助手，能够使用工具来完成任务。' },
];

async function agentLoop(userPrompt) {
  messages.push({ role: 'user', content: userPrompt });
  console.log(messages);

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

      // TODO: 这里可以根据需要将工具调用结果作为新的消息添加到消息列表中，或者直接返回结果给用户
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
  const finalMessage = finalResponse.choices?.[0].message;
  messages.push(finalMessage);

  return finalMessage?.content;
}

export default agentLoop;