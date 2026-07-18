import tools, { executeTool } from './tools/index.js';
import {deepseek} from './models/deepseek.js';
// ReAct: thought -> action(params) -> observation
// thought
// action
// params
// content
function rolePrompt() {

  return `你是一个智能助手，能够使用工具来完成任务。

## 你的工作方式

你必须严格按照以下格式循环工作：
## 你的工作方式

你必须严格按照以下格式循环工作：

Thought: 分析当前情况，决定下一步做什么。不要做任何假设——需要信息就查。
Action: 如果需要使用工具，输出工具名称和参数：
\`\`\`json
{"action": "tool_name", "params": {...}}
\`\`\`
Observation: 工具执行结果会由系统返回给你。你必须等看到 Observation 再做下一步判断。

如果任务完成，输出：
\`\`\`json
{"action": "final_answer", "content": "你的最终回答"}
\`\`\`

## 重要规则
- 每轮只能执行一个工具调用，或者给出最终答案
- 不要猜测或编造信息——不确定就查工具
- Tool 的 Observation 是你唯一的信息来源，不要忽略它
- 当你有足够信息回答用户时，立即输出 final_answer
- 用中文回答用户

## 可用工具
${tools.map(tool => `- ${tool.definition.name}:${tool.definition.description}`).join('\n')}

  `
}

async function agentLoop(userPrompt) {
  const maxSteps = 10;

  const messages = [
    { role: 'system', content: rolePrompt() },
    { role: 'user', content: userPrompt },
  ];

  const steps = [];

  for (let i = 0; i < maxSteps; i++) {
    console.log(`Step ${i + 1}:`);

    const response = await deepseek(messages, tools.map(tool => {
      return {
        type: 'function',
        function: {
          name: tool.definition.name,
          description: tool.definition.description,
          parameters: tool.definition.parameters,
        }
      }
    }), 0.1);

    const rawOutput = response.choices[0].message.content;
    console.log(`LLM 原始输出: ${rawOutput}`);

    const toolCall = response.choices[0].message?.tool_calls?.[0];
    const toolName = toolCall?.function?.name;
    const toolArgs = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

    const reAct = parseReAct(rawOutput);
    console.log(reAct);

    if (reAct.action === 'final_answer') {
      console.log(`最终答案: ${reAct.content}`);
      return reAct.content;
    }

    if (toolName && toolArgs) {
      console.log(`执行工具: ${toolName}`);

      const toolResult = await executeTool(toolName, toolArgs);

      messages.push({ role: 'assistant', content: toolResult });
      messages.push({ role: 'user', content: `Observation: ${toolResult}` });
    }
    else {
      messages.push({ role: 'assistant', content: rawOutput });
      messages.push({ role: 'user', content: `请按照格式继续：Thought + Action 或 final_answer。不要直接回答，先确保查了需要的信息。` });
    }
  }

  messages.push({ 
    role: 'user', 
    content: `你已经用完了所有步骤。请基于到目前为止收集到的所有信息，给出最佳答案。输出 final_answer。`
  });

  const finalResponse = await deepseek(messages);

  const finalOutput = finalResponse.choices[0].message.content;
  console.log(`最终答案: ${finalOutput}`);

  return steps;
}

function parseReAct(text) {
  // 提取 Thought
  const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n(?:Action|Observation|$))/s);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : null;

  // 尝试提取 JSON Action
  const jsonMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        thought,
        action: parsed.action || null,
        params: parsed.params || null,
        content: parsed.content || null,
      };
    } catch {
      // JSON 解析失败，继续尝试其他方式
    }
  }

  // 尝试提取 final_answer 的 content
  const faMatch = text.match(/"action"\s*:\s*"final_answer"[\s\S]*"content"\s*:\s*"(.+?)"/);
  if (faMatch) {
    return { thought, action: "final_answer", content: faMatch[1].replace(/\\"/g, '"') };
  }

  // 兜底
  if (/final\s*answer|最终答案|答案是/i.test(text)) {
    return { thought, action: "final_answer", content: text };
  }

  return { thought, action: null, params: null, content: null };
}


agentLoop('北京天气怎么样，我去北京玩有什么攻略');