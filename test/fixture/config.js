const ExtractCssBlockPlugin = require('../../')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports.with = {
  mode: 'development',
  entry: {
    main: './test/fixture/entry.scss'
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: require.resolve('css-loader'),
            options: {
              sourceMap: true
            }
          },
          {
            loader: require.resolve('sass-loader'),
            options: {
              sourceMap: true
            }
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new ExtractCssBlockPlugin()
  ]
}

module.exports.without = {
  mode: 'development',
  entry: {
    main: './test/fixture/entry.scss'
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: require.resolve('css-loader')
          },
          {
            loader: require.resolve('sass-loader')
          }
        ]
      }
    ]
  },
  devtool: false,
  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new ExtractCssBlockPlugin()
  ]
}
