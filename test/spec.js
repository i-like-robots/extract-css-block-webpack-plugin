'use strict'

const assert = require('assert')
const sourceMap = require('source-map')
const webpack = require('webpack')
const config = require('./fixture/config')

describe('Extract css block plugin', () => {
  let stats

  before((done) => {
    webpack(config.with).run((err, result) => {
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

    it('creates a map file for each extract', () => {
      assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/main.css.map'))
      assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/departures.css.map'))
      assert.ok(stats.compilation.assets.hasOwnProperty('./test/output/trains.css.map'))
    })
  })

  describe('output styles', () => {
    it('removes block pragmas', () => {
      const result = stats.compilation.assets['./test/output/main.css'].source()

      assert.equal(/\*! start:[\w]+\.css \*/.test(result), false)
      assert.equal(/\*! end:[\w]+\.css \*/.test(result), false)
    })

    it('removes original sourcemap pragmas', () => {
      const result = stats.compilation.assets['./test/output/main.css'].source()
      assert.equal(result.match(/sourceMappingURL/g).length, 1)
    })

    it('appends new sourcemap pragmas to each extract', () => {
      const result1 = stats.compilation.assets['./test/output/departures.css'].source()
      const result2 = stats.compilation.assets['./test/output/trains.css'].source()

      assert.equal(result1.match(/sourceMappingURL/g).length, 1)
      assert.equal(result2.match(/sourceMappingURL/g).length, 1)
    })

    it('extracts the contents of the block pragmas', () => {
      const result1 = stats.compilation.assets['./test/output/departures.css'].source()
      const result2 = stats.compilation.assets['./test/output/trains.css'].source()

      assert.ok(/^\.departures \{/.test(result1))
      assert.ok(/^\.trains \{/.test(result2))
    })
  })

  describe('source maps', () => {
    let result1
    let result2

    before(() => {
      result1 = new sourceMap.SourceMapConsumer(
        stats.compilation.assets['./test/output/departures.css.map'].source()
      )
      result2 = new sourceMap.SourceMapConsumer(
        stats.compilation.assets['./test/output/main.css.map'].source()
      )
    })

    it('associates each source map with a stylesheet', () => {
      assert.equal(result1.file, './test/output/departures.css')
      assert.equal(result2.file, './test/output/main.css')
    })

    it('translates new positions to the original', () => {
      let original

      // departures.css > .departures {}
      original = result1.originalPositionFor({ line: 1, column: 0 })

      assert.equal(original.line, 277)
      assert.equal(original.column, 0)

      // departures.css > .departures__heading {}
      original = result1.originalPositionFor({ line: 2, column: 19 })

      assert.equal(original.line, 281)
      assert.equal(original.column, 0)

      // main.css > .notice--loading {}
      original = result2.originalPositionFor({ line: 131, column: 26 })

      assert.equal(original.line, 367)
      assert.equal(original.column, 0)
    })

    it('translates original positions to the new', () => {
      let generated

      // entry.scss > .departures
      generated = result1.generatedPositionFor({ line: 277, column: 0, source: result1.sources[0] })

      assert.equal(generated.line, 1)
      assert.equal(generated.column, 0)

      // entry.scss > .network__line--piccadilly
      generated = result2.generatedPositionFor({ line: 185, column: 0, source: result2.sources[2] })

      assert.equal(generated.line, 88)
      assert.equal(generated.column, 28)

      // normalize.scss > body
      generated = result2.generatedPositionFor({ line: 6, column: 0, source: result2.sources[1] })

      assert.equal(generated.line, 3)
      assert.equal(generated.column, 35)
    })

    it('includes source content from the original source map', () => {
      assert.equal(result1.sourcesContent.length, 1)
      assert.equal(result2.sourcesContent.length, 3)
    })
  })
})
