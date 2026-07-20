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