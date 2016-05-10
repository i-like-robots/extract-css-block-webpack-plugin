'use strict'

const fs = require('fs')
const mocha = require('mocha')
const assert = require('assert')

describe('Extract css block plugin', () => {

  describe('file creation', () => {

    it('creates a css file for each extract', () => {
      assert.ok(fs.statSync('./output/main.css'))
      assert.ok(fs.statSync('./output/departures.css'))
      assert.ok(fs.statSync('./output/trains.css'))
    })

    it('creates a map file for each extract', () => {
      assert.ok(fs.statSync('./output/main.css.map'))
      assert.ok(fs.statSync('./output/departures.css.map'))
      assert.ok(fs.statSync('./output/trains.css.map'))
    })

  })

  describe('output styles', () => {

    it('removes block pragmas', () => {
      const result = fs.readFileSync('./output/main.css').toString()

      assert.equal(/\*! start:[\w]+\.css \*/.test(result), false)
      assert.equal(/\*! end:[\w]+\.css \*/.test(result), false)
    })

    it('removes original sourcemap pragmas', () => {
      const result = fs.readFileSync('./output/main.css').toString()
      assert.equal(result.match(/sourceMappingURL/g).length, 1)
    })

    it('appends new sourcemap pragmas to each extract', () => {
      const result1 = fs.readFileSync('./output/departures.css').toString()
      const result2 = fs.readFileSync('./output/trains.css').toString()

      assert.equal(result1.match(/sourceMappingURL/g).length, 1)
      assert.equal(result2.match(/sourceMappingURL/g).length, 1)
    })

    it('extracts the contents of the block pragmas', () => {
      const result1 = fs.readFileSync('./output/departures.css').toString()
      const result2 = fs.readFileSync('./output/trains.css').toString()

      assert.ok(/^\.departures \{/.test(result1))
      assert.ok(/^\.trains \{/.test(result2))
    })

  })

  describe('source maps', () => {
    const result1 = new require('source-map').SourceMapConsumer(
      fs.readFileSync('./output/departures.css.map').toString()
    )
    const result2 = new require('source-map').SourceMapConsumer(
      fs.readFileSync('./output/main.css.map').toString()
    )

    it('associates each source map with a stylesheet', () => {
      assert.equal(result1.file, './output/departures.css')
      assert.equal(result2.file, './output/main.css')
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
