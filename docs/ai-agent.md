# 如何实现一个 AI Agent

## AI Agent 是什么
**AI Agent（人工智能智能体）** 是一个能够**自主感知环境、进行推理决策并采取行动**，以实现特定目标的人工智能系统

你可以把它理解为一个“**会行动、会协作、会学习的数字员工**”。如果说传统的大模型（如DeepSeek）是“大脑”，AI助手是“会说话的大脑”，那么AI Agent就是拥有了“手和脚”，能够真正动手完成任务的智能体。

### AI Agent 与聊天机器人的区别

| 特征 | AI Agent  | 聊天机器人 |
|  ----  | ----  | ----  |
| 工作方式  | 主动执行：用户设定目标，它自主规划并完成 | 被动响应：用户提问，它回答 |
| 任务处理  | 处理复杂、多步骤的任务 | 处理简单、单步的指令 |
| 规划能力  | 能自主将目标拆解为可执行的子任务 | 遵循预设的对话路径或规则 |
| 工具使用  | 能动态调用外部工具，如搜索引擎、数据库、代码环境等 | 通常只能调用预设的简单 API |
| 典型场景  |  |  |

## AI Agent 由哪些部分组成
AI Agent 由这几个核心部分组成：
- **ReAct Loop 模块**：通过一个迭代循环来工作，其典型轨迹由*思考（Thought）*、*行动（Action）* 和 *观察（Observation）* 三个关键步骤组成。核心目标是让AI模型从“被动应答者”升级为能主动与外部世界交互的“问题解决者”。
- **工具调用模块**：这是Agent的 “四肢和感官”，让它能影响外部世界，大模型本身只有文本输出，靠工具模块来“动手”。
- **行动与执行模块**：这是Agent的“执行手脚”，负责将规划好的指令转化为具体的物理或数字操作。（它与“工具调用模块”在某种程度上是可以合并成一个模块的）
- **记忆系统**：这是Agent的 “档案管理员”，让它不至于“说完就忘”，分为两种：*短期记忆（上下文）* 、*长期记忆（向量存储）* 。
- **大模型**：这是Agent的 *“中枢神经”*，负责所有的理解和推理。它不直接干活，而是负责“思考”。

![AI Agent](./assets/ai-agent-structure.png)

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
大模型调用模块其实很简单，就是将各大模型厂商的 API 接口做一层封装，让 Agent 系统调用不同模型的方式是保持一致的。先简单用 DeepSeek 做一层封装。

``` JavaScript
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
```

``` JavaScript
import deepseek from './deepseek.js';
import kimi from './kimi.js';

async function callModel(model, params) {
  const modelMap = {
    'deepseek': deepseek,
    'kimi': kimi
  };

  if (!modelMap[model]) {
    throw new Error(`Unknown model: ${model}`);
  }

  return await modelMap[model](params);
}
```

### 工具调用模块&执行模块
工具的调用和执行分两部分：
1. 工具的定义：将工具名称、入参、出参等定义提供给大模型，让大模型能够理解工具如何使用。
2. 工具的执行：具体工具的执行，将对应的入参给到工具，工具运行完后给到执行后的结果。

以下用数学计算工具为例子：

``` JavaScript
// tools/calculator.js
const calculator = {
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
};

export default calculator;
```

``` JavaScript
// tools/index.js
import calculator from './calculator.js';
import currentTime from './current-time.js';
import httpRequest from './http-request.js';
import balance from './balance.js';

const TOOLS = [
  calculator,
  currentTime,
  httpRequest,
  balance,
];

export default {
  definition: TOOLS.map(tool => {
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
    const tool = TOOLS.find(tool => tool.definition.name === name);
    if (!tool) {
      return `错误: 没有名为 "${name}" 的工具。可用工具: ${TOOLS.map(tool => tool.definition.name).join(", ")}`;
    }
    return await tool.execute(args);
  }
};
```

### ReAct Loop 机制

设计一个简单的 ReAct Loop 机制

![ReAct Loop](./assets/ai-agent-react.png)

``` JavaScript
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
    let content = resMessage?.content;

    console.log(`Thought：${resMessage?.reasoning_content}`)
    if (resMessage?.tool_calls && resMessage.tool_calls.length > 0) {
      const toolCall = resMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await tools.execute(toolName, toolArgs);
      content = toolResult;
      console.log(`Tool：${toolName}，Result：${toolResult}`)

      // messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult });
      messages.push({ role: 'assistant', content: toolResult });
      console.log(`${"═".repeat(60)}`);
    }
    else {
      console.log(`${"═".repeat(60)}`);
      break;
    }
  }

  const finalResponse = await deepseek({ messages });
  return finalResponse.choices?.[0]?.message?.content;
}

export default agentLoop;
```

### 记忆系统
AI Agent 的记忆系统分如下几类：

- 短期记忆：在当前会话中保持上下文连贯性，让Agent“不健忘”。
- 长期记忆：跨会话持久化信息，让Agent“有积累”，实现个性化。
- 情景记忆：记录特定时空下的事件和经历，如“用户上周三问了XX问题”。
- 语义记忆：存储客观事实、知识和用户偏好，如“用户喜欢Python”。

我们上面的“多轮对话“例子其实就是一个短期记忆的简单方案，长期记忆一般通过RAG系统（检索增强生成）进行存储和检索，RAG的细节部分我们会在后面的学习中提到。设计一个优秀的AI Agent记忆系统，关键在于借鉴认知科学的分层架构，并实现一套完整的“写入-管理-读取”生命周期管理机制，细节我们不在这个地方详细讲述，未来会有专门的文章中详细讲解。

### 改进

## 总结