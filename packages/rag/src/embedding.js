import fs from 'node:fs';
import { pipeline } from '@xenova/transformers';
import { LocalIndex } from 'vectra';

export default async function embedding(chunkTexts, indexPath) {
  // 初始化嵌入模型
  console.log('⏳ 正在加载嵌入模型（首次运行会下载约 30MB）...');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  // 清理历史索引，每次向量化都从干净状态开始
  const index = new LocalIndex(indexPath);
  if (fs.existsSync(indexPath)) {
    console.log('🧹 清理历史向量索引...');
    fs.rmSync(indexPath, { recursive: true, force: true });
  }
  await index.createIndex();
  console.log('📦 创建本地向量索引');

  console.log('💾 正在将文档块向量化并存入数据库...');
  for (let i = 0; i < chunkTexts.length; i++) {
    // 将每个文本块转换为向量
    const output = await embedder(chunkTexts[i], {
      pooling: 'mean',
      normalize: true,
    });
    const vector = Array.from(output.data);

    // 将向量和文本块存入索引
    await index.insertItem({
      vector,
      metadata: { text: chunkTexts[i], id: i },
    });
  }
  console.log('✅ 文档索引完成！\n');
}