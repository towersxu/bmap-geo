const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')


module.exports = {
  entry: {
    app: './src/exportfix.js'
  },
  // devtool: 'source-map',
  output: {
    filename: 'bmap-geojson.js',
    path: path.resolve(__dirname, ''),
    publicPath: '/',
    sourceMapFilename: 'bmap-geojson.map',
    library: 'BmapGeo',
    libraryTarget: 'umd'
  },
  devServer: {
    contentBase: './',
    hot: true
  },
  plugins: [
    new CleanWebpackPlugin(['dist']),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new UglifyJsPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }

};
