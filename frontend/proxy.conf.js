const PROXY_CONFIG = [
  {
    context: ["/api"],
    target: "http://localhost:8080",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    headers: {
      host: "localhost",
    },
    cookieDomainRewrite: {
      localhost: "localhost",
    },
  },
];
module.exports = PROXY_CONFIG;
