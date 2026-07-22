import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const RCTS = new RecursiveCharacterTextSplitter({
  chunkSize: 150,         // 每块最多150字符
  chunkOverlap: 20,       // 块之间重叠20字符
  separators: ['\n', '。', '.', ' ', ''],
});

export default async function splitter(documentText) {
  // createDocuments 接受字符串数组，返回 Document 对象数组
  const documents = await RCTS.createDocuments([documentText]);
  const chunkTexts = documents.map((doc) => doc.pageContent);

  console.log(`✅ 分割为 ${chunkTexts.length} 个文本块`);
  chunkTexts.forEach((c, i) => console.log(`块${i + 1}: ${c}`));

  return chunkTexts;
}