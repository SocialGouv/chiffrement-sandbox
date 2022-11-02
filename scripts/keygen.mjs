// @ts-check

import sodium from 'libsodium-wrappers'
import 'zx/globals'

if (argv.help) {
  console.log(`
  ${chalk.bold('Generate Sodium keys')}

  Usage:
    ${chalk.red('$')} zx ./scripts/keygen.mjs ${chalk.green(
    '[algorithm]'
  )} ${chalk.dim('(OPTIONS)')}

  Algorithms:
    ${chalk.green('•')} box              ${chalk.italic.dim('x25519')}
    ${chalk.green('•')} sealedBox        ${chalk.italic.dim('x25519')}
    ${chalk.green('•')} secretBox        ${chalk.italic.dim(
    'XChaCha20-Poly1305'
  )}
    ${chalk.green('•')} sign, signature  ${chalk.italic.dim('ed25519')}
    ${chalk.green('•')} identity         ${chalk.italic.dim(
    'Complete e2esdk Identity'
  )}

  Options:
    --help             Show this message
    --compact          Single-line JSON output
    --userId           Set the user ID in the returned Identity ${chalk.italic.dim(
      '(only for `identity`)'
    )}
`)
  process.exit(0)
}

await sodium.ready

const indentation = argv.compact ? 0 : 2

if (argv._[0] === 'secretBox') {
  console.log(
    JSON.stringify(
      {
        key: sodium.crypto_secretbox_keygen('base64'),
      },
      null,
      indentation
    )
  )
}
if (['box', 'sealedBox'].includes(argv._[0])) {
  const { publicKey, privateKey } = sodium.crypto_box_keypair('base64')
  console.log(JSON.stringify({ publicKey, privateKey }, null, indentation))
}
if (['sign', 'signature'].includes(argv._[0])) {
  const { publicKey, privateKey } = sodium.crypto_sign_keypair('base64')
  console.log(JSON.stringify({ publicKey, privateKey }, null, indentation))
}

if (argv._[0] === 'identity') {
  const personalKey = sodium.crypto_secretbox_keygen()
  const signature = sodium.crypto_sign_keypair()
  const sharing = sodium.crypto_box_keypair()
  console.log(
    JSON.stringify(
      {
        personalKey: sodium.to_base64(personalKey),
        identity: {
          userId: argv.userId,
          sharingPublicKey: sodium.to_base64(sharing.publicKey),
          sharingPrivateKey: encrypt(sharing.privateKey, personalKey),
          signaturePublicKey: sodium.to_base64(signature.publicKey),
          signaturePrivateKey: encrypt(signature.privateKey, personalKey),
        },
      },
      null,
      indentation
    )
  )
}

function encrypt(input, key) {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(input, nonce, key)
  const out = new Uint8Array(nonce.byteLength + ciphertext.byteLength)
  out.set(nonce)
  out.set(ciphertext, nonce.byteLength)
  return sodium.to_base64(out)
}
