const PROXY_CONFIG = {
  "/api": {
    target: "http://localhost:8080",
    secure: false,
    changeOrigin: true,
  },
};

module.exports = PROXY_CONFIG;
