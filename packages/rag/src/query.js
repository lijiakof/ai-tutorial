import { pipeline } from "@xenova/transformers";
import { LocalIndex } from "vectra";
import fs from "fs";

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

// 文本转向量工具函数
async function getEmbedding(text) {
  const output = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

const index = new LocalIndex("../rag-index");
if (!fs.existsSync("../rag-index")) {
  console.log("本地向量库不存在");
}

const query = "什么是 RAG？";

// 召回（Recall）
const queryVector = await getEmbedding(query);
const results = await index.queryItems(queryVector, "", 10); // 取前10个最相似的块
const contextSnippets = results.map((r) => r.item.metadata.text);
console.log("🔍 检索到的相关片段：");
contextSnippets.forEach((s, i) => console.log(`   [片段${i + 1}] ${s}`));

// TODO：重排（Rerank）

const context = contextSnippets.join("\n");