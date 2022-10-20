## Benchmark

Etude de performance entre les librairies suivantes:

- [TweetNaCl](https://www.npmjs.com/package/tweetnacl)
- [Sodium](https://www.npmjs.com/package/libsodium-wrappers)

Pour lancer:

- Dans un navigateur: `yarn benchmark:browser`, puis ouvrir la console.
- Dans Node.js: `yarn benchmark:node`

## Librairie de chiffrement

Algorithmes supportés:

- [x] Chiffrement symétrique de données génériques via `secretBox` (_XChaCha20-Poly1505_)
- [x] Chiffrement symétrique de fichiers, par découpage (_XChaCha20-Poly1505_)
- [x] Chiffrement asymétrique de données génériques via `box` (_X25519-XSalsa20-Poly1305_)
- [x] Chiffrement asymétrique de données génériques anonymisées via `sealedBox` (_X25519-XSalsa20-Poly1305_)
- [x] Signature détachée via `signHash` (_Ed25519_)
- [ ] Hashing (_BLAKE2b_)
- [ ] Dérivation de clés (_Argon2id_)
