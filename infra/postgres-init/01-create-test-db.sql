-- Integration tests run against a separate database so they never touch dev
-- data. Only runs on a fresh volume, like the rest of docker-entrypoint-initdb.d.
-- See docs/context/testing.md and DATABASE_URL_TEST in .env.example.
CREATE DATABASE cuadre_test;
