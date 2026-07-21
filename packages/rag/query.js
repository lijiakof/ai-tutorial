
import { pipeline } from "@xenova/transformers";
import { LocalIndex } from "vectra";
import fs from "fs";

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

// 文本转向量工具函数
async function getEmbedding(text) {
  const output = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

// ================== 4. 创建 vectra 索引并存储 ==================
const index = new LocalIndex("./rag-index");

// 如果索引目录不存在则创建，否则直接加载已有索引
if (!fs.existsSync("./rag-index")) {
  console.log("本地向量库不存在");
}

// ================== 5. 用户提问 ==================
const query = "什么是 RAG？";

// ================== 6. 检索相关片段 ==================
const queryVector = await getEmbedding(query);
const results = await index.queryItems(queryVector, "", 2); // 取前2个最相似的块
const contextSnippets = results.map((r) => r.item.metadata.text);
console.log("🔍 检索到的相关片段：");
contextSnippets.forEach((s, i) => console.log(`   [片段${i + 1}] ${s}`));

// ================== 7. 构造提示词（可接任意 LLM） ==================
const context = contextSnippets.join("\n");