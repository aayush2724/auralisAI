.PHONY: test lint format docker-up docker-down

test:
	cd server && pytest tests/ -v --tb=short --cov=src --cov-report=term-missing --cov-report=html:htmlcov

lint:
	cd server && ruff check src/ tests/
	cd server && black --check src/ tests/

format:
	cd server && ruff check --fix src/ tests/
	cd server && black src/ tests/

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down -v
