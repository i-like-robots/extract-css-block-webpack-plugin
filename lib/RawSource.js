// There's no documentation for this so just be a mimic...
// <https://github.com/webpack/webpack-sources/blob/master/lib/RawSource.js>
class RawSource {
  constructor (value) {
    this._value = value
  }

  source () {
    return this._value
  }

  size () {
    return this._value.length
  }
}

module.exports = RawSource
