import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: '/Bing-chilling2/',
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['.']
    }
  },
  plugins: [
    {
      name: 'serve-glb-files',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
          const glbIndex = decodedUrl.indexOf('/GLB/');
          if (glbIndex !== -1) {
            const relPath = decodedUrl.substring(glbIndex + 1);
            const filePath = path.join(process.cwd(), relPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      }
    },
    {
      name: 'copy-glb-and-nojekyll',
      closeBundle() {
        const srcDir = path.resolve(process.cwd(), 'GLB');
        const destDir = path.resolve(process.cwd(), 'dist', 'GLB');
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, { recursive: true });
        }
        const nojekyllPath = path.resolve(process.cwd(), 'dist', '.nojekyll');
        fs.writeFileSync(nojekyllPath, '');
      }
    }
  ]
});
