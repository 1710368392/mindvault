// @ts-nocheck
/**
 * RAG Embedding 服务 - 多模型支持
 * 优先级：DeepSeek → OpenAI → 关键词匹配（兜底）
 */

// Embedding 模型配置
const EMBEDDING_MODELS = {
  deepseek: {
    name: 'deepseek-embedding',
    url: 'https://api.deepseek.com/v1/embeddings',
    dimension: 1536,
    maxTokens: 8191,
  },
  openai: {
    name: 'text-embedding-3-small',
    url: 'https://api.openai.com/v1/embeddings',
    dimension: 1536,
    maxTokens: 8191,
  },
};

/**
 * 从 DeepSeek 获取 Embedding
 */
async function getEmbeddingFromDeepSeek(text, apiKey) {
  const response = await fetch('https://api.deepseek.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-embedding',
      input: text.substring(0, EMBEDDING_MODELS.deepseek.maxTokens),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek Embedding API 失败: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * 从 OpenAI 获取 Embedding
 */
async function getEmbeddingFromOpenAI(text, apiKey, baseUrl) {
  const fetchUrl = (baseUrl || 'https://api.openai.com/v1') + '/embeddings';
  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, EMBEDDING_MODELS.openai.maxTokens),
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Embedding API 失败: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * 获取 Embedding（优先 DeepSeek，备选 OpenAI，兜底关键词）
 * @param {string} text - 要向量化的文本
 * @param {object} config - AI 配置
 * @returns {Promise<{embedding: number[]|null, model: string, dimension: number}>}
 */
async function getEmbedding(text, config) {
  // 1. 优先尝试 DeepSeek
  if (config?.deepseekApiKey) {
    try {
      console.log('[RAG-Embedding] 尝试使用 DeepSeek Embedding...');
      const embedding = await getEmbeddingFromDeepSeek(text, config.deepseekApiKey);
      console.log('[RAG-Embedding] DeepSeek Embedding 成功，维度:', embedding.length);
      return { 
        embedding, 
        model: 'deepseek',
        dimension: EMBEDDING_MODELS.deepseek.dimension 
      };
    } catch (err) {
      console.warn('[RAG-Embedding] DeepSeek Embedding 失败:', err.message);
    }
  }

  // 2. 尝试 OpenAI（支持自定义 baseUrl）
  if (config?.openaiApiKey || config?.apiKey) {
    try {
      console.log('[RAG-Embedding] 尝试使用 OpenAI Embedding...');
      const apiKey = config.openaiApiKey || config.apiKey;
      const baseUrl = config.openaiBaseUrl || config.baseUrl;
      const embedding = await getEmbeddingFromOpenAI(text, apiKey, baseUrl);
      console.log('[RAG-Embedding] OpenAI Embedding 成功，维度:', embedding.length);
      return { 
        embedding, 
        model: 'openai',
        dimension: EMBEDDING_MODELS.openai.dimension 
      };
    } catch (err) {
      console.warn('[RAG-Embedding] OpenAI Embedding 失败:', err.message);
    }
  }

  // 3. 无可用 API，返回 null（使用关键词匹配）
  console.log('[RAG-Embedding] 无可用 Embedding API，将使用关键词匹配');
  return { 
    embedding: null, 
    model: 'keyword',
    dimension: 0 
  };
}

/**
 * 批量获取 Embedding
 * @param {string[]} texts - 文本数组
 * @param {object} config - AI 配置
 * @returns {Promise<Array<{embedding: number[]|null, model: string}>>}
 */
async function getBatchEmbeddings(texts, config) {
  const results = [];
  
  for (const text of texts) {
    const result = await getEmbedding(text, config);
    results.push(result);
    
    // 避免请求过快
    if (result.model !== 'keyword') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 关键词匹配分数
 */
function keywordMatchScore(query, text) {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
  const textLower = text.toLowerCase();
  
  let matchCount = 0;
  for (const kw of keywords) {
    if (textLower.includes(kw)) matchCount++;
  }
  
  return keywords.length > 0 ? matchCount / keywords.length : 0;
}

/**
 * 获取当前可用的 Embedding 模型信息
 */
function getAvailableModel(config) {
  if (config?.deepseekApiKey) {
    return { 
      name: 'DeepSeek Embedding', 
      key: 'deepseek',
      dimension: EMBEDDING_MODELS.deepseek.dimension 
    };
  }
  
  if (config?.openaiApiKey || config?.apiKey) {
    return { 
      name: 'OpenAI text-embedding-3-small', 
      key: 'openai',
      dimension: EMBEDDING_MODELS.openai.dimension 
    };
  }
  
  return { 
    name: '关键词匹配', 
    key: 'keyword',
    dimension: 0 
  };
}

module.exports = {
  getEmbedding,
  getBatchEmbeddings,
  cosineSimilarity,
  keywordMatchScore,
  getAvailableModel,
  EMBEDDING_MODELS,
};
