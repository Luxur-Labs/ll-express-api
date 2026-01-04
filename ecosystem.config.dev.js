module.exports = {
  apps: [
    {
      name: 'll-express-api-dev',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false, // Set to true if you want PM2 to watch for file changes (not recommended, use nodemon instead)
      max_memory_restart: '1G', // Higher limit for development
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 20, // More restarts allowed in dev
      restart_delay: 2000, // Faster restart in dev
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

