const path = require('path');
module.exports = {
  entry: './src/xxx.proto.js',
  output: {
    filename: 'xxx.js',
    path: path.resolve(__dirname, 'dist')
  },
};