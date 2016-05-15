'use strict'

const path = require('path')
const sourceMap = require('source-map')
const cssParser = require('css')
const lineColumn = require('line-column')

const DELIMITER = /^!\s?(start|end):([\w_-]+\.css)\s?$/
const SOURCEMAP = /^# sourceMappingURL=[\w_-]+\.css\.map/

class Block {
  constructor (file) {
    this.file = file
    this.name = path.basename(file)
    this.css = ''
  }

  add (css) {
    this.css += css
  }

  applyMapping (css, mapping) {
    this.map = this.map || new sourceMap.SourceMapGenerator({ file: this.file })

    const position = lineColumn(this.css, this.css.indexOf(css) - 1) || { line: 1, col: 0 }

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

function apply (compiler) {
  compiler.plugin('emit', (compilation, callback) => {
    const files = Object.keys(compilation.assets).filter(filename => {
      return /\.css$/.test(filename)
    })

    files.forEach(file => {
      const hasMap = compilation.assets.hasOwnProperty(file + '.map')

      const rawCss = compilation.assets[file].source()
      const rawMap = hasMap && compilation.assets[file + '.map'].source()

      const parsedCss = cssParser.parse(rawCss, { silent: true })
      const parsedMap = hasMap && sourceMap.SourceMapConsumer(rawMap)

      if (parsedCss.stylesheet.parsingErrors.length) {
        const err = parsedCss.stylesheet.parsingErrors.shift()

        compilation.errors.push(
          new Error(`Error parsing ${file}: ${err.reason}, line=${err.line}`)
        )
      }

      let context = new Block(file)

      const complete = []
      const stack = [ context ]

      function extractCss(rule) {
        return rawCss.slice(
          lineColumn(rawCss).toIndex(rule.position.start),
          lineColumn(rawCss).toIndex(rule.position.end)
        )
      }

      parsedCss.stylesheet.rules.forEach(rule => {
        if (rule.type === 'comment' && DELIMITER.test(rule.comment)) {
          const matches = rule.comment.match(DELIMITER)
          const type = matches[1]
          const name = matches[2]

          if (type === 'start') {
            context = new Block(`${path.dirname(file)}/${name}`)
            stack.push(context)
          } else {
            if (context.name === name) {
              complete.push(stack.pop())
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
        context.add(css)

        // translate existing source map to the new target
        if (parsedMap) {
          const mapping = parsedMap.originalPositionFor(rule.position.start)
          context.applyMapping(css, mapping)

          // add mappings for any rulesets inside a media query
          rule.type === 'media' && rule.rules.forEach(child => {
            const css = extractCss(child)
            const mapping = parsedMap.originalPositionFor(child.position.start)

            context.applyMapping(css, mapping)
          })
        }
      })

      if (stack.length === 1) {
        complete.push(stack.pop())
      } else {
        compilation.errors.push(
          new Error(`Block was not closed: /*! start:${context.name} */`)
        )
      }

      complete.forEach(block => {
        // append original sources to map where necessary
        parsedMap && parsedMap.sources.forEach(source => {
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

module.exports = function () {
  return { apply }
}
