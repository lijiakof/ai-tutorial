import fs from 'node:fs';
import splitter from './src/splitter.js';
import embedding from './src/embedding.js';
import query from './src/query.js';

const indexPath = './rag-index';
const documentText = fs.readFileSync('./data/doc.txt', 'utf-8');

async function vectorStore() {
  const preview = documentText.length > 50 ? documentText.slice(0, 50) + '...' : documentText;
  console.log(`📄 文档内容（前50字）：\n${preview}\n`);
  const tunkTexts = await splitter(documentText);
  await embedding(tunkTexts, indexPath);
}

async function vectorQuery(text) {
  console.log(`\n❓ 用户提问：${text}`);
  const results = await query(text, indexPath);

  console.log('🔍 检索到的相关片段：');
  results.forEach((s, i) => console.log(`   [片段${i + 1}] ${s}`));

  return results;
}

await vectorStore();
await vectorQuery('什么是 RAG？');