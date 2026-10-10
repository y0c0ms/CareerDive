# Frases Populares

"Frases Populares" is a full-stack web application that displays a collection of popular and cultural Portuguese phrases. Users can browse the phrases, vote on their favorites, and authenticated users can submit new phrases for admin approval.

The application is built with a Django backend serving a REST API, and a React frontend for a clean and interactive user experience.

## Project Structure

The project is organized into two main directories: `backend` for the Django application and `frontend` for the React application.

```
/
├── backend/            # Django project
│   ├── frases_project/ # Django project settings
│   ├── frases_app/     # Django app for phrases
│   ├── venv/           # Virtual environment
│   └── manage.py
│
├── frontend/           # React project
│   ├── public/
│   ├── src/
│   ├── node_modules/
│   └── package.json
│
├── .gitignore          # Files to be ignored by Git
├── frases.txt          # Initial phrases for seeding the database
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 14+ and npm

### Local Development Setup

**1. Backend Setup**

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/Scripts/activate  # On Windows
# source venv/bin/activate    # On macOS/Linux

# Install dependencies
pip install -r requirements.txt # Note: You'll need to create this file

# Apply database migrations
python manage.py migrate

# Seed the database with initial phrases
python manage.py seed_phrases

# Run the backend server
python manage.py runserver
```

**2. Frontend Setup**

```bash
# Navigate to the frontend directory in a new terminal
cd frontend

# Install dependencies
npm install

# Run the frontend development server
npm start
```
The application will be available at `http://localhost:3000`.

## Deployment

### Backend Deployment (on a VPS with Nginx and Gunicorn)

1.  **Configure Django for Production:**
    -   In `backend/frases_project/settings.py`, set `DEBUG = False`.
    -   Configure `ALLOWED_HOSTS` with your domain name.
    -   Set up a production-ready database like PostgreSQL.

2.  **Install Gunicorn:**
    ```bash
    pip install gunicorn
    ```

3.  **Configure Gunicorn:**
    -   Run the Django app using Gunicorn:
        ```bash
        gunicorn --bind 0.0.0.0:8000 frases_project.wsgi
        ```
    -   It's recommended to run Gunicorn as a systemd service for process management.

4.  **Configure Nginx:**
    -   Set up Nginx as a reverse proxy to forward requests to Gunicorn.
    -   Configure Nginx to serve static files (`/static/`) and media files.

### Frontend Deployment

1.  **Create a Production Build:**
    ```bash
    cd frontend
    npm run build
    ```
    This will create a `build` directory with optimized static files.

2.  **Serve the Frontend:**
    -   Configure Nginx (or any web server) to serve the contents of the `frontend/build` directory.
    -   Set up a proxy to forward API requests (e.g., `/api/*`) to the backend server.
