import fs from 'node:fs';
import {
  pipeline,
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from '@xenova/transformers';
import { LocalIndex } from 'vectra';

/**
 * 使用交叉编码器（cross-encoder）对检索结果进行重排序
 *
 * 注意：不能使用 pipeline('text-classification', ...)，因为它会对输出做 softmax，
 * 导致所有输入对都得到 score: 1，无法区分相关性。这里直接使用 AutoModel API 获取
 * 原始 logits，然后手动做 sigmoid 得到可用于排序的相关性分数。
 *
 * @param {string} queryText - 用户查询文本
 * @param {string[]} snippets - 召回的文本片段
 * @param {number} [topN] - 返回前N个结果，默认返回全部
 * @returns {Promise<string[]>} 按相关性重新排序后的文本片段
 */
async function rerank(queryText, snippets, topN) {
  // 边界情况：空数组或单条结果无需重排
  if (!snippets || snippets.length <= 1) {
    return snippets || [];
  }

  const modelName = 'Xenova/bge-reranker-base';

  console.log(`⏳ 正在加载重排模型（${modelName}，首次运行会下载模型文件）...`);

  let tokenizer, model;
  try {
    tokenizer = await AutoTokenizer.from_pretrained(modelName);
    model = await AutoModelForSequenceClassification.from_pretrained(modelName, {
      quantized: true,
    });
  } catch (err) {
    console.warn('⚠️ 重排模型加载失败，使用原始向量检索排序:', err.message);
    return snippets;
  }

  console.log('⏳ 正在对检索到的片段进行重排...');

  // 构造输入对：query [SEP] document
  const pairs = snippets.map((doc) => `${queryText} [SEP] ${doc}`);

  // 批量分词
  const inputs = await tokenizer(pairs, {
    padding: true,
    truncation: true,
    max_length: 512,
  });

  // 批量推理，获取原始 logits
  const output = await model(inputs);
  const logits = Array.from(output.logits.data);

  // sigmoid 将 logits 映射到 [0, 1]，得到可解释的相关性分数
  const scores = logits.map((l) => 1 / (1 + Math.exp(-l)));

  // 配对、排序
  const ranked = snippets
    .map((text, i) => ({ text, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  console.log('✅ 重排完成！\n');

  const final = topN ? ranked.slice(0, topN) : ranked;
  return final.map((r) => r.text);
}

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
    pooling: 'mean',
    normalize: true,
  });
  const queryVector = Array.from(output.data);
  console.log('⏳ 正在召回相关片段...');
  const results = await index.queryItems(queryVector, '', 10); // 取前10个最相似的块
  const contextSnippets = results.map((r) => r.item.metadata.text);
  console.log('🔍 检索到的相关片段：');
  contextSnippets.forEach((s, i) => console.log(`   [片段${i + 1}] ${s}`));

  // 重排（Rerank）
  const rerankedSnippets = await rerank(text, contextSnippets);

  return rerankedSnippets;
}
