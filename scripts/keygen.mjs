// @ts-check

import sodium from 'libsodium-wrappers'
import 'zx/globals'

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
