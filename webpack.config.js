'use strict'

const ExtractCssBlockPlugin = require('./index')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = {
  entry: {
    './output/main.css': './test-files/entry.scss'
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
