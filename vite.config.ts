import { defineConfig } from 'vite';
import wgsl from 'vite-plugin-wgsl';

export default defineConfig({
  server: { port: parseInt(process.env.PORT ?? '5173') },
  plugins: [wgsl({ include: ['**/*.wgsl'] })],
});
