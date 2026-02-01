# Synapse AI 视频生成器

使用 Python + MoviePy 自动生成演示视频。

## 安装依赖

```bash
cd video_generator

# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

## 运行生成

```bash
python generate_video.py
```

生成的视频将保存在上级目录：`../synapse-ai-demo.mp4`

## 视频内容

| 场景 | 时长 | 内容 |
|------|------|------|
| 开场 Hook | 3秒 | "你的 AI 助手太烧钱？" |
| Logo展示 | 5秒 | 产品Logo + 核心卖点 |
| 安装演示 | 8秒 | 终端命令展示 |
| 聊天演示 | 10秒 | 交互对话 + 记忆功能 |
| Token对比 | 8秒 | 与 Claude Code 对比图表 |
| 结尾号召 | 6秒 | GitHub 链接 + Star 邀请 |

**总计**: 约40秒精华版（可根据需要调整）

## 自定义

编辑 `generate_video.py` 中的以下函数：
- `create_text_image()` - 文字场景
- `create_logo_scene()` - Logo展示
- `create_terminal_scene()` - 终端界面
- `create_chat_demo_scene()` - 聊天界面
- `create_comparison_chart()` - 对比图表
- `create_github_end_scene()` - 结尾场景

## 注意事项

- 需要安装 ffmpeg：`brew install ffmpeg` (macOS)
- 首次运行会下载 ffmpeg 组件，请耐心等待
- 生成的视频为 1920x1080 @ 30fps

## 进阶：生成完整5分钟视频

如需生成完整5分钟视频，可以：
1. 录制实际终端操作（使用 asciinema）
2. 录制微信界面演示
3. 使用 Premiere/Final Cut 剪辑合并
4. 或者扩展本脚本，添加更多场景
