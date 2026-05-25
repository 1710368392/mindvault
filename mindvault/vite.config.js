import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { resolve } from 'path';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    root: 'src/renderer',
    base: '/',
    build: {
        outDir: '../../dist/renderer',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/renderer/index.html'),
                'music-player': resolve(__dirname, 'src/renderer/music-player.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@renderer': path.resolve(__dirname, 'src/renderer'),
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
