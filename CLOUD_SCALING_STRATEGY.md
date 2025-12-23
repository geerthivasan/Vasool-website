
# Vasool: Cloud Scaling Strategy

This document outlines the transition from a local Docker environment to a production-grade cloud infrastructure on AWS or GCP.

## 1. Database Migration
- **Local:** Dockerized PostgreSQL 15.
- **Production (AWS):** Migrating to **AWS Aurora Serverless v2 (PostgreSQL)**. 
- **Benefits:** Auto-scaling compute, managed backups, multi-AZ high availability.
- **Migration Tool:** AWS Database Migration Service (DMS).

## 2. Backend Scalability
- **Local:** FastAPI running in a Python container.
- **Production (AWS):** Two options:
    - **AWS Lambda:** Wrap FastAPI with `Mangum`. Highly cost-effective for variable SME traffic.
    - **AWS App Runner / ECS Fargate:** Best for consistent, high-volume traffic. 
- **Security:** Logic remains in `app/core/security.py`, but JWT secrets move to **AWS Secrets Manager**.

## 3. Frontend Hosting
- **Local:** Vite dev server.
- **Production:** 
    - Build static assets (`npm run build`).
    - Deploy to **AWS S3** bucket configured for static website hosting.
    - Front with **AWS CloudFront** (CDN) for global low-latency and SSL (ACM).

## 4. AI & Serverless Workers
- **AI Insights:** Continue using Gemini API via environment variables.
- **Background Tasks:** Use **AWS SQS** for invoice follow-up queues and **AWS Lambda** for processing WhatsApp/Email notifications.

## 5. CI/CD Recommendations
- **GitHub Actions:** 
    - Stage 1: Lint & Unit Tests (`pytest`, `vitest`).
    - Stage 2: Build Docker Images & Push to AWS ECR.
    - Stage 3: Terraform Apply for infra changes.
    - Stage 4: Deploy to App Runner / Lambda.
