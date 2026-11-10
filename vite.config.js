import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：构建产物可直接部署到 GitHub Pages / 任意子路径
  base: './',
  server: {
    port: 5173,
    open: true,
  },
});
