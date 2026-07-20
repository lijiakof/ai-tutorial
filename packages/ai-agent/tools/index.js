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