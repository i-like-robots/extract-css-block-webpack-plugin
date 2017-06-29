'use strict'

const path = require('path')
const sourceMap = require('source-map')
const cssParser = require('css')
const lineColumn = require('line-column')

const DELIMITER = /^!\s?(start|end):([\w_-]+\.css)\s?$/
const SOURCEMAP = /^# sourceMappingURL=[\w_-]+\.css\.map/

class Block {
  constructor (file, hasMap) {
    this.file = file
    this.name = path.basename(file)
    this.css = ''
    this.map = hasMap && new sourceMap.SourceMapGenerator({ file })
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

  stringify () {
    const pragma = `/*# sourceMappingURL=${this.name}.map*/\n`

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
  compiler.plugin('emit', (compilation, callback) => {
    // bail if there have been any errors
    if (compilation.errors.length) {
      return callback()
    }

    const files = Object.keys(compilation.assets).filter(
      filename => options.match.test(filename)
    )

    files.forEach(file => {
      let hasMap = compilation.assets.hasOwnProperty(file + '.map')

      const rawCss = compilation.assets[file].source()
      const rawMap = hasMap && compilation.assets[file + '.map'].source()

      const parsedCss = cssParser.parse(rawCss, { silent: true })
      const parsedMap = rawMap && sourceMap.SourceMapConsumer(rawMap)

      if (parsedCss.stylesheet.parsingErrors.length) {
        const err = parsedCss.stylesheet.parsingErrors.shift()

        compilation.errors.push(
          new Error(`Error parsing ${file}: ${err.reason}, line=${err.line}`)
        )
      }

      if (parsedMap && parsedMap._mappings.length === 0) {
        hasMap = false

        let warning = `Invalid source map for ${file}`

        if (compilation.options.devtool === 'source-map') {
          warning += ', your source map configuration may be invalid'
        }

        compilation.warnings.push(warning)
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

      let context = getBlock(file)
      stack.push(context)

      parsedCss.stylesheet.rules.forEach(rule => {
        if (rule.type === 'comment' && DELIMITER.test(rule.comment)) {
          const matches = rule.comment.match(DELIMITER)
          const type = matches[1]
          const name = matches[2]

          if (type === 'start') {
            context = getBlock(`${path.dirname(file)}/${name}`)
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

        const result = block.stringify()

        compilation.assets[block.file] = new RawSource(result.css)

        if (result.map) {
          compilation.assets[block.file + '.map'] = new RawSource(result.map)
        }
      })
    })

    callback()
  })
}

module.exports = function (options) {
  options = Object.assign({ match: /\.css$/ }, options)
  return { apply: apply.bind(null, options) }
}
