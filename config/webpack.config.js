const webpack = require('webpack');
const glob = require('glob');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const AssetsWebpackPlugin = require('assets-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const autoprefixer = require("autoprefixer");
const pkg = require('../package.json');

const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT_PATH = path.resolve(__dirname, '..');

function resolve(dir) {
  return path.join(ROOT_PATH, dir);
}

let autoEntriesCount = 0;
let watchAutoEntries = [];
const defaultEntries = ['babel-polyfill', './main.js'];

function generateEntries() {
  // generate automatic entry points
  const autoEntries = {};
  const autoEntriesMap = {};
  const pageEntries = glob.sync('pages/**/index.js', {
    cwd: path.join(ROOT_PATH, 'src/assets/javascripts'),
  });
  watchAutoEntries = [path.join(ROOT_PATH, 'src/assets/javascripts/pages/')];

  function generateAutoEntries(path, prefix = '.') {
    const chunkPath = path.replace(/\/index\.js$/, '');
    const chunkName = chunkPath.replace(/\//g, '.');
    autoEntriesMap[chunkName] = `${prefix}/${path}`;
  }

  pageEntries.forEach(path => generateAutoEntries(path));

  const autoEntryKeys = Object.keys(autoEntriesMap);
  autoEntriesCount = autoEntryKeys.length;

  // import ancestor entrypoints within their children
  autoEntryKeys.forEach(entry => {
    const entryPaths = [autoEntriesMap[entry]];
    const segments = entry.split('.');
    while (segments.pop()) {
      const ancestor = segments.join('.');
      if (autoEntryKeys.includes(ancestor)) {
        entryPaths.unshift(autoEntriesMap[ancestor]);
      }
    }
    autoEntries[entry] = defaultEntries.concat(entryPaths);
  });

  const manualEntries = {
    main: defaultEntries,
  };

  return Object.assign(manualEntries, autoEntries);
}

const config = {
  context: resolve('src/assets/javascripts'),

  entry: generateEntries,

  output: {
    path: resolve('public/assets'),
    publicPath: `${pkg.basePath}assets/`,
    filename: IS_PROD ? 'js/[name].[chunkhash].js' : '[name].js',
    chunkFilename: IS_PROD ? 'js/[name].[chunkhash].js' : '[name].chunk.js' // works with lazy loading
  },

  resolve: {
    alias: {
      vue$: "vue/dist/vue.esm.js"
    },
    extensions: ['.js', '.vue', '.json']
  },

  module: {
    rules: [{
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: [{
              loader: "css-loader",
              options: {
                importLoaders: 1
              }
            },
            {
              loader: "postcss-loader",
              options: {
                plugins: [
                  autoprefixer({
                    browsers: pkg.browserslist
                  })
                ]
              }
            }
          ]
        })
      },
      {
        test: /\.less$/,
        exclude: /node_modules/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: [{
              loader: "css-loader"
            },
            {
              loader: "postcss-loader",
              options: {
                plugins: [
                  autoprefixer({
                    browsers: pkg.browserslist
                  })
                ]
              }
            },
            {
              loader: "less-loader"
            },
          ]
        })
      },
      {
        test: /\.js$/,
        include: [
          resolve('src'),
          // webpack-dev-server#1090 for Safari
          resolve('/node_modules/webpack-dev-server/')
        ],
        use: {
          loader: 'babel-loader',
          options: {
            plugins: ['lodash'],
            presets: [
              [
                'env',
                {
                  targets: {
                    browsers: pkg.browserslist
                  }
                }
              ],
              'stage-2',
              'react'
            ]
          }
        }
      },
      {
        test: /\.html$/,
        loader: 'html-loader'
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            js: {
              loader: 'babel-loader',
              options: {
                plugins: ['lodash'],
                presets: [
                  [
                    'env',
                    {
                      targets: {
                        browsers: pkg.browserslist
                      }
                    }
                  ],
                  'stage-2',
                  'react'
                ]
              }
            }
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000
          }
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: {
          loader: 'file-loader',
          options: {
            limit: 10000,
            name: 'fonts/[name].[hash:7].[ext]'
          }
        }
      }
    ]
  },

  plugins: [
    new CopyWebpackPlugin([{
      from: resolve('src/assets/images'),
      to: resolve('public/assets/images')
    }]),
    new ExtractTextPlugin({
      filename: IS_PROD ? 'css/[name].[contenthash].css' : '[name].css'
    }),
    new LodashModuleReplacementPlugin(),
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendors',
      minChunks(module) {
        // any required modules inside node_modules are extracted to vendor
        return (
          module.resource &&
          /\.js$/.test(module.resource) &&
          module.resource.indexOf(path.join(__dirname, '../node_modules')) === 0
        );
      }
    })
  ]
};

if (!IS_PROD) {
  config.devtool = 'cheap-module-source-map';
  config.plugins.push(
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin()
  );
  config.devServer = {
    host: '0.0.0.0',
    port: '3808'
  }
}

if (IS_PROD) {
  config.devtool = 'source-map';
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false
      },
      sourceMap: true
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new AssetsWebpackPlugin({
      filename: 'manifest.json',
      path: resolve('public/assets'),
      prettyPrint: true
    }),
    // extract webpack runtime and module manifest to its own file in order to
    // prevent vendor hash from being updated whenever app bundle is updated
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      chunks: ['vendors']
    }),
    new CompressionPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: /\.js$|\.css$|\.html$/,
      threshold: 10240,
      minRatio: 0.8
    }),
    // Compress extracted CSS. We are using this plugin so that possible
    // duplicated CSS from different components can be deduped.
    new OptimizeCSSPlugin({
      cssProcessorOptions: {
        safe: true
      }
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      generateStatsFile: true,
      openAnalyzer: false,
      reportFilename: resolve("webpack-report/index.html"),
      statsFilename: resolve("webpack-report/stats.json")
    })
  );

  // https://webpack.js.org/configuration/performance
  config.performance = {
    hints: 'warning'
  };
}

module.exports = config;
