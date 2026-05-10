const fs = require('fs');
const path = require('path');
const { pipeline, cos_sim } = require('@xenova/transformers');
const natural = require('natural');
const englishWords = require('an-array-of-english-words');

class NLPEngine {
  constructor() {
    this.extractor = null;
    this.wordStemmer = natural.PorterStemmer;
    this.vocabulary = [];
    this.dictionary = new Set(englishWords);
    this.targetRankings = {}; // { word: { rankings: { 'apple': 1 }, list: [ {word, sim} ] } }
  }

  async init() {
    console.log('Loading transformer model...');
    this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    console.log('Loading vocabulary...');
    try {
      const text = fs.readFileSync(path.join(__dirname, 'data', '10k.txt'), 'utf-8');
      this.vocabulary = text.split('\n').map(w => w.trim()).filter(w => w.length > 2).slice(0, 5000); // Top 5000 for performance
      // Ensure the vocabulary words are in the dictionary set for quick validation
      this.vocabulary.forEach(w => this.dictionary.add(w));
    } catch (e) {
      console.log('Could not load 10k.txt, using fallback vocab.');
      this.vocabulary = ['apple', 'banana', 'car', 'dog', 'cat', 'house', 'tree'];
    }
    
    console.log(`NLP Engine Initialized with ${this.vocabulary.length} core words.`);
  }

  normalizeWord(word) {
    return word.toLowerCase().trim();
  }

  isWordInDictionary(word) {
    // Check if the normalized word exists in our large dictionary
    return this.dictionary.has(word);
  }

  async computeEmbedding(word) {
    const output = await this.extractor(word, { pooling: 'mean', normalize: true });
    return output.data;
  }

  // Pre-calculate rankings for a target word
  async precalculateTarget(targetWord) {
    if (this.targetRankings[targetWord]) return; // Already done
    
    console.log(`Precalculating rankings for target: ${targetWord}...`);
    const targetEmb = await this.computeEmbedding(targetWord);
    
    // Add target word to words to compare
    const wordsToCompare = new Set([...this.vocabulary, targetWord]);
    
    // Instead of doing 5000 inference calls sequentially which takes forever,
    // we do them in batches or concurrently.
    const distances = [];
    
    // In a real production environment, embeddings for the 5k words would be precalculated
    // and loaded from JSON. Here we dynamically calculate them but it might be slow.
    for (const w of wordsToCompare) {
      const wEmb = await this.computeEmbedding(w);
      const similarity = cos_sim(targetEmb, wEmb);
      distances.push({ word: w, similarity });
    }

    distances.sort((a, b) => b.similarity - a.similarity);

    const rankings = {};
    distances.forEach((item, index) => {
      rankings[item.word] = index + 1;
    });

    this.targetRankings[targetWord] = { rankings, list: distances };
    console.log(`Precalculation complete for: ${targetWord}`);
  }

  async getRank(guessWord, targetWord) {
    if (!this.targetRankings[targetWord]) {
      await this.precalculateTarget(targetWord);
    }

    const { rankings, list } = this.targetRankings[targetWord];
    
    if (rankings[guessWord]) {
      return rankings[guessWord];
    }

    // New word not in core vocabulary
    const guessEmb = await this.computeEmbedding(guessWord);
    const targetEmb = await this.computeEmbedding(targetWord);
    const similarity = cos_sim(guessEmb, targetEmb);

    // Find insertion index in sorted list
    let approxRank = 1;
    for (let i = 0; i < list.length; i++) {
      if (similarity > list[i].similarity) {
        break;
      }
      approxRank++;
    }
    
    return approxRank;
  }
}

module.exports = new NLPEngine();
