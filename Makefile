.PHONY: up down logs test backend frontend lint

up:            ## Build and run everything with Docker (http://localhost:8080)
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend

test:          ## Backend unit tests (no Mongo or API key needed)
	cd backend && python -m pytest

backend:       ## Run the API locally (needs Mongo on localhost:27017 and backend/.env)
	cd backend && python run.py

frontend:      ## Run the Vite dev server with hot reload
	cd frontend && npm run dev

lint:
	cd frontend && npm run lint
