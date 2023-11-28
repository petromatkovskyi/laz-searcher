const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  resolve: {
    fallback: {
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify'),
      path: require.resolve('path-browserify'),
      url: require.resolve('url/'),
    },
  },
};
