const express = require("express");
const router = express.Router();
const Player = require("../models/player");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/admin");
const Setting = require("../models/setting");
const auth = require("../middleware/auth");

// JWT 密钥，应该存储在环境变量中
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// 获取所有玩家与分数
router.get("/get-all", async (req, res) => {
  try {
    const players = await Player.find({}, "name score");
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取单个玩家分数
router.get("/get-single", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: "请提供玩家名称" });
    }

    const player = await Player.findOne({ name });
    if (!player) {
      return res.json({ score: 0 });
    }

    res.json({ score: player.score });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 修改玩家分数
router.put("/update", async (req, res) => {
  try {
    const { name, newScore } = req.body;
    if (!name || newScore === undefined) {
      return res.status(400).json({ message: "请提供玩家名称和新分数" });
    }

    let player = await Player.findOne({ name });

    if (!player) {
      // 如果玩家不存在，创建新玩家
      player = new Player({
        name: name,
        score: newScore,
      });
      await player.save();
      return res.status(201).json(player);
    }

    // 如果玩家存在，更新分数
    player.score = newScore;
    await player.save();
    res.json(player);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 搜索玩家名称
router.get("/search-names", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    // 使用正则表达式进行模糊搜索
    // 'i' 表示不区分大小写
    const players = await Player.find(
      {
        name: {
          $regex: q,
          $options: "i",
        },
      },
      "name" // 只返回 name 字段
    );

    // 将查询结果转换为名称数组
    const names = players.map((player) => player.name);

    res.json(names);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 检查是否需要初始化
router.get("/check-init", async (req, res) => {
  try {
    const admin = await Admin.findOne({});
    console.log("检查初始化状态:", admin ? "已初始化" : "未初始化");
    res.json({
      needInit: !admin,
    });
  } catch (error) {
    console.error("检查初始化错误:", error);
    res.status(500).json({ message: error.message });
  }
});

// 初始化管理员密码
router.post("/init-password", async (req, res) => {
  try {
    // 检查是否已经初始化
    const existingAdmin = await Admin.findOne({});
    if (existingAdmin) {
      console.log("初始化失败: 已存在管理员");
      return res.status(400).json({ message: "系统已经初始化" });
    }

    const { password } = req.body;

    // 验证密码长度
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "密码长度至少6位" });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建管理员记录
    const admin = new Admin({
      password: hashedPassword,
    });
    await admin.save();
    console.log("成功创建管理员账户");

    // 生成 JWT token
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ token });
  } catch (error) {
    console.error("初始化密码错误:", error);
    res.status(500).json({ message: error.message });
  }
});

// 管理员认证
router.post("/auth", async (req, res) => {
  try {
    const { password } = req.body;

    // 获取管理员记录
    const admin = await Admin.findOne({});
    if (!admin) {
      console.log("认证失败: 系统未初始化");
      return res.status(401).json({ message: "系统未初始化" });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log("认证失败: 密码错误");
      return res.status(401).json({ message: "密码错误" });
    }

    console.log("认证成功");
    // 生成新的 JWT token
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ token });
  } catch (error) {
    console.error("认证错误:", error);
    res.status(500).json({ message: error.message });
  }
});

// 获取设置
router.get("/settings", auth, async (req, res) => {
  try {
    const setting = await Setting.findOne({});

    // 如果设置不存在，返回默认值
    if (!setting) {
      return res.json({
        horsePoints: [0, 0, 0, 0],
        returnPoint: 0,
      });
    }

    res.json({
      horsePoints: setting.horsePoints,
      returnPoint: setting.returnPoint,
    });
  } catch (error) {
    console.error("获取设置错误:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新设置
router.post("/settings", auth, async (req, res) => {
  try {
    const { horsePoints, returnPoint } = req.body;

    // 验证数据格式
    if (
      !Array.isArray(horsePoints) ||
      horsePoints.length !== 4 ||
      !horsePoints.every((num) => Number.isInteger(num)) ||
      !Number.isInteger(returnPoint)
    ) {
      return res.status(400).json({ message: "无效的设置数据" });
    }

    // 更新或创建设置
    await Setting.findOneAndUpdate(
      {}, // 空条件，匹配第一个文档
      {
        horsePoints,
        returnPoint,
      },
      {
        upsert: true, // 如果不存在则创建
        new: true, // 返回更新后的文档
        runValidators: true, // 运行验证器
      }
    );

    res.json({ message: "设置保存成功" });
  } catch (error) {
    console.error("保存设置错误:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "无效的设置数据" });
    }
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 清空所有玩家分数
router.post("/reset-scores", auth, async (req, res) => {
  try {
    const { password } = req.body;

    // 获取管理员记录
    const admin = await Admin.findOne({});
    if (!admin) {
      return res.status(401).json({ message: "系统未初始化" });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "密码错误" });
    }

    // 将所有玩家分数设置为0
    await Player.updateMany(
      {}, // 匹配所有玩家
      { score: 0 } // 设置分数为0
    );

    res.json({ message: "所有分数已清零" });
  } catch (error) {
    console.error("清空分数错误:", error);
    res.status(500).json({ message: "服务器错误" });
  }
});

// 修改管理员密码
router.post("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // 验证新密码长度
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: "新密码长度至少为6位",
      });
    }

    // 获取管理员记��
    const admin = await Admin.findOne({});
    if (!admin) {
      return res.status(500).json({
        message: "服务器错误",
      });
    }

    // 验证当前密码
    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "当前密码错误",
      });
    }

    // 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码
    admin.password = hashedPassword;
    await admin.save();

    // 生成新的 JWT token
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "密码修改成功",
      token,
    });
  } catch (error) {
    console.error("修改密码错误:", error);
    res.status(500).json({
      message: "服务器错误",
    });
  }
});

// 删除所有玩家
router.post("/delete-all-players", auth, async (req, res) => {
  try {
    const { password } = req.body;

    // 获取管理员记录
    const admin = await Admin.findOne({});
    if (!admin) {
      return res.status(500).json({
        message: "服务器错误",
      });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "密码错误",
      });
    }

    // 删除所有玩家数据
    await Player.deleteMany({});

    res.json({
      message: "所有玩家数据已删除",
    });
  } catch (error) {
    console.error("删除玩家数据错误:", error);
    res.status(500).json({
      message: "服务器错误",
    });
  }
});

module.exports = router;
