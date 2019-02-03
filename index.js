const cssParser = require('css')
const lineColumn = require('line-column')
const CSSBlock = require('./lib/CSSBlock')
const RawSource = require('./lib/RawSource')
const contentHash = require('./lib/contentHash')
const formatFilename = require('./lib/formatFilename')
const { SourceMapConsumer } = require('source-map')

const DELIMITER = /^!\s?(start|end):([\w_\-.]+\.css)\s?$/
const SOURCEMAP = /^# sourceMappingURL=[\w_\-.]+\.css\.map/

function apply (options, compiler) {
  compiler.hooks.emit.tap('ExtractCSSBlockPlugin', (compilation) => {
    // bail if there have been any errors
    if (compilation.errors.length) {
      return
    }

    const cssFiles = Object.keys(compilation.assets).filter(
      filename => options.match.test(filename)
    )

    const hashFunction = contentHash(compilation.outputOptions)

    cssFiles.forEach(cssFile => {
      const hasMapFile = compilation.assets.hasOwnProperty(`${cssFile}.map`)

      const rawCSSFile = compilation.assets[cssFile].source()
      const rawMapFile = hasMapFile ? compilation.assets[`${cssFile}.map`].source() : null

      const parsedCSSFile = cssParser.parse(rawCSSFile, { silent: true })
      const parsedMapFile = rawMapFile ? new SourceMapConsumer(rawMapFile) : null

      if (parsedCSSFile.stylesheet.parsingErrors.length) {
        const error = parsedCSSFile.stylesheet.parsingErrors.shift()

        compilation.errors.push(
          new Error(`Error parsing ${cssFile}: ${error.reason}, line=${error.line}`)
        )
      }

      const outputBlocks = {}
      const stack = []

      function getBlock(cssFile) {
        if (outputBlocks.hasOwnProperty(cssFile)) {
          return outputBlocks[cssFile]
        } else {
          return outputBlocks[cssFile] = new CSSBlock(cssFile, hasMapFile)
        }
      }

      function extractCSS(rule) {
        return rawCSSFile.slice(
          lineColumn(rawCSSFile).toIndex(rule.position.start),
          lineColumn(rawCSSFile).toIndex(rule.position.end)
        )
      }

      function addMapping(css, rule) {
        const mapping = parsedMapFile.originalPositionFor(rule.position.start)
        context.addMapping(css, mapping)
      }

      let context = getBlock(cssFile)
      stack.push(context)

      parsedCSSFile.stylesheet.rules.forEach(rule => {
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

        const css = extractCSS(rule)
        context.css += css

        // translate existing source map to the new target
        if (hasMapFile) {
          addMapping(css, rule)

          // add mappings for any rulesets inside a media query
          rule.type === 'media' && rule.rules.forEach(child => {
            addMapping(extractCSS(child), child)
          })
        }
      })

      if (stack.length > 1) {
        compilation.errors.push(
          new Error(`Block was not closed: /*! start:${context.name} */`)
        )
      }

      Object.keys(outputBlocks).forEach(cssFile => {
        const block = outputBlocks[cssFile]

        // append original sources to map where necessary
        block.map && parsedMapFile.sources.forEach(source => {
          if (block.map && block.map._sources.has(source)) {
            block.map.setSourceContent(source, parsedMapFile.sourceContentFor(source))
          }
        })

        const outputFile = formatFilename(options.filename, block.file, block.css, hashFunction)
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
