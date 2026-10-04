FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DOCS_DIR=/app/docs
COPY --chown=node:node package.json server.mjs content-store.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node docs ./docs
COPY --chown=node:node scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
