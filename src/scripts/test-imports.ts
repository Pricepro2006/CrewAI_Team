#!/usr/bin/env tsx

console.log("1. Starting imports test");

console.log("2. Importing axios...");
import axios from "axios";
console.log("3. axios imported");

console.log("4. Importing logger...");
import { logger } from "../utils/logger";
console.log("5. logger imported");

console.log("6. Importing MODEL_CONFIG...");
import { MODEL_CONFIG } from "../config/models.config";
console.log("7. MODEL_CONFIG imported");

console.log("8. Importing types...");
import type {
  Email,
  CriticalAnalysisResult,
  CriticalAnalysisResults,
} from "../core/pipeline/types";
console.log("9. types imported");

console.log("All imports successful!");
process.exit(0);
