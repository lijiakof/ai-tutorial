import calculator from './calculator.js';
import currentTime from './current-time.js';
import httpRequest from './http-request.js';
import balance from './balance.js';

const tools = [
  calculator,
  currentTime,
  httpRequest,
  balance,
];

// 方便按名字查找
const toolMap = {};
for (const tool of tools) {
  toolMap[tool.definition.name] = tool;
}
// 执行工具
async function executeTool(name, args) {
  const tool = toolMap[name];
  if (!tool) {
    return `错误: 没有名为 "${name}" 的工具。可用工具: ${Object.keys(toolMap).join(", ")}`;
  }
  return await tool.execute(args);
}

export { executeTool };

export default tools;