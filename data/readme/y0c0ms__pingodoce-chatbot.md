# Pingo Doce Chatbot

A RAG-based chatbot for Pingo Doce store information, built with React, n8n workflows, and ChromaDB vector database.

## Features

- 🔍 Semantic search for store information
- 🤖 Hybrid query improvement (rule-based + LLM)
- 📍 Location-based filtering
- 🐳 Docker containerization ready
- 🔄 n8n workflow integration
- 💾 ChromaDB vector database

## Quick Start

### After Cloning Repository

**Quick deployment (automated):**
```bash
cd /opt/pingodoceChatbot
chmod +x deploy.sh
./deploy.sh
```

**Manual deployment:**
See [POST_CLONE_DEPLOYMENT.md](POST_CLONE_DEPLOYMENT.md) for complete step-by-step instructions.

### Local Development

See [QUICK_START.md](QUICK_START.md) for local development setup.

### Homelab Deployment

- [POST_CLONE_DEPLOYMENT.md](POST_CLONE_DEPLOYMENT.md) - **Start here after cloning**
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment checklist
- [QUICK_START_HOMELAB.md](QUICK_START_HOMELAB.md) - Quick homelab reference
- [HOMELAB_SETUP.md](HOMELAB_SETUP.md) - Complete homelab setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide

## Architecture

- **Frontend**: React + Vite + TypeScript
- **Backend**: n8n workflows with Google LLM
- **Vector DB**: ChromaDB server mode
- **Containerization**: Docker for frontend

## Documentation

- [QUICK_START.md](QUICK_START.md) - Local development
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [MIGRATION.md](MIGRATION.md) - Migration from FastAPI to n8n
- [docs/n8n_setup.md](docs/n8n_setup.md) - n8n workflow setup
- [docs/chromadb_server.md](docs/chromadb_server.md) - ChromaDB server setup
- [GIT_REPOSITORY_SETUP.md](GIT_REPOSITORY_SETUP.md) - Git repository setup

## Technologies

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: n8n workflows, Google Gemini LLM
- **Vector DB**: ChromaDB
- **Containerization**: Docker, Nginx

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up ChromaDB server (see [docs/chromadb_server.md](docs/chromadb_server.md))
4. Configure n8n workflow (see [docs/n8n_setup.md](docs/n8n_setup.md))
5. Build and deploy frontend container

For detailed instructions, see the documentation files above.
