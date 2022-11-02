## Chiffrement Sandbox

Prototype de SDK de chiffrement de bout en bout (e2esdk), permettant l'échange
de clés entre utilisateurs authentifiés par clé publique.

## Setup

1. Installer les dépendances:

```shell
$ yarn install
```

2. Démarrer la base de donnée PostgreSQL via docker-compose, puis application des migrations
   et des seeds:

```shell
$ yarn db:start
$ yarn db:migrations apply
$ yarn db:migrations seed
```

3. Préparer les variables d'environment en dupliquant `.env.example` en `.env`,
   et en ajoutant les clés de signature du serveur, générées via:

```shell
$ yarn keygen signature
```

4. Lancer le serveur de dev:

```shell
$ yarn dev
```

L'appli tourne sur http://localhost:3000

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
