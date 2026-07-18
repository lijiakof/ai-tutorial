
function tools() {
  const toolList = [
    {
      definition: {
        name: "current_time",
        description: "获取当前日期和时间，以及所在时区。不需要任何参数。",
        parameters: {
          type: "object",
          properties: {
            timezone: {
              type: 'string',
              description: '可选。时区，例如 "Asia/Shanghai", "America/New_York"，默认本地时区',
            },
          },
        },
      },
    
      execute: async ({ timezone } = {}) => {
        const now = new Date();
        const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        return JSON.stringify({
          iso: now.toISOString(),
          local: now.toLocaleString('zh-CN', { timeZone: tz }),
          date: now.toLocaleDateString('zh-CN', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          time: now.toLocaleTimeString('zh-CN', { timeZone: tz }),
          timezone: tz,
        });
      },
    },
    {
      definition: {
        name: 'calculator',
        description: "执行数学计算。支持加减乘除、乘方、三角函数等。输入一个数学表达式，返回计算结果。",
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: '数学表达式，例如: "2 + 3 * 4", "sqrt(144)", "sin(pi/2)"',
            },
          },
          required: ['expression'],
        },
      },
    
      execute: async ({ expression }) => {
        try {
          // 安全地执行数学表达式（只用 Math 函数，不执行任意代码）
          const sanitized = expression.replace(/\^/g, '**');
          const allowed = new Set([
            'abs', 'ceil', 'floor', 'round', 'max', 'min',
            'sqrt', 'pow', 'sin', 'cos', 'tan', 'log', 'log2', 'log10',
            'PI', 'E', 'exp',
          ]);
          const result = Function(
            ...allowed,
            `return (${sanitized})`
          )(...Array.from(allowed).map((name) => Math[name]));
          return JSON.stringify({ expression, result });
        } catch (e) {
          return JSON.stringify({ error: `计算失败: ${e.message}` });
        }
      },
    }
  ];

  return {
    definition: toolList.map(tool => {
      return {
        type: 'function',
        function: {
          name: tool.definition.name,
          description: tool.definition.description,
          parameters: tool.definition.parameters,
        }
      }
    }),
    execute: async (name, args) => {
      const tool = toolList.find(tool => tool.definition.name === name);
      if (!tool) {
        return `错误: 没有名为 "${name}" 的工具。可用工具: ${toolList.map(tool => tool.definition.name).join(", ")}`;
      }
      return await tool.execute(args);
    }
  }
}

async function deepseek(messages, tools) {
  const body = {
    model: 'deepseek-v4-flash',
    messages,
    tools,
    temperature: 0.1
  };

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function agentTool(userPrompt) {

  const messages = [
    { role: 'system', content: '你是一个智能助手，能够使用工具来完成任务。可以使用工具执行数学计算、获取当前时间。' },
    { role: 'user', content: userPrompt },
  ];

  const response = await deepseek(messages, tools().definition);
  const resMessage = response.choices[0].message;

  let content = resMessage.content;
  if (resMessage.tool_calls) {
    const toolCall = resMessage.tool_calls[0];
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments);
    const toolResponse = await tools().execute(toolName, toolArgs);

    messages.push(resMessage);
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResponse });
    
    console.log(`${toolName}的返回结果是：${toolResponse}`);

    const res2 = await deepseek(messages);
    const res2Message = res2.choices?.[0]?.message;
    content = res2Message?.content;
  }

  return content;
}

export default agentTool;