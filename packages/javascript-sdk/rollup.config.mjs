import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import { dts } from 'rollup-plugin-dts';
import alias from '@rollup/plugin-alias';
import path from 'path';

const pkg = require('./package.json');

const external = ['cross-fetch','eventemitter3', 'fs/promises', 'path',...Object.keys(pkg.peerDependencies || {})];
console.log("External dependencies:", external);

const globals = {
  'cross-fetch': 'fetch',
  'eventemitter3': 'EventEmitter3'
};

const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * 
 * Copyright (c) 2024 Schlep-engine
 * Licensed under ${pkg.license}
 */`;

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    external,
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      banner
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        sourceMap: true
      })
    ]
  },

  // CommonJS build  
  {
    input: 'src/index.ts',
    external,
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      banner,
      exports: 'named'
    },
    plugins: [
      resolve({
        browser: false,
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        sourceMap: true
      })
    ]
  },

  // UMD build for browsers
  {
    input: 'src/index.browser.ts',
    external: Object.keys(globals),
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'SchlepEngine',
      sourcemap: true,
      banner,
      globals
    },
    plugins: [
      alias({
        entries: [
          
        ]
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        sourceMap: true
      }),
      terser({
        output: {
          comments: /^!/
        }
      })
    ]
  },

  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'es'
    },
    plugins: [
      dts({
        respectExternal: true
      })
    ]
  }
];