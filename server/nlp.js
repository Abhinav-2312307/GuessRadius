const fs = require('fs');
const path = require('path');

function cos_sim(A, B) {
  let dotproduct = 0;
  let mA = 0;
  let mB = 0;
  for(let i = 0; i < A.length; i++){
      dotproduct += (A[i] * B[i]);
      mA += (A[i]*A[i]);
      mB += (B[i]*B[i]);
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return (dotproduct)/((mA)*(mB));
}

class NLPEngine {
  constructor() {
    this.embeddings = null;
    this.vocab = null;
    this.targetRankings = {};
  }

  async init() {
    console.log("Loading GloVe Word2Vec JSON...");
    try {
      const dataPath = path.join(__dirname, 'data', 'glove.json');
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      this.vocab = data.vocab;
      this.embeddings = data.embeddings;
      console.log(`NLP Engine Initialized with ${this.vocab.length} core semantic words.`);
    } catch (err) {
      console.error("CRITICAL: Failed to load glove.json. Please ensure it was downloaded.", err);
    }
  }

  normalizeWord(word) {
    return word.toLowerCase().trim();
  }

  isWordInDictionary(word) {
    if (!this.embeddings) return false;
    const w = this.normalizeWord(word);
    return this.embeddings[w] !== undefined;
  }

  async precalculateTarget(targetWord) {
    const targetEmb = this.embeddings[targetWord];
    if (!targetEmb) return;

    let distances = [];
    for (const w of this.vocab) {
      const wEmb = this.embeddings[w];
      const similarity = cos_sim(targetEmb, wEmb);
      distances.push({ word: w, similarity });
    }

    // Sort by similarity descending
    distances.sort((a, b) => b.similarity - a.similarity);

    // Create O(1) lookup dictionary for rankings
    let rankings = {};
    for (let i = 0; i < distances.length; i++) {
      rankings[distances[i].word] = i + 1;
    }

    this.targetRankings[targetWord] = {
      list: distances,
      rankings: rankings
    };
  }

  async getRank(guessWord, targetWord) {
    if (!this.targetRankings[targetWord]) {
      await this.precalculateTarget(targetWord);
    }
    
    const { rankings } = this.targetRankings[targetWord];
    
    // Because we only allow guesses that are inside this.embeddings,
    // and we precalculated ALL vocab words, it MUST be inside rankings.
    return rankings[guessWord];
  }

  getTopWords(targetWord, count = 1000) {
    if (!this.targetRankings[targetWord]) return [];
    return this.targetRankings[targetWord].list.slice(0, count).map((item, index) => ({
      word: item.word,
      rank: index + 1
    }));
  }
}

module.exports = new NLPEngine();
