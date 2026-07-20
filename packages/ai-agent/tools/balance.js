import { deepseekBalance } from '../models/deepseek.js';

const balance = {
  definition: {
    name: 'balance',
    description: '获取余额'
  },

  execute: async () => {
    const result = await deepseekBalance();
    return JSON.stringify(result);
  },
};

export default balance;