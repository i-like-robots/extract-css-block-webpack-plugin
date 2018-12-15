const assert = require('assert')
const sourceMap = require('source-map')
const webpack = require('webpack')
const config = require('./fixture/config')

describe('Extract css block plugin', () => {
  let stats

  context('without source maps', () => {
    before((done) => {
      webpack(config.without).run((error, result) => {
        stats = result
        done(error)
      })
    })

    describe('file creation', () => {
      it('creates a css file for each extract', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          assert.ok(stats.compilation.assets.hasOwnProperty(`${file}.css`))
        })
      })

      it('does not create any map files for extracts', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          assert.equal(stats.compilation.assets.hasOwnProperty(`${file}.css.map`), false)
        })
      })
    })

    describe('output styles', () => {
      it('removes block pragmas', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          const result = stats.compilation.assets[`${file}.css`].source()

          assert.equal(/\*! start:[\w]+\.css \*/.test(result), false)
          assert.equal(/\*! end:[\w]+\.css \*/.test(result), false)
        })
      })

      it('extracts the contents of the block pragmas', () => {
        const result1 = stats.compilation.assets['external.css'].source()
        const result2 = stats.compilation.assets['parent.css'].source()
        const result3 = stats.compilation.assets['child.css'].source()

        assert.ok(/^\.external \{/.test(result1))
        assert.ok(/^\.parent \{/.test(result2))
        assert.ok(/^\.child \{/.test(result3))
      })

      it('removes any sourcemap pragmas', () => {
        const result = stats.compilation.assets['main.css'].source()
        assert.equal(result.match(/sourceMappingURL/g), null)
      })
    })
  })

  context('with source maps', () => {
    before((done) => {
      webpack(config.with).run((error, result) => {
        stats = result
        done(error)
      })
    })

    describe('file creation', () => {
      it('creates a map file for each extract', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          const result = stats.compilation.assets[`${file}.css`].source()
          assert.equal(result.match(/sourceMappingURL/g).length, 1)
          assert.ok(stats.compilation.assets.hasOwnProperty(`${file}.css.map`))
        })
      })
    })

    describe('output styles', () => {
      it('appends new sourcemap pragmas to each extract', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          const result = stats.compilation.assets[`${file}.css`].source()
          assert.equal(result.match(/sourceMappingURL/g).length, 1)
        })
      })
    })

    describe('source maps', () => {
      let results = {}

      before(() => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          results[file] = new sourceMap.SourceMapConsumer(
            stats.compilation.assets[`${file}.css.map`].source()
          )
        })
      })

      it('associates each source map with a stylesheet', () => {
        ['main', 'external', 'parent', 'child'].forEach(file => {
          assert.equal(results[file].file, `${file}.css`)
        })
      })

      it('translates new positions to the original', () => {
        let original

        original = results.main.originalPositionFor({ line: 14, column: 18 })

        assert.equal(original.line, 5)
        assert.equal(original.column, 0)

        original = results.external.originalPositionFor({ line: 1, column: 0 })

        assert.equal(original.line, 18)
        assert.equal(original.column, 0)

        original = results.parent.originalPositionFor({ line: 1, column: 0 })

        assert.equal(original.line, 24)
        assert.equal(original.column, 0)

        original = results.child.originalPositionFor({ line: 1, column: 0 })

        assert.equal(original.line, 29)
        assert.equal(original.column, 0)
      })

      it('translates original positions to the new', () => {
        let generated

        generated = results.main.generatedPositionFor({
          line: 45, column: 0, source: results.main.sources[1]
        })

        assert.equal(generated.line, 17)
        assert.equal(generated.column, 38)

        generated = results.external.generatedPositionFor({
          line: 18, column: 0, source: results.external.sources[0]
        })

        assert.equal(generated.line, 1)
        assert.equal(generated.column, 0)

        generated = results.parent.generatedPositionFor({
          line: 34, column: 0, source: results.parent.sources[0]
        })

        assert.equal(generated.line, 2)
        assert.equal(generated.column, 28)

        generated = results.child.generatedPositionFor({
          line: 29, column: 0, source: results.child.sources[0]
        })

        assert.equal(generated.line, 1)
        assert.equal(generated.column, 0)
      })

      it('adds mappings for rules inside media queries', () => {
        const generated = results.main.generatedPositionFor({
          line: 11, column: 2, source: results.main.sources[1]
        })

        assert.equal(generated.line, 16)
        assert.equal(generated.column, 2)

        const original = results.main.originalPositionFor({ line: 16, column: 2 })

        assert.equal(original.line, 11)
        assert.equal(original.column, 2)
      })

      it('includes source content from the original source map', () => {
        assert.equal(results.main.sourcesContent.length, 2)
        assert.equal(results.external.sourcesContent.length, 1)
      })
    })
  })
})
