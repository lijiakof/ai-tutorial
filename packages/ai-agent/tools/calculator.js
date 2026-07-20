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