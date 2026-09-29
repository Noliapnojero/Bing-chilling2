import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
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
          if (decodedUrl.startsWith('/GLB/')) {
            const filePath = path.join(process.cwd(), decodedUrl);
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
    }
  ]
});
