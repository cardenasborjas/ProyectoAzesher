#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR=/opt/proyecto-eve
BRANCH=master
LOCK_FILE=/run/lock/proyecto-eve-deploy.lock

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

cd "$APP_DIR"
git fetch --quiet origin "$BRANCH"

CURRENT_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(git rev-parse "origin/$BRANCH")"
if [[ "$CURRENT_COMMIT" == "$TARGET_COMMIT" && "${PROJECT_EVE_FORCE_DEPLOY:-0}" != "1" ]]; then
  exit 0
fi

if [[ "$CURRENT_COMMIT" != "$TARGET_COMMIT" ]]; then
  printf 'Desplegando %s -> %s\n' "$CURRENT_COMMIT" "$TARGET_COMMIT"
  git reset --hard "$TARGET_COMMIT"
  # Reinicia usando la versión recién descargada del propio script para que
  # las migraciones agregadas en el commit se ejecuten inmediatamente.
  exec env PROJECT_EVE_FORCE_DEPLOY=1 PROJECT_EVE_PREVIOUS_COMMIT="$CURRENT_COMMIT" \
    /usr/bin/bash "$APP_DIR/deploy/deploy-from-git.sh"
fi

ROLLBACK_COMMIT="${PROJECT_EVE_PREVIOUS_COMMIT:-$CURRENT_COMMIT}"

rollback() {
  printf 'El despliegue falló; restaurando %s\n' "$ROLLBACK_COMMIT" >&2
  git reset --hard "$ROLLBACK_COMMIT"
  if [[ -f compose.yaml ]]; then
    docker compose up -d --build
  else
    printf 'El commit anterior no incluye compose.yaml; se conservaron los contenedores que ya estaban ejecutándose.\n' >&2
  fi
}
trap rollback ERR

docker compose build api frontend
docker compose up -d database

# Migración idempotente del lector/códigos de barras. sqlcmd interpreta los separadores GO.
# La contraseña se obtiene del entorno del contenedor; el archivo .env nunca se ejecuta como Bash.
MSSQL_SA_PASSWORD="$(docker compose exec -T database printenv MSSQL_SA_PASSWORD | tr -d '\r')"
SQL_READY=0
for _ in {1..30}; do
  if docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -Q "SELECT 1" >/dev/null; then
    SQL_READY=1
    break
  fi
  sleep 2
done
if [[ "$SQL_READY" != "1" ]]; then
  printf 'SQL Server no estuvo disponible a tiempo para ejecutar las migraciones.\n' >&2
  exit 1
fi
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261007_codigos_barras_lector_movil.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261008_perfil_seguridad.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261008_notificaciones.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261009_entradas_caja_sucursal.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261010_usuarios_caja_entrada_fix.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261022_clientes_nit_repetido.sql
docker compose exec -T -e "SQLCMDPASSWORD=${MSSQL_SA_PASSWORD}" database \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -I -d AZESHERBD \
  < Database/Migrations/20261026_proveedores_vendedores_activos.sql

# Las migraciones ya se ejecutaron explícitamente arriba. Evitamos volver a
# ejecutar el servicio one-shot y arrancamos los servicios de aplicación.
docker compose up -d --no-deps api frontend caddy
docker compose ps

for _ in {1..30}; do
  if curl --fail --silent --show-error https://sistema.azesher.com/ >/dev/null; then
    trap - ERR
    printf 'Despliegue completado: %s\n' "$TARGET_COMMIT"
    exit 0
  fi
  sleep 2
done

printf 'La verificación HTTPS no respondió a tiempo.\n' >&2
exit 1
