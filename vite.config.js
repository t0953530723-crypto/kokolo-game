import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // 使用相對路徑，確保 GitHub Pages 子目錄能正確讀取資源
    build: {
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1000,
    }
});
