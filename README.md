Edit 2022-12: L'évolution de ce prototype est disponible ici: https://github.com/SocialGouv/e2esdk
Ce repository est archivé.

## Chiffrement Sandbox

Prototype de SDK de chiffrement de bout en bout (e2esdk), permettant l'échange
de clés entre utilisateurs authentifiés par clé publique.

## Setup

0. Pré-requis:

- Docker & `docker compose` (nécessite Docker Desktop sur Linux)
- Node.js 16+
- Yarn 1.x

1. Installer les dépendances:

```shell
$ yarn install
```

2. Préparer les variables d'environment en dupliquant `.env.example` en `.env`,
   et en ajoutant les clés de signature du serveur, générées via:

```shell
$ yarn keygen signature
```

3. Démarrer la base de donnée PostgreSQL, puis application des migrations
   et des seeds:

```shell
$ yarn db:start
$ yarn db:migrations apply
$ yarn db:migrations seed
```

4. Lancer le serveur de dev:

```shell
$ yarn dev
```

L'appli tourne sur http://localhost:3000

5. Les identifiants des utilisateurs de test _(userId et personalKey)_
   sont disponibles dans ./src/server/database/seeds/identities.mjs

## Ajout de migrations

```shell
$ yarn db:migrations new
```

## Génération de clés

```shell
$ yarn keygen --help
```

## Reset de la BDD

```shell
$ yarn db:migrations reset
$ yarn db:migrations apply
$ yarn db:migrations seed
```
