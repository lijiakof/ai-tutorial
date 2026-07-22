import fs from 'node:fs';
import splitter from './src/splitter.js';
import embedding from './src/embedding.js';
import query from './src/query.js';

const indexPath = './rag-index';
const documentText = fs.readFileSync('./data/doc.txt', 'utf-8');

async function vectorStore() {
  console.log(`📄 文档内容：\n${documentText}\n`);
  const tunkTexts = await splitter(documentText);
  await embedding(tunkTexts, indexPath);
}

async function vectorQuery(text) {
  console.log(`\n❓ 用户提问：${text}`);
  return await query(text, indexPath);
}

await vectorStore();
await vectorQuery('什么是 RAG？');