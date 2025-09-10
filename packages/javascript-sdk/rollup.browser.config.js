
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import terser from '@rollup/plugin-terser';

export default [
  {
    input: 'src/index.browser.ts',
    output: [
      {
        file: 'dist/index.browser.cjs.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.browser.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      alias({
        entries: [
          { find: './auth', replacement: './auth/index.browser' },
        ]
      }),
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser(),
    ],
  },
];
