module.exports = {
  apps: [
    {
      name: "tidyagent",
      cwd: __dirname,
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "5070",
        // Localhost only — nginx on :443 proxies here. Do not bind 0.0.0.0 or dev ports stay public.
        HOST: "127.0.0.1",
      },
    },
  ],
};
