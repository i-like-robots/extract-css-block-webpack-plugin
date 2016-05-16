'use strict'

const assert = require('assert')
const sourceMap = require('source-map')
const webpack = require('webpack')
const config = require('./fixture/config')

describe('Extract css block plugin', () => {
  let stats

  context('without source maps', () => {
    before((done) => {
      webpack(config.without).run((err, result) => {
        stats = result
        done(err)
      })
    })

    describe('file creation', () => {
      it('creates a css file for each extract', () => {
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/main.css'))
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/departures.css'))
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/trains.css'))
      })

      it('does not create any map files for extracts', () => {
        assert.equal(stats.compilation.assets.hasOwnProperty('./test/output/main.css.map'), false)
        assert.equal(stats.compilation.assets.hasOwnProperty('./test/output/departures.css.map'), false)
        assert.equal(stats.compilation.assets.hasOwnProperty('./test/output/trains.css.map'), false)
      })
    })

    describe('output styles', () => {
      it('removes block pragmas', () => {
        const result = stats.compilation.assets['./test/output/main.css'].source()

        assert.equal(/\*! start:[\w]+\.css \*/.test(result), false)
        assert.equal(/\*! end:[\w]+\.css \*/.test(result), false)
      })

      it('extracts the contents of the block pragmas', () => {
        const result1 = stats.compilation.assets['./test/output/departures.css'].source()
        const result2 = stats.compilation.assets['./test/output/trains.css'].source()

        assert.ok(/^\.departures \{/.test(result1))
        assert.ok(/^\.trains \{/.test(result2))
      })

      it('removes any sourcemap pragmas', () => {
        const result = stats.compilation.assets['./test/output/main.css'].source()
        assert.equal(result.match(/sourceMappingURL/g), null)
      })
    })
  })

  context('with source maps', () => {
    before((done) => {
      webpack(config.with).run((err, result) => {
        stats = result
        done(err)
      })
    })

    describe('file creation', () => {
      it('creates a map file for each extract', () => {
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/main.css.map'))
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/departures.css.map'))
        assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/trains.css.map'))
      })
    })

    describe('output styles', () => {
      it('appends new sourcemap pragmas to each extract', () => {
        const result1 = stats.compilation.assets['./test/output/main.css'].source()
        const result2 = stats.compilation.assets['./test/output/departures.css'].source()
        const result3 = stats.compilation.assets['./test/output/trains.css'].source()

        assert.equal(result1.match(/sourceMappingURL/g).length, 1)
        assert.equal(result2.match(/sourceMappingURL/g).length, 1)
        assert.equal(result3.match(/sourceMappingURL/g).length, 1)
      })
    })

    describe('source maps', () => {
      let result1
      let result2
      let result3

      before(() => {
        result1 = new sourceMap.SourceMapConsumer(
          stats.compilation.assets['./test/output/main.css.map'].source()
        )
        result2 = new sourceMap.SourceMapConsumer(
          stats.compilation.assets['./test/output/departures.css.map'].source()
        )
        result3 = new sourceMap.SourceMapConsumer(
          stats.compilation.assets['./test/output/trains.css.map'].source()
        )
      })

      it('associates each source map with a stylesheet', () => {
        assert.equal(result1.file, './test/output/main.css')
        assert.equal(result2.file, './test/output/departures.css')
        assert.equal(result3.file, './test/output/trains.css')
      })

      it('translates new positions to the original', () => {
        let original

        // main.css > .notice--loading {}
        original = result1.originalPositionFor({ line: 131, column: 26 })

        assert.equal(original.line, 367)
        assert.equal(original.column, 0)

        // departures.css > .departures {}
        original = result2.originalPositionFor({ line: 1, column: 0 })

        assert.equal(original.line, 277)
        assert.equal(original.column, 0)

        // departures.css > .departures__heading {}
        original = result2.originalPositionFor({ line: 2, column: 19 })

        assert.equal(original.line, 281)
        assert.equal(original.column, 0)
        assert.equal(original.column, 0)

        // trains.css > .trains {}
        original = result3.originalPositionFor({ line: 1, column: 0 })

        assert.equal(original.line, 309)
        assert.equal(original.column, 0)
      })

      it('translates original positions to the new', () => {
        let generated

        // entry.scss > .network__line--piccadilly
        generated = result1.generatedPositionFor({ line: 185, column: 0, source: result1.sources[2] })

        assert.equal(generated.line, 88)
        assert.equal(generated.column, 28)

        // normalize.scss > body
        generated = result1.generatedPositionFor({ line: 6, column: 0, source: result1.sources[1] })

        assert.equal(generated.line, 3)
        assert.equal(generated.column, 35)

        // entry.scss > .departures
        generated = result2.generatedPositionFor({ line: 277, column: 0, source: result2.sources[0] })

        assert.equal(generated.line, 1)
        assert.equal(generated.column, 0)

        // entry.scss > .trains
        generated = result3.generatedPositionFor({ line: 309, column: 0, source: result3.sources[0] })

        assert.equal(generated.line, 1)
        assert.equal(generated.column, 0)
      })

      it('adds mappings for rules inside medaia queries', () => {
        // entry.scss > @media ... { .network__toggle }
        const generated = result1.generatedPositionFor({
          line: 241, column: 2, source: result1.sources[2]
        })

        assert.equal(generated.line, 108)
        assert.equal(generated.column, 2)

        // trains.css > @media ... { .trains th:last-child }
        const original = result3.originalPositionFor({ line: 17, column: 2 })

        assert.equal(original.line, 339)
        assert.equal(original.column, 2)
      })

      it('includes source content from the original source map', () => {
        assert.equal(result1.sourcesContent.length, 3)
        assert.equal(result2.sourcesContent.length, 1)
        assert.equal(result3.sourcesContent.length, 1)
      })
    })
  })

  context('invalid source map', () => {
    before((done) => {
      webpack(config.invalid).run((err, result) => {
        stats = result
        done(err)
      })
    })

    it('warns the user that the provided source map is invalid', () => {
      assert.equal(stats.compilation.warnings.length, 1)
    })

    it('warns the user if their source map configuration may be invalid', () => {
      assert.ok(stats.compilation.warnings.pop().match(/configuration/))
    })
  })
})
