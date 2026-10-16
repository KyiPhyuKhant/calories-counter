import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const cache = new Map();
const nodes = [];
let overrides = {};

// Host mocks check component contracts; they do not emulate native layout or taps.
function host(type) {
  return function Host(props) {
    nodes.push({ type, props });
    if (type === 'Modal' && !props.visible) return null;
    return React.createElement(type === 'Text' ? 'span' : 'div', null, props.children);
  };
}
export const native = {
  Platform: { OS: 'ios' }, Keyboard: { dismiss() {} },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  StyleSheet: { create: (styles) => styles },
  ...Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ActivityIndicator', 'InputAccessoryView', 'Image', 'Modal', 'ScrollView', 'Switch'].map((name) => [name, host(name)])),
};
const svg = { __esModule: true, default: host('Svg'), ...Object.fromEntries(['Circle', 'Line', 'Rect', 'G', 'Text'].map((name) => [name, host(`Svg${name}`)])) };
const icons = new Proxy({ __esModule: true }, { get: (target, key) => key in target ? target[key] : () => null });

function load(filename) {
  if (filename.endsWith('.png')) return { uri: filename };
  if (filename.endsWith('.json')) return JSON.parse(readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  function resolve(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'react-native') return native;
    if (name === 'react-native-svg') return svg;
    if (name === 'lucide-react-native') return icons;
    if (name === 'react-native-safe-area-context') return { SafeAreaView: host('SafeAreaView') };
    if (name === '@react-native-community/datetimepicker') return { __esModule: true, default: () => null };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const path = name.startsWith('@/') ? join(root, 'src', name.slice(2)) : join(dirname(filename), name);
      const resolved = [path, `${path}.tsx`, `${path}.ts`].find((value) => existsSync(value));
      if (!resolved) throw new Error(`Cannot resolve ${name} from ${filename}`);
      return load(resolved);
    }
    return require(name);
  }
  const evaluate = runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename });
  evaluate(resolve, module, module.exports);
  return module.exports;
}

export function renderUI(component, props) {
  return renderModule(`src/components/ui/${component}.tsx`, component, props);
}

export function renderModule(path, exportName, props, mocks = {}) {
  cache.clear(); overrides = mocks;
  nodes.length = 0;
  const Component = load(join(root, path))[exportName];
  const markup = renderToStaticMarkup(React.createElement(Component, props));
  return { nodes: [...nodes], markup };
}

export function flattenStyle(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}
