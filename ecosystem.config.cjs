const path = require("path");
const frontendDir = __dirname;
const pocketBaseDir = path.join(__dirname, "pocketbase");
const pocketBaseBinary = path.join(
  pocketBaseDir,
  process.platform === "win32" ? "pocketbase.exe" : "pocketbase",
);

module.exports = {
  apps: [
    {
      name: "billiards-frontend",
      cwd: frontendDir,
      script: "npm",
      args: "run start -- --host 127.0.0.1 --port 3300",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
    },
    {
      name: "billiards-pocketbase",
      cwd: pocketBaseDir,
      script: pocketBaseBinary,
      args: "serve --http=127.0.0.1:8390",
      interpreter: "none",
      autorestart: true,
      watch: false,
    },
  ],
};
