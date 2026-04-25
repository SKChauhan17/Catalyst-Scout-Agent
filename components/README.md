# UI Components & Design System

<p align="center">
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-141413?style=for-the-badge&labelColor=141413&color=e8e6dc" alt="Tailwind">
</p>

## Overview
The Catalyst Scout UI is a high-density "Mission Control" dashboard designed for speed and clarity. It emphasizes **Explainable AI** by showing exactly what the agent is thinking in real-time.

## Key Components

### 🖥️ Agent Terminal (`AgentTerminal.tsx`)
A high-performance terminal emulator that:
- Connects to Supabase Realtime Broadcasts for sub-second updates.
- Recovers historical logs from the database on refresh.
- Auto-scrolls to follow the agent's progress.

### 👤 Candidate Card (`CandidateCard.tsx`)
A rich data visualization component that displays:
- Final Score (weighted match vs interest).
- Technical skill match breakdown.
- **Explainability:** Full access to the 3-turn interview transcript and AI reasoning.

### 📤 BYOD Controller (`BYODController.tsx`)
A specialized interface for custom data ingestion:
- Support for CSV and JSON uploads.
- Manual entry forms for quick candidate additions.
- Persistence via the client-side Zustand store.

## Design Philosophy
- **Glassmorphism:** Subtle transparency and blur effects for a premium "floating" feel.
- **Micro-animations:** Framer Motion powered transitions for state changes.
- **Dark Mode First:** Tailored for technical power users.
