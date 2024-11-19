require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// 初始化 Express
const app = express();

// 禁用 favicon 请求
app.get("/favicon.ico", (req, res) => res.status(204));

// 启用 CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 连接数据库
connectDB();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API 路由
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: "未找到请求的资源" });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "服务器内部错误" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
