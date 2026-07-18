
import * as readline from "readline";
import agentChat from './agent-chat.js';
import agentChatMultiTurn from './agent-chat-multi-turn.js';
import agentTool from './agent-tools.js';
import agentLoop from './agent-loop.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
  agentTool(input).then(response => {
    console.log(`回答：${response}`);
  });
});

