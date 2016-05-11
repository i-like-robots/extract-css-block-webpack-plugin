'use strict'

const ExtractCssBlockPlugin = require('../index')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = {
  entry: {
    './test/output/main.css': './test/fixtures/entry.scss'
  },
  output: {
    filename: '[name]'
  },
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract('style', ['css?sourceMap', 'sass?sourceMap'])
      }
    ]
  },
  devtool: 'source-map',
  plugins: [
    new ExtractTextPlugin('[name]'),
    new ExtractCssBlockPlugin()
  ]
}
