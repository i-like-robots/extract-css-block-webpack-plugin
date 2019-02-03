const crypto = require('crypto')

module.exports = ({ hashFunction, hashDigest, hashDigestLength }) => {
  return (fileContents) => {
    const hash = crypto.createHash(hashFunction).update(fileContents)
    return hash.digest(hashDigest).substring(0, hashDigestLength)
  }
}
