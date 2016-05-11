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
    this.map = new sourceMap.SourceMapGenerator({ file })
  }

  add (css, mapping) {
    const position = lineColumn(this.css, this.css.length - 1) || { line: 1, col: 0 }

    mapping && this.map.addMapping({
      source: mapping.source,
      generated: { line: position.line, column: position.col },
      original: { line: mapping.line, column: mapping.column }
    })

    this.css += css
  }

  stringify () {
    return {
      css: `${this.css}\n/*# sourceMappingURL=${this.name}.map*/`,
      map: this.map.toString()
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

      const css = compilation.assets[file].source()
      const map = hasMap && compilation.assets[file + '.map'].source()

      const oldCss = cssParser.parse(css)
      const oldMap = hasMap && sourceMap.SourceMapConsumer(map)

      let context = new Block(file)

      const complete = []
      const stack = [ context ]

      oldCss.stylesheet.rules.forEach(rule => {
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
              throw new Error(`Closing block mismatch: open=${context.name}, closing=${name}`)
            }
          }

          return
        }

        // ignore original sourcemap pragmas
        if (rule.type === 'comment' && SOURCEMAP.test(rule.comment)) {
          return
        }

        const mapping = hasMap && oldMap.originalPositionFor(rule.position.start)

        const raw = css.slice(
          lineColumn(css).toIndex(rule.position.start),
          lineColumn(css).toIndex(rule.position.end)
        )

        context.add(raw, mapping)
      })

      if (stack.length === 1) {
        complete.push(stack.pop())
      } else {
        throw new Error(`Block was not closed: ${context.name}`)
      }

      complete.forEach(block => {
        // append original sources to map where necessary
        hasMap && oldMap.sources.forEach(source => {
          if (block.map._sources.has(source)) {
            block.map.setSourceContent(source, oldMap.sourceContentFor(source))
          }
        })

        const result = block.stringify()

        compilation.assets[block.file] = new RawSource(result.css)
        compilation.assets[block.file + '.map'] = new RawSource(result.map)
      })
    })

    callback()
  })
}

module.exports = function () {
  return { apply }
}
