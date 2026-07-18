import { deepseekBalance } from '../models/deepseek.js';

export const balance = {
  definition: {
    name: 'balance',
    description: '获取余额'
  },

  execute: async () => {
    const result = await deepseekBalance();
    return JSON.stringify(result);
  },
};