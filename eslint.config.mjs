import nextConfig from 'eslint-config-next/core-web-vitals';
import tsConfig from 'eslint-config-next/typescript';

export default [
  ...nextConfig,
  ...tsConfig,
];
