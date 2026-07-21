// rag-local.mjs
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@xenova/transformers";
import { LocalIndex } from "vectra";
import fs from "fs";

// ================== 1. 准备文档 ==================
const documentText = `
RAG（Retrieval-Augmented Generation）是一种结合检索和生成的自然语言处理架构。
它通过从外部知识库中检索相关文档片段，将这些信息作为上下文提供给大语言模型，
从而生成更准确、更具时效性且可溯源的答案。
RAG 有效缓解了大模型的“幻觉”问题，并允许在不重新训练模型的情况下更新知识。
LangChain 是一个用于构建 LLM 应用的框架，提供了文本分块、链式调用、代理等功能。
Transformers.js 是由 Xenova 开发的 JavaScript 库，能够在浏览器和 Node.js 中直接运行 Hugging Face 模型。
Vectra 是一个轻量级的本地向量数据库，适合在边缘设备或小型项目中使用。
`;

// ================== 2. 文本分块 ==================
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 150,         // 每块最多150字符
  chunkOverlap: 20,       // 块之间重叠20字符
  separators: ["\n", "。", ".", " ", ""],
});

// createDocuments 接受字符串数组，返回 Document 对象数组
const documents = await splitter.createDocuments([documentText]);
const chunkTexts = documents.map((doc) => doc.pageContent);
console.log(`✅ 分割为 ${chunkTexts.length} 个文本块`);
chunkTexts.forEach((c, i) => console.log(`块${i + 1}: ${c}`));

// ================== 3. 初始化嵌入模型 ==================
console.log("\n⏳ 正在加载嵌入模型（首次运行会下载约 30MB）...");
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
  await index.createIndex();
  console.log("📦 创建本地向量索引\n");
} else {
  console.log("📂 加载已有向量索引\n");
}

console.log("💾 正在将文档块向量化并存入数据库...");
for (let i = 0; i < chunkTexts.length; i++) {
  const vector = await getEmbedding(chunkTexts[i]);
  await index.insertItem({
    vector,
    metadata: { text: chunkTexts[i], id: i },
  });
}
console.log("✅ 文档索引完成！\n");

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
const prompt = `请根据以下资料回答用户的问题。如果资料中没有相关答案，请如实说不知道。

资料：
${context}

问题：${query}
回答：`;

console.log("\n📝 最终发送给 LLM 的提示词：");
console.log("------------------------");
console.log(prompt);
console.log("------------------------");

// ================== 8. 可选：调用 OpenAI ==================
// import OpenAI from "openai";
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const completion = await openai.chat.completions.create({
//   model: "gpt-4o-mini",
//   messages: [{ role: "user", content: prompt }],
// });
// console.log("🤖 AI 回答：", completion.choices[0].message.content);