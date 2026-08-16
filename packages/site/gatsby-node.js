/**
 * Configuração do Webpack no Gatsby para ignorar fallbacks do Node.js (module, fs, path)
 * utilizados pelo Emscripten no pacote mldsa-wasm.
 */

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    resolve: {
      fallback: {
        module: false,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
      },
    },
    experiments: {
      asyncWebAssembly: true,
    },
  });
};
