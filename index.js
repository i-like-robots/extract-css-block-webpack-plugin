const path = require('path')
const crypto = require('crypto')
const cssParser = require('css')
const lineColumn = require('line-column')
const { SourceMapConsumer, SourceMapGenerator } = require('source-map')

const DELIMITER = /^!\s?(start|end):([\w_\-.]+\.css)\s?$/
const SOURCEMAP = /^# sourceMappingURL=[\w_\-.]+\.css\.map/

class Block {
  constructor (file, hasMap) {
    this.file = file
    this.name = path.basename(file)
    this.css = ''
    this.map = hasMap ? new SourceMapGenerator({ file }) : null
  }

  addMapping (css, mapping) {
    const index = this.css.lastIndexOf(css) - 1
    const position = lineColumn(this.css, index) || { line: 1, col: 0 }

    this.map.addMapping({
      source: mapping.source,
      generated: { line: position.line, column: position.col },
      original: { line: mapping.line, column: mapping.column }
    })
  }

  stringify (outputFile) {
    const pragma = `/*# sourceMappingURL=${outputFile}.map*/\n`

    return {
      css: `${this.css}\n${this.map ? pragma : ''}`,
      map: this.map ? this.map.toString() : ''
    }
  }
}

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

function apply (options, compiler) {
  compiler.hooks.emit.tap('ExtractCssBlockPlugin', (compilation, callback) => {
    // bail if there have been any errors
    if (compilation.errors.length) {
      return callback()
    }

    const files = Object.keys(compilation.assets).filter(
      filename => options.match.test(filename)
    )

    files.forEach(file => {
      let hasMap = compilation.assets.hasOwnProperty(`${file}.map`)

      const rawCss = compilation.assets[file].source()
      const rawMap = hasMap ? compilation.assets[`${file}.map`].source() : null

      const parsedCss = cssParser.parse(rawCss, { silent: true })
      const parsedMap = rawMap ? new SourceMapConsumer(rawMap) : null

      if (parsedCss.stylesheet.parsingErrors.length) {
        const error = parsedCss.stylesheet.parsingErrors.shift()

        compilation.errors.push(
          new Error(`Error parsing ${file}: ${error.reason}, line=${error.line}`)
        )
      }

      const blocks = {}
      const stack = []

      function getBlock (filename) {
        if (blocks.hasOwnProperty(filename)) {
          return blocks[filename]
        } else {
          return blocks[filename] = new Block(filename, hasMap)
        }
      }

      function extractCss (rule) {
        return rawCss.slice(
          lineColumn(rawCss).toIndex(rule.position.start),
          lineColumn(rawCss).toIndex(rule.position.end)
        )
      }

      function addMapping (css, rule) {
        const mapping = parsedMap.originalPositionFor(rule.position.start)
        context.addMapping(css, mapping)
      }

      function formatFilename (format, filename, contents) {
        const { hashFunction, hashDigest, hashDigestLength } = compilation.outputOptions

        let output = format.replace('[name]', path.basename(filename, '.css'))

        if (format.includes('[contenthash]')) {
          const hash = crypto.createHash(hashFunction).update(contents)
          const digest = hash.digest(hashDigest).substring(0, hashDigestLength)

          output = output.replace('[contenthash]', digest)
        }

        return output
      }

      let context = getBlock(file)
      stack.push(context)

      parsedCss.stylesheet.rules.forEach(rule => {
        if (rule.type === 'comment' && DELIMITER.test(rule.comment)) {
          const matches = rule.comment.match(DELIMITER)
          const type = matches[1]
          const name = matches[2]

          if (type === 'start') {
            context = getBlock(name)
            stack.push(context)
          } else {
            if (context.name === name) {
              stack.pop()
              context = stack[stack.length - 1]
            } else {
              compilation.errors.push(
                new Error(`Closing block mismatch: open=${context.name}, closing=${name}`)
              )
            }
          }

          return
        }

        // ignore original sourcemap pragmas
        if (rule.type === 'comment' && SOURCEMAP.test(rule.comment)) {
          return
        }

        const css = extractCss(rule)
        context.css += css

        // translate existing source map to the new target
        if (hasMap) {
          addMapping(css, rule)

          // add mappings for any rulesets inside a media query
          rule.type === 'media' && rule.rules.forEach(child => {
            addMapping(extractCss(child), child)
          })
        }
      })

      if (stack.length > 1) {
        compilation.errors.push(
          new Error(`Block was not closed: /*! start:${context.name} */`)
        )
      }

      Object.keys(blocks).forEach(filename => {
        const block = blocks[filename]

        // append original sources to map where necessary
        block.map && parsedMap.sources.forEach(source => {
          if (block.map && block.map._sources.has(source)) {
            block.map.setSourceContent(source, parsedMap.sourceContentFor(source))
          }
        })

        const outputFile = formatFilename(options.filename, block.file, block.css)
        const result = block.stringify(outputFile)

        // remove old file from the compilation so we may rehash it
        delete compilation.assets[block.file]
        compilation.assets[outputFile] = new RawSource(result.css)

        if (result.map) {
          delete compilation.assets[block.file + '.map']
          compilation.assets[outputFile + '.map'] = new RawSource(result.map)
        }
      })
    })
  })
}

module.exports = function (userOptions) {
  const defaultOptions = {
    match: /\.css$/,
    filename: '[name].css'
  }

  const options = Object.assign(defaultOptions, userOptions)
  return { apply: apply.bind(null, options) }
}
