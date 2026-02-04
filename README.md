# FinancIAs 💰

Personal finance manager with intelligent transaction categorization, built with Django + React.

![Dashboard](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue)
![Backend](https://img.shields.io/badge/Backend-Django%20%2B%20DRF-green)
![License](https://img.shields.io/badge/License-Private-red)

## Features

- 📊 **Interactive Dashboard** - Balance evolution with stock-style charts, monthly income vs expenses
- 🏷️ **Smart Categorization** - Auto-categorizes transactions based on learned patterns
- 📁 **Excel Import** - Drag & drop bank statements (.xls/.xlsx), auto-detects headers
- 🔍 **Advanced Filters** - Filter by month, type, category; sort by any column
- 📈 **Analytics** - Track your financial evolution over time
- 🔐 **JWT Authentication** - Secure login system

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Django 6.0, Django REST Framework |
| Frontend | React 18, TypeScript, Vite |
| Styling | TailwindCSS 3, Glassmorphism design |
| Charts | Recharts |
| Auth | JWT (SimpleJWT) |
| Database | SQLite (dev) |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 20+
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/Finances.git
cd Finances

# Backend setup
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py createsuperuser
cd ..

# Frontend setup
cd frontend
npm install
cd ..
```

### Running

```bash
# Terminal 1 - Backend
cd backend
python manage.py runserver

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- **Frontend**: http://localhost:5173
- **Admin**: http://localhost:8000/admin

## Project Structure

```
Finances/
├── backend/
│   ├── api/              # REST API (models, views, services)
│   ├── backend/          # Django settings
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Dashboard, Transactions, Import, Analytics
│   │   └── services/     # API client
│   └── package.json
├── uploads/              # Excel files for import (gitignored)
└── test/                 # Development scripts (gitignored)
```

## Usage

1. **Import data**: Go to Import → Drag your bank Excel file
2. **Categorize**: Transactions → Click on uncategorized items to assign categories
3. **Monitor**: Dashboard shows your financial summary with filters
4. **Analyze**: Analytics shows balance evolution over time

## Auto-Categorization

The system learns from your categorizations:
- When you assign a category, it creates rules based on keywords
- Future imports automatically apply these rules
- Existing transactions are never modified (already validated)

## Author

Carlos Ivars

---
*Built with 💙 and a lot of ☕*