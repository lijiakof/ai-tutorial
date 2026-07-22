import fs from 'node:fs';
import { pipeline } from '@xenova/transformers';
import { LocalIndex } from 'vectra';

export default async function query(text, indexPath) {
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const index = new LocalIndex(indexPath);
  if (!fs.existsSync(indexPath)) {
    console.log('⚠️ 本地向量库不存在');
    return;
  }

  // 召回（Recall）
  console.log('⏳ 正在将用户问题向量化...');
  const output = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  const queryVector = Array.from(output.data);
  console.log('⏳ 正在召回相关片段...');
  const results = await index.queryItems(queryVector, "", 10); // 取前10个最相似的块
  const contextSnippets = results.map((r) => r.item.metadata.text);
  console.log("🔍 检索到的相关片段：");
  contextSnippets.forEach((s, i) => console.log(`   [片段${i + 1}] ${s}`));

  // TODO：重排（Rerank）
  console.log('⏳ 正在对检索到的片段进行重排...');
  
  console.log('✅ 重排完成！\n');

  return contextSnippets;
}