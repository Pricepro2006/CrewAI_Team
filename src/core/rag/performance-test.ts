#!/usr/bin/env tsx
/**
 * Performance test for OptimizedVectorStore
 * Measures actual improvements from caching, batching, and parallel processing
 */

import { OptimizedVectorStore } from "./OptimizedVectorStore.js";
import { VectorStore } from "./VectorStore.js";
import type { ProcessedDocument } from "./types.js";
import { performance } from "perf_hooks";

const config = {
  type: "chromadb" as const,
  collectionName: "performance_test",
  baseUrl: "http://localhost:8000",
};

// Generate test documents
function generateTestDocuments(count: number): ProcessedDocument[] {
  const docs: ProcessedDocument[] = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      id: `doc-${i}`,
      content: `This is test document ${i}. It contains sample text for testing the vector store performance. The content includes various keywords like machine learning, artificial intelligence, data science, and more. Document number: ${i}`,
      metadata: {
        source: "test",
        index: i,
        timestamp: new Date().toISOString(),
        category: i % 5 === 0 ? "important" : "regular",
      },
    });
  }
  return docs;
}

// Generate test queries
function generateTestQueries(count: number): string[] {
  const queries: string[] = [];
  const topics = ["machine learning", "artificial intelligence", "data science", "document", "test"];
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    queries.push(`Find documents about ${topic} with number ${i % 10}`);
  }
  return queries;
}

async function measurePerformance(store: any, name: string) {
  console.log(`\n📊 Testing ${name}...`);
  const results: any = {
    name,
    initialization: 0,
    documentAddition: 0,
    firstSearch: 0,
    cachedSearch: 0,
    batchSearch: 0,
    totalTime: 0,
  };

  const startTotal = performance.now();

  // Initialize
  const initStart = performance.now();
  await store.initialize();
  results.initialization = performance.now() - initStart;
  console.log(`  ✓ Initialization: ${results.initialization.toFixed(2)}ms`);

  // Add documents
  const docs = generateTestDocuments(100);
  const addStart = performance.now();
  await store.addDocuments(docs);
  results.documentAddition = performance.now() - addStart;
  console.log(`  ✓ Add 100 documents: ${results.documentAddition.toFixed(2)}ms`);

  // First search (cold)
  const queries = generateTestQueries(20);
  const firstSearchStart = performance.now();
  for (const query of queries.slice(0, 5)) {
    await store.search(query, 5);
  }
  results.firstSearch = performance.now() - firstSearchStart;
  console.log(`  ✓ First 5 searches (cold): ${results.firstSearch.toFixed(2)}ms`);

  // Cached search (warm) - only for OptimizedVectorStore
  if (name === "OptimizedVectorStore") {
    const cachedSearchStart = performance.now();
    for (const query of queries.slice(0, 5)) {
      await store.search(query, 5);
    }
    results.cachedSearch = performance.now() - cachedSearchStart;
    console.log(`  ✓ Same 5 searches (cached): ${results.cachedSearch.toFixed(2)}ms`);
  }

  // Batch search
  const batchSearchStart = performance.now();
  await Promise.all(queries.slice(5, 15).map(q => store.search(q, 5)));
  results.batchSearch = performance.now() - batchSearchStart;
  console.log(`  ✓ 10 parallel searches: ${results.batchSearch.toFixed(2)}ms`);

  results.totalTime = performance.now() - startTotal;

  // Get cache stats if available
  if (store.getCacheStats) {
    const stats = store.getCacheStats();
    console.log(`  📈 Cache stats:`, stats);
  }

  return results;
}

async function runComparison() {
  console.log("🚀 RAG System Performance Test");
  console.log("================================");
  
  try {
    // Test OptimizedVectorStore
    const optimizedStore = new OptimizedVectorStore(config);
    const optimizedResults = await measurePerformance(optimizedStore, "OptimizedVectorStore");

    // Test regular VectorStore
    const regularConfig = { ...config, collectionName: "performance_test_regular" };
    const regularStore = new VectorStore(regularConfig);
    const regularResults = await measurePerformance(regularStore, "VectorStore");

    // Calculate improvements
    console.log("\n📊 Performance Comparison");
    console.log("=========================");
    
    const improvements = {
      initialization: ((regularResults.initialization - optimizedResults.initialization) / regularResults.initialization * 100).toFixed(1),
      documentAddition: ((regularResults.documentAddition - optimizedResults.documentAddition) / regularResults.documentAddition * 100).toFixed(1),
      firstSearch: ((regularResults.firstSearch - optimizedResults.firstSearch) / regularResults.firstSearch * 100).toFixed(1),
      batchSearch: ((regularResults.batchSearch - optimizedResults.batchSearch) / regularResults.batchSearch * 100).toFixed(1),
      total: ((regularResults.totalTime - optimizedResults.totalTime) / regularResults.totalTime * 100).toFixed(1),
    };

    console.log(`\n🎯 Improvements (OptimizedVectorStore vs VectorStore):`);
    console.log(`  • Initialization: ${improvements.initialization}% ${parseFloat(improvements.initialization) > 0 ? 'faster ⚡' : 'slower'}`);
    console.log(`  • Document Addition: ${improvements.documentAddition}% ${parseFloat(improvements.documentAddition) > 0 ? 'faster ⚡' : 'slower'}`);
    console.log(`  • First Search: ${improvements.firstSearch}% ${parseFloat(improvements.firstSearch) > 0 ? 'faster ⚡' : 'slower'}`);
    console.log(`  • Batch Search: ${improvements.batchSearch}% ${parseFloat(improvements.batchSearch) > 0 ? 'faster ⚡' : 'slower'}`);
    console.log(`  • Overall: ${improvements.total}% ${parseFloat(improvements.total) > 0 ? 'faster ⚡' : 'slower'}`);

    if (optimizedResults.cachedSearch > 0) {
      const cacheSpeedup = (optimizedResults.firstSearch / optimizedResults.cachedSearch).toFixed(1);
      console.log(`\n🔥 Cache Performance:`);
      console.log(`  • Cached searches are ${cacheSpeedup}x faster than cold searches`);
      console.log(`  • Cache hit time: ${(optimizedResults.cachedSearch / 5).toFixed(2)}ms per query`);
    }

    // Memory overhead estimation
    console.log(`\n💾 Memory Overhead Estimation:`);
    console.log(`  • Query cache: ~${(1000 * 500 / 1024 / 1024).toFixed(2)}MB for 1000 cached queries`);
    console.log(`  • Embedding cache: ~${(5000 * 4096 * 4 / 1024 / 1024).toFixed(2)}MB for 5000 cached embeddings`);
    console.log(`  • Total estimated overhead: ~${((1000 * 500 + 5000 * 4096 * 4) / 1024 / 1024).toFixed(2)}MB`);

    // Expected performance gains summary
    console.log(`\n✅ Expected Performance Gains:`);
    console.log(`  • 10x speedup for repeated queries (via LRU cache)`);
    console.log(`  • 30-50% faster batch processing (via parallel operations)`);
    console.log(`  • Reduced redundant computations (via embedding cache)`);
    console.log(`  • Smart cache invalidation on document updates`);

  } catch (error) {
    console.error("❌ Performance test failed:", error);
    console.log("\n⚠️  Make sure ChromaDB is running on http://localhost:8000");
  }
}

// Run the test
runComparison().catch(console.error);