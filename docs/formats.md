# Formats

Most cryptographic operations work on byte arrays (`Uint8Array`).

However, to help with transport over HTTP, storage and display, data travels
through components of the SDK in a serialised form.

## Binary data encoding

Binary data consists of:

- Key material _(eg: XChaCha20-Poly1305 secret key, Ed25519 signature key pairs, X25519 key pairs)_
- Nonces
- Ciphertext payload (output of encryption functions)
- Signatures (output of Ed25519)
- Hashes (output of BLAKE2b)

Binary data MUST be serialised to `base64url` as specified in
[RFC-4648 Section 5](https://datatracker.ietf.org/doc/html/rfc4648#section-5).

## Composite ciphertext encoding

Encryption algorithms often require more than just the ciphertext:
if a random nonce is used (eg: XChaCha20-Poly1305),
it needs to be transmitted along with the associated ciphertext.

Some metadata about the content type can be transmitted along, to help
"hydrating" the cleartext after decryption.

### `application/e2esdk.ciphertext.v1`

The following format encodes as dot-separated (`.`) elements:

```
v1.box.txt.ihlbmwz_6QnSGwk5Vd7Z_YvLIWhMWVLA.vgGnwPO2K2h25LBRpxubFlyRr-LcyM4PJEvhs4H7cT9uqpBtlcvP

v1.secretBox.txt.jpRdAA_EpJrswJNfUd3N9uOMV3goc0d_.ATk-9VrU47oTpO3YmhgAADQ7XF_EFN9TeB7px8xCodV_TunQqqjU
```

#### Header

The first three elements are always present:

- `v1`: Encoding version identifier
- `{algorithm}`: `'box' | 'sealedBox' | 'secretBox'`
- `{payloadType}`: `'txt' | 'bin' | 'json'`

Based on the `{algorithm}` type, the number and meaning of subsequent
element varies:

#### Algorithms

##### `box`

- Nonce
- Ciphertext

#### `sealedBox`

- Ciphertext

#### `secretBox`

- Nonce
- Ciphertext

#### Payload types

- `txt` will decrypt into an UTF-8 string
- `bin` will decrypt into a byte array (Uint8Array)
- `json` will decrypt into an UTF-8 string then passed to `JSON.parse`
