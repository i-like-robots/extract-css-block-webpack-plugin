'use strict'

const ExtractCssBlockPlugin = require('../../index')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports.with = {
  entry: {
    './test/output/main.css': './test/fixture/entry.scss'
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

module.exports.without = {
  entry: {
    './test/output/main.css': './test/fixture/entry.scss'
  },
  output: {
    filename: '[name]'
  },
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract('style', ['css', 'sass'])
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin('[name]'),
    new ExtractCssBlockPlugin()
  ]
}
