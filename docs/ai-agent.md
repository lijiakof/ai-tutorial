# 如何实现一个 AI Agent

## AI Agent 是什么
**AI Agent（人工智能智能体）** 是一个能够**自主感知环境、进行推理决策并采取行动**，以实现特定目标的人工智能系统

你可以把它理解为一个“**会行动、会协作、会学习的数字员工**”。如果说传统的大模型（如DeepSeek）是“大脑”，AI助手是“会说话的大脑”，那么AI Agent就是拥有了“手和脚”，能够真正动手完成任务的智能体。

### AI Agent 与聊天机器人的区别

## AI Agent 由哪些部分组成
AI Agent 由这几个核心部分组成：
- **ReAct Loop 模块**：通过一个迭代循环来工作，其典型轨迹由*思考（Thought）*、*行动（Action）* 和 *观察（Observation）* 三个关键步骤组成。核心目标是让AI模型从“被动应答者”升级为能主动与外部世界交互的“问题解决者”。
- **工具调用模块**：这是Agent的 “四肢和感官”，让它能影响外部世界，大模型本身只有文本输出，靠工具模块来“动手”。
- **行动与执行模块**：这是Agent的“执行手脚”，负责将规划好的指令转化为具体的物理或数字操作。（它与“工具调用模块”在某种程度上是可以合并成一个模块的）
- **记忆系统**：这是Agent的 “档案管理员”，让它不至于“说完就忘”，分为两种：*短期记忆（上下文）* 、*长期记忆（向量存储）* 。
- **大模型**：这是Agent的 *“中枢神经”*，负责所有的理解和推理。它不直接干活，而是负责“思考”。

## 实现过程

### LLM 接口简介
先了解一下大模型的接口，这样才能为实现 AI Agent 打下基础，下面以 DeepSeek 的 API 为例。
#### 简单对话

``` JavaScript
async function agentChat(userPrompt) {

  const body = {
    model: 'deepseek-v4-flash',
    messages: [
      { role: 'system', content: '你是一个智能助手，回答用户的问题。' },
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

  return message.content;
}

export default agentChat;
```

#### 多轮对话

``` JavaScript
const history = [];
async function agentChatMultiTurn(userPrompt) {

const body = {
  model: 'deepseek-v4-flash',
  messages: [
    { role: 'system', content: '你是一个智能助手，回答用户的问题。' },
    ...history,
    { role: 'user', content: userPrompt },
  ]};

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
```

#### 工具调用

工具定义
``` JavaScript
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
```

``` JavaScript
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
```


### LLM 调用模块

### 工具调用模块

### ReAct Loop 模块

### 记忆系统

### 改进

## 总结