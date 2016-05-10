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
      // .departures
      const original1 = result1.originalPositionFor({ line: 1, column: 0 })

      // .notice--loading
      const original2 = result2.originalPositionFor({ line: 131, column: 27 })

      assert.equal(original1.line, 310)
      assert.equal(original2.line, 398)
    })

    it('translates original positions to the new', () => {
      // .departures__heading
      const generated1 = result1.generatedPositionFor({
        line: 314, column: 0, source: result1.sources[0]
      })

      // .network__line--piccadilly
      const generated2 = result2.generatedPositionFor({
        line: 218, column: 0, source: result2.sources[0]
      })

      assert.equal(generated1.line, 2)
      assert.equal(generated2.line, 88)
    })

    it('includes source content from the original source map', () => {
      assert.equal(result1.sourcesContent.length, 1)
      assert.equal(result2.sourcesContent.length, 1)
    })
  })

})
