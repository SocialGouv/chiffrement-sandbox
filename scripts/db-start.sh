#!/usr/bin/env bash

export COMPOSE_PROJECT_NAME=e2esdk-dev
export COMPOSE_FILE=$(dirname $0)/../docker-compose.yml

# Start services
docker compose run --rm wait || exit 1

RETRIES=10

until docker exec -it e2esdk-dev-db-1 psql --user=postgres -c "select 1" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for postgres server, $((RETRIES--)) remaining attempts..."
  sleep 1
done
