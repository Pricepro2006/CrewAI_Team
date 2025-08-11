# GEMINI Analysis of the CrewAI Team Project

This document provides a high-level overview of the CrewAI Team project, its structure, and key commands. It is intended to be a quick reference for developers and future AI interactions.

## Project Overview

The CrewAI Team project is an enterprise-grade AI agent system built with a focus on email intelligence and business process automation. It features a sophisticated email processing pipeline and a specialized Walmart Grocery Agent.

The project is a full-stack application utilizing a modern technology stack:

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Node.js, Express, TypeScript, tRPC
*   **Database:** SQLite for primary data storage and ChromaDB for vector operations.
*   **AI/ML:** llama.cpp for local LLM inference.
*   **Job Queue:** Redis with BullMQ for background task management.
*   **Testing:** Vitest for unit and integration tests, and Playwright for end-to-end tests.

The architecture is designed to be modular and scalable, with the Walmart Grocery Agent implemented as a set of microservices. The email pipeline is designed as a three-phase analysis framework to provide adaptive email intelligence.

## Building and Running

### Prerequisites

*   Node.js (v20.11 or higher)
*   SQLite (v3.44 or higher)
*   Redis
*   llama.cpp

### Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Configuration:**
    *   Create a `.env` file by copying the `.env.example`.
    *   Update the `.env` file with your local configuration for databases, services, and other parameters.

### Key Commands

*   **Run development server:**
    ```bash
    npm run dev
    ```
    This command starts both the backend server and the frontend client concurrently.

*   **Build for production:**
    ```bash
    npm run build
    ```

*   **Run tests:**
    ```bash
    npm run test
    ```

*   **Lint files:**
    ```bash
    npm run lint
    ```

*   **Type-check files:**
    ```bash
    npm run typecheck
    ```

## Development Conventions

*   **Coding Style:** The project uses ESLint and Prettier to enforce a consistent coding style.
*   **Testing:**
    *   Unit and integration tests are written with Vitest.
    *   End-to-end tests are written with Playwright.
*   **Documentation:** The project contains extensive documentation in the `docs/` directory, covering architecture, API, database schema, and more.
*   **Contributing:** Contribution guidelines are available in `.github/CONTRIBUTING.md`.
