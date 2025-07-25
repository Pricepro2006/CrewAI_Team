#!/usr/bin/env tsx

console.log("1. Script starting");

// Minimal Stage3 class without any imports
class MinimalStage3 {
  constructor() {
    console.log("MinimalStage3 constructor called");
  }

  async process(emails: any[]): Promise<any[]> {
    console.log("MinimalStage3.process called with", emails.length, "emails");
    return [];
  }
}

console.log("2. Creating MinimalStage3 instance");
const stage3 = new MinimalStage3();

console.log("3. Calling process");
stage3
  .process([{ id: "test" }])
  .then((results) => {
    console.log("4. Process completed:", results);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
