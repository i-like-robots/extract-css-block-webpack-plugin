const path = require('path')
const lineColumn = require('line-column')
const { SourceMapGenerator } = require('source-map')

class CSSBlock {
  constructor(file, hasMap) {
    this.file = file
    this.name = path.basename(file)
    this.css = ''
    this.map = hasMap ? new SourceMapGenerator({ file }) : null
  }

  addMapping(css, mapping) {
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

module.exports = CSSBlock
