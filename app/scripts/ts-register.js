// Lets plain Node run the app's pure TypeScript (src/game/**) without a bundler:
// .ts files are compiled with Babel on require, and `@/…` resolves to src/.
// Used by `npm run winrate`. Only for code with no React Native imports.

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const SRC = path.resolve(__dirname, '..', 'src');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(SRC, request.slice(2)) : request;
  try {
    return resolveFilename.call(this, mapped, parent, ...rest);
  } catch (error) {
    // Extensionless TypeScript imports: try .ts, then an index.ts.
    const base = path.isAbsolute(mapped) ? mapped : parent ? path.resolve(path.dirname(parent.filename), mapped) : mapped;
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    throw error;
  }
};

Module._extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: 'inline',
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  module._compile(code, filename);
};
