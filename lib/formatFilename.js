const path = require('path')

const NAME = '[name]'
const HASH = '[contenthash]'

module.exports = (nameFormat, currentName, fileContents, hashFunction) => {
  let output = nameFormat.replace(NAME, path.basename(currentName, '.css'))

  if (nameFormat.includes(HASH)) {
    output = output.replace(HASH, hashFunction(fileContents))
  }

  return output
}
