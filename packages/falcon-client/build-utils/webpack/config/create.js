const path = require('path');
const fs = require('fs-extra');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const StartServerPlugin = require('start-server-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackBar = require('webpackbar');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const VirtualModulesPlugin = require('webpack-virtual-modules');
const FalconI18nLocalesPlugin = require('@deity/falcon-i18n-webpack-plugin');
const NormalModuleOverridePlugin = require('@deity/normal-module-override-webpack-plugin');
const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const LoadablePlugin = require('@loadable/webpack-plugin');
const { colors } = require('./../tools');
const { buildClientEnv, serializeEnvVariables } = require('./env');
const runPlugin = require('./runPlugin');

const falconClientPolyfills = require.resolve('./../../polyfills');

/**
 * Create RegExp filter based on provided modules names
 * @param {string[]} modules module names to filter on
 * @returns {RegExp} RegExp filter
 */
function moduleFilter(modules) {
  return new RegExp(`[\\\\/]node_modules[\\\\/](${modules.map(x => x.replace('/', '[\\\\/]')).join('|')})[\\\\/]`);
}

/**
 * @param {import('../../paths')} paths
 * @param {boolean} isDev
 */
function getESLintLoader(paths, isDev) {
  return fs.existsSync(paths.appEslintRc)
    ? {
        test: /\.(js|jsx|mjs)$/,
        include: paths.appSrc,
        use: [
          {
            loader: require.resolve('eslint-loader'),
            options: {
              eslintPath: require.resolve('eslint'),
              formatter: require('react-dev-utils/eslintFormatter'),
              ignore: false,
              useEslintrc: true,
              emitWarning: isDev
            }
          }
        ],
        enforce: 'pre'
      }
    : undefined;
}

/**
 *
 * @param {string[]} appBabelConfigs
 */
function getBabelLoaderOptions(appBabelConfigs) {
  const babelConfigFile = appBabelConfigs.find(x => fs.existsSync(x));
  if (babelConfigFile) {
    return {
      configFile: babelConfigFile,
      presets: []
    };
  }

  return {
    presets: [require.resolve('@deity/babel-preset-falcon-client')]
  };
}

/**
 * @param {'web' | 'node' } target
 * @param {'development' | 'production'} env
 * @param {object} cssLoaderOptions
 */
function getStyleLoaders(target, env, cssLoaderOptions) {
  const { minimize, ...restOptions } = cssLoaderOptions;
  const sourceMap = cssLoaderOptions.sourceMap || false;

  // "postcss" loader applies autoprefixer to our CSS.
  // "css" loader resolves paths in CSS and adds assets as dependencies.
  // "style" loader turns CSS into JS modules that inject <style> tags.
  // In production, we use a plugin to extract that CSS to a file, but
  // in development "style" loader enables hot editing of CSS.

  if (target === 'node') {
    // Style-loader does not work in Node.js without some crazy magic. Luckily we just need css-loader.
    return [
      {
        loader: require.resolve('css-loader'),
        options: {
          ...restOptions,
          onlyLocals: true
        }
      }
    ];
  }

  return [
    env === 'production' ? MiniCssExtractPlugin.loader : require.resolve('style-loader'),
    {
      loader: require.resolve('css-loader'),
      options: { ...restOptions }
    },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        ident: 'postcss',
        plugins: () => [
          require('postcss-flexbugs-fixes'),
          require('postcss-preset-env')({
            autoprefixer: { flexbox: 'no-2009' },
            stage: 3
          }),
          require('cssnano')({ preset: 'default' })
        ],
        sourceMap
      }
    }
  ];
}

/**
 * @typedef {object} CreateWebpackOptions
 * @property {string} inspect
 * @property {boolean} analyze
 * @property {import('../../paths')} paths
 * @property {string} publicPath default is `/`
 * @property {boolean} startDevServer has effect only when `process.env.NODE_ENV === 'development'`
 * @property {import('../tools').FalconClientBuildConfig} buildConfig
 */

/**
 * Webpack configuration factory. It's the juice!
 * @param {'web' | 'node' } target
 * @param {CreateWebpackOptions} options
 * @returns {object} webpack configuration
 */
module.exports = (target = 'web', options) => {
  options = { ...options, publicPath: options.publicPath || '/' };

  const { NODE_ENV } = process.env;
  const IS_NODE = target === 'node';
  const IS_WEB = target === 'web';
  const IS_PROD = NODE_ENV === 'production';
  const IS_DEV = NODE_ENV === 'development';

  const { paths, publicPath, startDevServer, buildConfig } = options;
  const START_DEV_SERVER = IS_DEV ? startDevServer : false;
  const { devServerPort, useWebmanifest, plugins, modify, i18n, moduleOverride } = buildConfig;

  const devtool = 'source-map';
  const devServerUrl = `http://localhost:${devServerPort}/`;
  const serializedClientEnv = serializeEnvVariables(
    buildClientEnv(target, NODE_ENV, publicPath, paths, START_DEV_SERVER, devServerPort, buildConfig.envToBuildIn)
  );

  let config = {
    mode: IS_DEV ? 'development' : 'production',
    context: process.cwd(), // Set webpack context to the current command's directory
    target,
    devtool,
    // webpack needs to known how to resolve both falcon-client's and the app's node_modules, so we use resolve and resolveLoader.
    resolve: {
      modules: ['node_modules', paths.appNodeModules].concat(paths.nodePath.split(path.delimiter).filter(Boolean)),
      extensions: ['.mjs', '.jsx', '.js', '.json', '.graphql', '.gql'],
      alias: {
        'webpack/hot/poll': require.resolve('webpack/hot/poll'), // This is required so symlinks work during development.
        // Support React Native Web https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
        'react-native': 'react-native-web',
        src: paths.appSrc,
        'app-path': paths.appPath,
        'app-webmanifest': useWebmanifest ? paths.appWebmanifest : paths.ownWebmanifest
      }
    },
    resolveLoader: { modules: [paths.appNodeModules, paths.ownNodeModules] },
    module: {
      strictExportPresence: true,
      rules: [
        // Disable require.ensure as it's not a standard language feature.
        // { parser: { requireEnsure: false } },
        {
          test: /\.(js|jsx|mjs)$/,
          use: { loader: require.resolve('source-map-loader') },
          enforce: 'pre'
        },
        getESLintLoader(paths, IS_DEV),
        // Avoid "require is not defined" errors
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto'
        },
        {
          test: /\.(js|jsx|mjs)$/,
          include: [paths.appSrc, paths.ownSrc],
          use: [
            {
              loader: require.resolve('babel-loader'),
              options: getBabelLoaderOptions(paths.appBabelConfigs)
            }
          ]
        },
        {
          test: /\.(graphql|gql)$/,
          include: [paths.appSrc, paths.ownSrc],
          use: [{ loader: require.resolve('graphql-tag/loader') }]
        },
        {
          exclude: [
            /\.(js|jsx|mjs)$/,
            /\.(ts|tsx)$/,
            /\.(graphql|gql)$/,
            /\.(less)$/,
            /\.(css|scss|sass)$/,
            /\.json$/,
            /\.html$/,
            /\.(vue)$/,
            /\.(re)$/,
            /\.(webmanifest|browserconfig)$/
          ],
          loader: require.resolve('file-loader'),
          options: {
            name: 'static/media/[name].[hash:8].[ext]',
            emitFile: IS_WEB
          }
        },
        IS_WEB && {
          test: /(manifest\.webmanifest|browserconfig\.xml)$/,
          include: [paths.appSrc],
          use: [
            {
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/[name].[hash:8].[ext]',
                emitFile: useWebmanifest
              }
            },
            { loader: require.resolve('app-manifest-loader') }
          ]
        },
        {
          test: /\.css$/,
          exclude: [paths.appBuild, /\.module\.css$/],
          use: getStyleLoaders(target, NODE_ENV, {
            importLoaders: 1,
            minimize: IS_PROD,
            sourceMap: !!devtool
          }),
          sideEffects: true // remove this when webpack adds a warning / error for this. See https://github.com/webpack/webpack/issues/6571
        },
        {
          test: /\.module\.css$/,
          exclude: [paths.appBuild],
          use: getStyleLoaders(target, NODE_ENV, {
            importLoaders: 1,
            modules: 'global',
            minimize: IS_PROD,
            getLocalIdent: getCSSModuleLocalIdent,
            sourceMap: !!devtool
          }),
          sideEffects: true // remove this when webpack adds a warning / error for this. See https://github.com/webpack/webpack/issues/6571
        },
        {
          test: /\.(scss|sass)$/,
          exclude: /\.module\.(scss|sass)$/,
          use: [
            ...getStyleLoaders(target, NODE_ENV, {
              importLoaders: 2,
              minimize: IS_PROD,
              sourceMap: !!devtool
            }),
            IS_WEB && require.resolve('sass-loader')
          ].filter(x => x),
          sideEffects: true // remove this when webpack adds a warning / error for this. See https://github.com/webpack/webpack/issues/6571
        },
        {
          test: /\.module\.(scss|sass)$/,
          use: [
            ...getStyleLoaders(target, NODE_ENV, {
              importLoaders: 2,
              modules: 'global',
              minimize: IS_PROD,
              getLocalIdent: getCSSModuleLocalIdent,
              sourceMap: !!devtool
            }),
            IS_WEB && require.resolve('sass-loader')
          ].filter(x => x),
          sideEffects: true // remove this when webpack adds a warning / error for this. See https://github.com/webpack/webpack/issues/6571
        }
      ].filter(x => x)
    }
  };

  if (IS_NODE) {
    // We want to uphold node's __filename, and __dirname.
    config.node = {
      __console: false,
      __dirname: false,
      __filename: false
    };

    config.output = {
      path: paths.appBuild,
      publicPath: START_DEV_SERVER ? devServerUrl : '/',
      filename: 'server.js',
      libraryTarget: 'commonjs2'
    };

    config.plugins = [
      new webpack.DefinePlugin(serializedClientEnv),
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })
    ];

    config.entry = [paths.ownServerIndexJs];

    if (IS_DEV) {
      config.entry = [
        require.resolve('../prettyNodeErrors'),
        START_DEV_SERVER && 'webpack/hot/poll?300',
        ...config.entry
      ].filter(x => x);

      if (START_DEV_SERVER) {
        config.watch = true;

        config.plugins = [
          ...config.plugins,
          new webpack.HotModuleReplacementPlugin(),
          new StartServerPlugin({
            name: 'server.js',
            nodeArgs: [options.inspect].filter(x => x)
          }),
          new webpack.WatchIgnorePlugin([paths.appWebpackAssets])
        ];
      }
    }
  }

  if (IS_WEB) {
    config.entry = {
      client: [
        falconClientPolyfills,
        require.resolve('pwacompat'),
        paths.ownClientIndexJs,
        START_DEV_SERVER && require.resolve('./../webpackHotDevClient')
      ].filter(x => x)
    };

    config.output = {
      path: paths.appBuildPublic,
      publicPath: START_DEV_SERVER ? devServerUrl : options.publicPath,
      libraryTarget: 'var'
    };

    config.optimization = {
      splitChunks: {
        cacheGroups: {
          polyfills: {
            name: 'polyfills',
            enforce: true,
            priority: 100,
            chunks: 'initial',
            test: moduleFilter(['core-js', 'whatwg-fetch', 'pwacompat'])
          },
          vendor: {
            name: 'vendors',
            enforce: true,
            chunks: 'initial',
            test: moduleFilter([
              'apollo-cache-inmemory',
              'apollo-client',
              'apollo-link',
              'apollo-link-http',
              'apollo-utilities',
              'i18next',
              'i18next-xhr-backend',
              'react',
              'react-apollo',
              'react-dom',
              'react-google-tag-manager',
              `react-helmet`,
              'react-router',
              'react-router-dom',
              'history'
            ])
          }
        }
      }
    };

    config.plugins = [
      new VirtualModulesPlugin({ [paths.ownWebmanifest]: '{}' }),
      new FalconI18nLocalesPlugin({
        mainSource: path.join(paths.appPath, 'i18n'),
        defaultSources: (i18n.resourcePackages || []).map(x => path.join(paths.resolvePackageDir(x), 'i18n')),
        output: 'build/i18n',
        filter: i18n.filter || {}
      }),
      new LoadablePlugin({
        outputAsset: false,
        filename: path.basename(paths.appWebpackAssets),
        writeToDisk: { filename: path.dirname(paths.appWebpackAssets) }
      })
    ];
    if (options.analyze) {
      config.plugins.push(new BundleAnalyzerPlugin());
    }

    if (IS_DEV) {
      config.output = {
        ...config.output,
        filename: 'static/js/[name].js',
        chunkFilename: 'static/js/[name].chunk.js',
        pathinfo: true,
        devtoolModuleFilenameTemplate: info => path.resolve(info.resourcePath).replace(/\\/g, '/')
      };

      if (START_DEV_SERVER) {
        // configure webpack-dev-server to serve client-side bundle from http://localhost:${devServerPort}
        config.devServer = {
          disableHostCheck: true,
          clientLogLevel: 'none',
          compress: true, // enable gzip compression of generated files
          // watchContentBase: true,
          headers: { 'Access-Control-Allow-Origin': '*' },
          historyApiFallback: {
            // Paths with dots should still use the history fallback. See https://github.com/facebookincubator/create-react-app/issues/387.
            disableDotRule: true
          },
          host: 'localhost',
          port: devServerPort,
          hot: true,
          noInfo: true,
          overlay: false,
          quiet: true,
          // By default files from `contentBase` will not trigger a page reload.
          // Reportedly, this avoids CPU overload on some systems. https://github.com/facebookincubator/create-react-app/issues/293
          watchOptions: {
            ignored: /node_modules/
          },
          before(app) {
            app.use(errorOverlayMiddleware()); // this lets us open files from the runtime error overlay.
          }
        };
      }

      config.plugins = [
        ...config.plugins,
        START_DEV_SERVER && new webpack.HotModuleReplacementPlugin({ multiStep: true }),
        new webpack.DefinePlugin(serializedClientEnv)
      ].filter(x => x);
    } else {
      config.output = {
        ...config.output,
        filename: 'static/js/[name].[hash:8].js',
        chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js'
      };

      config.plugins = [
        ...config.plugins,
        new webpack.DefinePlugin(serializedClientEnv),
        // Extract our CSS into a files.
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css'
        }),
        new webpack.HashedModuleIdsPlugin(),
        new webpack.optimize.AggressiveMergingPlugin()
      ];

      config.optimization = {
        ...config.optimization,
        minimize: true,
        minimizer: [
          new UglifyJsPlugin({
            uglifyOptions: {
              parse: {
                // we want uglify-js to parse ecma 8 code. However, we don't want it
                // to apply any minfication steps that turns valid ecma 5 code
                // into invalid ecma 5 code. This is why the 'compress' and 'output'
                // sections only apply transformations that are ecma 5 safe
                // https://github.com/facebook/create-react-app/pull/4234
                ecma: 8
              },
              compress: {
                ecma: 5,
                warnings: false,
                // Disabled because of an issue with Uglify breaking seemingly valid code:
                // https://github.com/facebook/create-react-app/issues/2376
                // Pending further investigation:
                // https://github.com/mishoo/UglifyJS2/issues/2011
                comparisons: false
              },
              mangle: {
                safari10: true
              },
              output: {
                ecma: 5,
                comments: false,
                // Turned on because emoji and regex is not minified properly using default
                // https://github.com/facebook/create-react-app/issues/2488
                ascii_only: true
              }
            },
            // Use multi-process parallel running to improve the build speed
            // Default number of concurrent runs: os.cpus().length - 1
            parallel: true,
            sourceMap: !!devtool
          })
        ]
      };
    }
  }

  config.plugins = [
    ...config.plugins,
    new NormalModuleOverridePlugin(moduleOverride),
    new WebpackBar({
      fancy: !buildConfig.CI,
      color: colors.deityGreen,
      name: IS_WEB ? 'client' : 'server'
    })
  ];

  // Apply razzle plugins, if they are present in razzle.config.js
  if (Array.isArray(plugins)) {
    plugins.forEach(plugin => {
      config = runPlugin(plugin, config, { ...options, target, dev: IS_DEV }, webpack);
    });
  }

  // Check if razzle.config has a modify function. If it does, call it on the
  // configs we created.
  if (modify) {
    config = modify(config, { ...options, target, dev: IS_DEV }, webpack);
  }

  return config;
};
