
# Vasool - SME Cashflow Intelligence

Vasool is an AI-powered receivables platform designed to help Indian SMEs recover outstanding payments faster.

## Features
- **Predictive Analytics:** Gemini-powered payment probability forecasting.
- **Automated Follow-ups:** Structure follow-ups via WhatsApp and Email.
- **Dashboard:** Real-time visibility into cash inflows and overdue risks.
- **Hexagonal Architecture:** Decoupled logic for easy cloud migration.

## Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, TanStack Query.
- **Backend:** FastAPI (Python), SQLAlchemy Async.
- **DB:** PostgreSQL.
- **DevOps:** Docker, strategy-pattern payments.

## Quick Start
1. Add your Gemini API Key to environment: `export API_KEY=your_key`
2. Run with Docker:
   ```bash
   docker-compose up --build
   ```
3. Access Frontend: `http://localhost:3000`
4. Access Backend Docs: `http://localhost:8000/docs`

## Local Development (Frontend)
```bash
npm install
npm run dev
```
