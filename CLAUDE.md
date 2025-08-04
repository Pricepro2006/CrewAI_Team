# CrewAI Team - Claude Development Instructions

## ALWAYS TELL THE TRUTH ABOUT THE WORK DONE COMPARED TO THE REQUEST ASKED

## Project Overview

CrewAI Team is a production-ready enterprise AI agent framework featuring an adaptive three-phase email analysis system that intelligently processes email chains based on completeness for maximum workflow intelligence extraction.

**Current Status:** ✅ Production Ready with Adaptive Analysis  
**Version:** v2.2.0  
**Last Updated:** August 2, 2025  
**Branch:** fix/critical-email-processing-issues

### Email Pipeline Architecture

The email processing pipeline supports three operational modes:

1. **Manual Load Mode** - Batch import from JSON files or databases
2. **Auto-Pull Mode** - Scheduled pulling from Microsoft Graph/Gmail APIs
3. **Hybrid Mode** - Concurrent manual and auto operations

**Key Features:**

- Adaptive 3-phase analysis (Rule-based → Llama 3.2 → Phi-4)
- Chain completeness scoring for workflow detection
- Real-time UI updates via WebSocket
- Priority queue management
- 60+ emails/minute processing capability
- Unified model approach: Llama 3.2:3b for both LLM and embeddings

See `/docs/EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md` for full details.

[... rest of existing content remains unchanged ...]

## Research and Tool Integration Memories

- Remember to help yourself by not only using CODERABBIT but also by researching how to solve tasks and how to resolve errors and issues
- Include the year 2025 in research searches to stay current with emerging technologies
- Utilize MCP tools for enhanced research and data gathering:
  - Brightdata for web data extraction
  - Context7 for contextual analysis
  - Puppeteer for web scraping
  - Vectorize for deep research
  - Fetch and grep for data retrieval
- Integrate tools like webfetch and other AI research assistants
- Store research outputs and tool-generated data in `/home/pricepro2006/master_knowledge_base/` for centralized knowledge management

[... rest of existing content remains unchanged ...]
