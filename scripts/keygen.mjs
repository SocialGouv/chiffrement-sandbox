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

  Options:
    --help             Show this message
    --hex              Hexadecimal output ${chalk.dim('(defaults to base64)')}
`)
  process.exit(0)
}

await sodium.ready

const format = argv.hex ? 'hex' : 'base64'

if (argv._[0] === 'secretBox') {
  console.log({
    key: sodium.crypto_secretbox_keygen(format),
  })
}
if (['box', 'sealedBox'].includes(argv._[0])) {
  console.log(sodium.crypto_box_keypair(format))
}
if (['sign', 'signature'].includes(argv._[0])) {
  console.log(sodium.crypto_sign_keypair(format))
}
