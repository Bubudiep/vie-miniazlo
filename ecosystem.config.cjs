const path = require("path");
const frontendDir = __dirname;
const pocketBaseDir = path.join(__dirname, "pocketbase");
try {
  process.loadEnvFile(path.join(frontendDir, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const pocketBaseBinary = process.platform === "win32"
  ? path.join(pocketBaseDir, "pocketbase.exe")
  : path.join(pocketBaseDir, "pocketbase");

module.exports = {
  apps: [
    {
      name: "billiards-frontend",
      cwd: frontendDir,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3300",
      },
      autorestart: true,
      watch: false,
    },
    {
      name: "billiards-pocketbase",
      cwd: pocketBaseDir,
      script: pocketBaseBinary,
      args: "serve --http=127.0.0.1:8390 --dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks",
      interpreter: "none",
      env: process.env.SEPAY_WEBHOOK_SECRET ? { SEPAY_WEBHOOK_SECRET: process.env.SEPAY_WEBHOOK_SECRET } : {},
      autorestart: true,
      watch: false,
    },
  ],
};
