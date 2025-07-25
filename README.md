# CrewAI Team Framework

A modern TypeScript framework for building AI-powered agent teams with enterprise-grade features.

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-20.11-green)
![SQLite](https://img.shields.io/badge/SQLite-3.44-003B57)
![Docker](https://img.shields.io/badge/Docker-24.0-2496ed)
![Build](https://img.shields.io/badge/Build-Passing-success)
![Tests](https://img.shields.io/badge/Tests-Passing-success)

## Features

- **Multi-Agent Architecture**: Build teams of specialized AI agents that work together
- **Tool Integration**: Extensible tool system for agent capabilities
- **Email Intelligence**: Advanced email processing and analysis pipeline
- **Enterprise Ready**: Production-grade security, monitoring, and scalability
- **TypeScript First**: Full type safety and modern development experience

## Tech Stack

- **Frontend**: React 18, Next.js, TailwindCSS
- **Backend**: Node.js, Express, tRPC
- **Database**: SQLite with Prisma ORM
- **AI Integration**: Ollama, ChromaDB, LangChain
- **Testing**: Jest, Vitest, Playwright
- **Infrastructure**: Docker, Redis, BullMQ

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Redis (for queue management)
- Ollama (for local LLM)

### Installation

```bash
# Clone the repository
git clone https://github.com/Pricepro2006/CrewAI_Team.git
cd CrewAI_Team

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development services
docker-compose up -d

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Quick Start

```typescript
import { Agent, Team, Tool } from '@crewai/core';

// Define a specialized agent
const researchAgent = new Agent({
  name: 'Researcher',
  role: 'Information gatherer',
  tools: [new WebSearchTool(), new SummarizerTool()],
});

// Create a team
const team = new Team({
  agents: [researchAgent],
  workflow: 'sequential',
});

// Execute a task
const result = await team.execute({
  objective: 'Research latest AI trends',
});
```

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Reference](./docs/api/README.md)
- [Agent Development Guide](./docs/guides/agents.md)
- [Tool Creation Guide](./docs/guides/tools.md)

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Building for Production

```bash
# Build the application
npm run build

# Run production build
npm run start

# Docker deployment
docker build -t crewai-team .
docker run -p 3000:3000 crewai-team
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://github.com/Pricepro2006/CrewAI_Team/wiki)
- 🐛 [Issue Tracker](https://github.com/Pricepro2006/CrewAI_Team/issues)
- 💬 [Discussions](https://github.com/Pricepro2006/CrewAI_Team/discussions)

## Acknowledgments

Built with ❤️ using modern AI and web technologies.