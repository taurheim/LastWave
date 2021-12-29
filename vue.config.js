module.exports = {
  configureWebpack: config => {
    // See https://github.com/shutterstock/rickshaw/issues/52
    if (config.optimization) {
      config.optimization.minimizer[0].options.uglifyOptions.mangle = {
        reserved: ["$super"],
        safari10: true,
      }
    }
  },
  publicPath: '/lastwave',
  outputDir: undefined,
  assetsDir: undefined,
  runtimeCompiler: undefined,
  productionSourceMap: undefined,
  parallel: undefined,
  css: undefined
};
