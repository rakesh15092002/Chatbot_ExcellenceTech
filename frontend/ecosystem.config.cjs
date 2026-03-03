module.exports = {
  apps: [{
    name: 'rag-ui-new',
    script: 'server.cjs',
    cwd: '/home/newjoinee/Chatbot_ExcellenceTech/frontend',
    interpreter: '/home/newjoinee/.nvm/versions/node/v20.20.0/bin/node',
    out_file: '/home/newjoinee/.pm2/logs/rag-ui-new-out.log',
    error_file: '/home/newjoinee/.pm2/logs/rag-ui-new-error.log'
  }]
}
