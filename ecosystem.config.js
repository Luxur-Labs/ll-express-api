module.exports = {
  apps: [
    {
      name: 'll-express-api',
      script: '/var/www/ll-express-api/dist/index.js',
      cwd: '/var/www/ll-express-api',
      instances: 1, // Use 'max' for cluster mode, or number for specific instances
      exec_mode: 'fork', // Use 'cluster' for load balancing
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logging
      error_file: '/var/www/ll-express-api/logs/pm2-error.log',
      out_file: '/var/www/ll-express-api/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false, // Set to true only in development
      max_memory_restart: '500M',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};

