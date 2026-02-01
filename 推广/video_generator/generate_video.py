#!/usr/bin/env python3
"""
Synapse AI 演示视频生成器
基于 moviepy 自动生成推广视频

安装依赖:
/usr/bin/python3 -m pip install moviepy pillow numpy --user
"""

import os
import sys
from moviepy import *
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# 配置
OUTPUT_DIR = "/Users/ricardo/Documents/公司学习文件/Kimi_Agent_Clawdbot 轻量化改造/synapse-ai/推广"
RESOLUTION = (1920, 1080)  # 1080p
FPS = 30

# 颜色主题
COLORS = {
    'bg_dark': '#0F172A',
    'primary': '#3B82F6',
    'secondary': '#10B981',
    'accent': '#F59E0B',
    'text': '#F8FAFC',
    'text_muted': '#94A3B8'
}

def hex_to_rgb(hex_color):
    """将 hex 颜色转换为 RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_text_image(text, size=RESOLUTION, font_size=60, color=COLORS['text'], 
                      bg_color=COLORS['bg_dark'], subtext=None):
    """创建文字图片"""
    img = Image.new('RGB', size, hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)
    
    # 尝试使用系统字体
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ]
    
    font_large = None
    font_small = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font_large = ImageFont.truetype(path, font_size)
                font_small = ImageFont.truetype(path, font_size//2)
                break
            except:
                continue
    
    if font_large is None:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # 主文字
    bbox = draw.textbbox((0, 0), text, font=font_large)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2 - 50 if subtext else (size[1] - text_height) // 2
    draw.text((x, y), text, fill=hex_to_rgb(color), font=font_large)
    
    # 副文字
    if subtext:
        bbox2 = draw.textbbox((0, 0), subtext, font=font_small)
        text_width2 = bbox2[2] - bbox2[0]
        x2 = (size[0] - text_width2) // 2
        y2 = y + text_height + 40
        draw.text((x2, y2), subtext, fill=hex_to_rgb(COLORS['text_muted']), font=font_small)
    
    return np.array(img)

def create_comparison_chart():
    """创建Token消耗对比图"""
    img = Image.new('RGB', RESOLUTION, hex_to_rgb(COLORS['bg_dark']))
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    
    font_title = font_label = font_num = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font_title = ImageFont.truetype(path, 48)
                font_label = ImageFont.truetype(path, 32)
                font_num = ImageFont.truetype(path, 28)
                break
            except:
                continue
    
    if font_title is None:
        font_title = font_label = font_num = ImageFont.load_default()
    
    # 标题
    title = "同样的代码审查任务 - Token 消耗对比"
    bbox = draw.textbbox((0, 0), title, font=font_title)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0])) // 2
    draw.text((x, 80), title, fill=hex_to_rgb(COLORS['text']), font=font_title)
    
    # 数据
    data = [
        ("Claude Code", 15000, "#EF4444", "$0.45"),
        ("Cursor", 10000, "#F59E0B", "$0.30"),
        ("Synapse AI", 5000, "#10B981", "$0.15 节省60%")
    ]
    
    max_tokens = 15000
    bar_max_width = 800
    start_y = 250
    bar_height = 80
    gap = 120
    
    for i, (name, tokens, color, cost) in enumerate(data):
        y = start_y + i * gap
        bar_width = int((tokens / max_tokens) * bar_max_width)
        
        # 标签
        draw.text((150, y+20), name, fill=hex_to_rgb(COLORS['text']), font=font_label)
        
        # 柱状图背景
        draw.rectangle([400, y, 400+bar_max_width, y+bar_height], 
                      fill=hex_to_rgb('#1E293B'), outline=hex_to_rgb('#334155'), width=2)
        
        # 柱状图
        draw.rectangle([400, y, 400+bar_width, y+bar_height], 
                      fill=hex_to_rgb(color))
        
        # Token 数值
        draw.text((420+bar_max_width+20, y+25), f"{tokens:,} tokens", 
                 fill=hex_to_rgb(COLORS['text']), font=font_num)
        
        # 成本
        cost_x = 420+bar_max_width+250
        draw.text((cost_x, y+25), cost, fill=hex_to_rgb(color), font=font_num)
    
    return np.array(img)

def create_logo_scene():
    """创建Logo展示场景"""
    img = Image.new('RGB', RESOLUTION, hex_to_rgb(COLORS['bg_dark']))
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    
    font_logo = font_tagline = font_features = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font_logo = ImageFont.truetype(path, 120)
                font_tagline = ImageFont.truetype(path, 48)
                font_features = ImageFont.truetype(path, 36)
                break
            except:
                continue
    
    if font_logo is None:
        font_logo = font_tagline = font_features = ImageFont.load_default()
    
    # 绘制Logo圆圈
    center_x, center_y = RESOLUTION[0]//2, 280
    radius = 100
    draw.ellipse([center_x-radius, center_y-radius, 
                  center_x+radius, center_y+radius], 
                 fill=hex_to_rgb(COLORS['primary']), 
                 outline=hex_to_rgb(COLORS['secondary']), width=8)
    
    # 产品名
    name = "Synapse AI"
    bbox = draw.textbbox((0, 0), name, font=font_logo)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
    draw.text((x, 430), name, fill=hex_to_rgb(COLORS['text']), font=font_logo)
    
    # 标语
    tagline = "轻量级个人 AI 助手"
    bbox = draw.textbbox((0, 0), tagline, font=font_tagline)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
    draw.text((x, 580), tagline, fill=hex_to_rgb(COLORS['text_muted']), font=font_tagline)
    
    # 核心卖点
    features = [
        "✓ Token 消耗降低 60%",
        "✓ 完全开源免费", 
        "✓ 微信机器人集成",
        "✓ 本地优先，隐私保护"
    ]
    y_start = 700
    for i, feature in enumerate(features):
        bbox = draw.textbbox((0, 0), feature, font=font_features)
        x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
        draw.text((x, y_start + i*60), feature, fill=hex_to_rgb(COLORS['secondary']), font=font_features)
    
    return np.array(img)

def create_terminal_scene():
    """创建终端命令场景"""
    img = Image.new('RGB', RESOLUTION, hex_to_rgb('#1E1E1E'))
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        "/System/Library/Fonts/SF-Mono-Regular.otf",
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Courier.dfont"
    ]
    
    font = font_bold = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, 28)
                font_bold = ImageFont.truetype(path, 32)
                break
            except:
                continue
    
    if font is None:
        font = font_bold = ImageFont.load_default()
    
    # 终端标题栏
    draw.rectangle([0, 0, RESOLUTION[0], 40], fill=hex_to_rgb('#323232'))
    
    # 红绿灯
    draw.ellipse([20, 12, 36, 28], fill=hex_to_rgb('#FF5F56'))
    draw.ellipse([46, 12, 62, 28], fill=hex_to_rgb('#FFBD2E'))
    draw.ellipse([72, 12, 88, 28], fill=hex_to_rgb('#27C93F'))
    
    # 终端内容
    commands = [
        ("$ ", "#6CC644"),
        ("git clone https://github.com/Ricardo-M-L/synapse-ai.git", "#F8FAFC"),
        ("", ""),
        ("$ ", "#6CC644"),
        ("cd synapse-ai && npm install", "#F8FAFC"),
        ("", ""),
        ("$ ", "#6CC644"),
        ("npm run build", "#F8FAFC"),
        ("✓ Built successfully in 2.34s", "#10B981"),
        ("", ""),
        ("$ ", "#6CC644"),
        ("npm run cli -- chat", "#F8FAFC"),
        ("", ""),
        ("🧠 Synapse AI 已启动！", "#3B82F6"),
        ("提示: 输入 /help 查看可用命令", "#94A3B8"),
        ("synapse> ", "#F59E0B"),
    ]
    
    x, y = 40, 80
    for text, color in commands:
        if text:
            draw.text((x, y), text, fill=hex_to_rgb(color), font=font)
            y += 40
    
    return np.array(img)

def create_chat_demo_scene():
    """创建聊天演示场景"""
    img = Image.new('RGB', RESOLUTION, hex_to_rgb(COLORS['bg_dark']))
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    
    font_title = font_msg = font_small = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font_title = ImageFont.truetype(path, 36)
                font_msg = ImageFont.truetype(path, 24)
                font_small = ImageFont.truetype(path, 20)
                break
            except:
                continue
    
    if font_title is None:
        font_title = font_msg = font_small = ImageFont.load_default()
    
    # 标题栏
    draw.rectangle([0, 0, RESOLUTION[0], 70], fill=hex_to_rgb('#1E293B'))
    draw.text((40, 20), "Synapse AI Chat", fill=hex_to_rgb(COLORS['text']), font=font_title)
    draw.text((RESOLUTION[0]-350, 25), "Token: 245 | $0.007", 
             fill=hex_to_rgb(COLORS['secondary']), font=font_small)
    
    # 对话内容
    messages = [
        ("user", "帮我写一个 Python 脚本，批量重命名文件"),
        ("ai", "好的，这是一个使用 os 模块的脚本：\n\nimport os\ndef batch_rename(folder):\n    for f in os.listdir(folder):\n        ..."),
        ("user", "昨天说的用户系统方案还有吗？"),
        ("ai", "当然记得！昨天的用户认证方案：\n\n1. JWT Token + Refresh\n2. Redis 存储会话\n3. 支持多端登录\n\n需要展开哪部分？"),
    ]
    
    y = 120
    padding = 15
    max_width = 700
    
    for role, content in messages:
        is_user = role == "user"
        
        # 估算高度
        lines = content.split('\n')
        line_height = 30
        box_height = len(lines) * line_height + padding * 2
        
        # 用户消息靠右，AI消息靠左
        if is_user:
            box_x = RESOLUTION[0] - max_width - 80
            color = COLORS['primary']
        else:
            box_x = 80
            color = '#334155'
        
        # 绘制消息框
        draw.rounded_rectangle([box_x, y, box_x + max_width, y + box_height], 
                              radius=12, fill=hex_to_rgb(color))
        
        # 绘制文字
        text_y = y + padding
        for line in lines:
            draw.text((box_x + padding, text_y), line, 
                     fill=hex_to_rgb(COLORS['text']), font=font_msg)
            text_y += line_height
        
        y += box_height + 25
    
    # 记忆提示
    memory_text = "使用了持久化记忆 | .synapse/memories/project-arch.md"
    draw.text((80, y+15), memory_text, fill=hex_to_rgb(COLORS['accent']), font=font_small)
    
    return np.array(img)

def create_github_end_scene():
    """创建GitHub结尾场景"""
    img = Image.new('RGB', RESOLUTION, hex_to_rgb(COLORS['bg_dark']))
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    
    font_large = font_medium = font_small = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font_large = ImageFont.truetype(path, 72)
                font_medium = ImageFont.truetype(path, 48)
                font_small = ImageFont.truetype(path, 36)
                break
            except:
                continue
    
    if font_large is None:
        font_large = font_medium = font_small = ImageFont.load_default()
    
    # Logo圆圈
    center_x, center_y = RESOLUTION[0]//2, 200
    draw.ellipse([center_x-80, center_y-80, center_x+80, center_y+80], 
                fill=hex_to_rgb(COLORS['primary']))
    
    # Star 图标
    bbox = draw.textbbox((0, 0), "★", font=font_large)
    x = center_x - (bbox[2]-bbox[0])//2
    y = center_y - (bbox[3]-bbox[1])//2
    draw.text((x, y), "★", fill=hex_to_rgb(COLORS['text']), font=font_large)
    
    # 产品名
    title = "Synapse AI"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
    draw.text((x, 350), title, fill=hex_to_rgb(COLORS['text']), font=font_large)
    
    # URL
    url = "github.com/Ricardo-M-L/synapse-ai"
    bbox = draw.textbbox((0, 0), url, font=font_medium)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
    draw.text((x, 480), url, fill=hex_to_rgb(COLORS['primary']), font=font_medium)
    
    # 号召性用语
    cta = "点个 Star 支持开源！"
    bbox = draw.textbbox((0, 0), cta, font=font_medium)
    x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
    draw.text((x, 600), cta, fill=hex_to_rgb(COLORS['secondary']), font=font_medium)
    
    # 特点列表
    features = [
        "轻量级 - 20MB 体积",
        "省钱 - Token 减少 60%", 
        "安全 - 本地优先",
        "微信 - 机器人集成"
    ]
    y = 720
    for feature in features:
        bbox = draw.textbbox((0, 0), feature, font=font_small)
        x = (RESOLUTION[0] - (bbox[2]-bbox[0]))//2
        draw.text((x, y), feature, fill=hex_to_rgb(COLORS['text_muted']), font=font_small)
        y += 50
    
    return np.array(img)

def generate_video():
    """生成完整视频"""
    print("🎬 开始生成 Synapse AI 演示视频...")
    
    clips = []
    
    # 场景 1: 开场 Hook (3秒)
    print("⏳ 场景 1/6: 开场 Hook...")
    hook_img = create_text_image(
        "你的 AI 助手太烧钱？",
        subtext="每个月几百刀的 API 账单",
        font_size=80
    )
    hook_clip = (ImageClip(hook_img)
                .with_duration(3)
                .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(0.5)]))
    clips.append(hook_clip)
    
    # 场景 2: Logo展示 (5秒)
    print("⏳ 场景 2/6: Logo展示...")
    logo_img = create_logo_scene()
    logo_clip = (ImageClip(logo_img)
                .with_duration(5)
                .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(0.5)]))
    clips.append(logo_clip)
    
    # 场景 3: 终端安装 (6秒)
    print("⏳ 场景 3/6: 安装演示...")
    terminal_img = create_terminal_scene()
    terminal_clip = (ImageClip(terminal_img)
                    .with_duration(6)
                    .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(0.5)]))
    clips.append(terminal_clip)
    
    # 场景 4: 聊天演示 (8秒)
    print("⏳ 场景 4/6: 聊天演示...")
    chat_img = create_chat_demo_scene()
    chat_clip = (ImageClip(chat_img)
                .with_duration(8)
                .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(0.5)]))
    clips.append(chat_clip)
    
    # 场景 5: 对比图表 (6秒)
    print("⏳ 场景 5/6: Token对比...")
    chart_img = create_comparison_chart()
    chart_clip = (ImageClip(chart_img)
                 .with_duration(6)
                 .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(0.5)]))
    clips.append(chart_clip)
    
    # 场景 6: GitHub结尾 (5秒)
    print("⏳ 场景 6/6: 结尾号召...")
    end_img = create_github_end_scene()
    end_clip = (ImageClip(end_img)
               .with_duration(5)
               .with_effects([vfx.FadeIn(0.5), vfx.FadeOut(1.5)]))
    clips.append(end_clip)
    
    # 合并所有场景
    print("🔄 合并视频片段...")
    final_clip = concatenate_videoclips(clips, method="compose")
    
    # 输出视频
    output_path = os.path.join(OUTPUT_DIR, "synapse-ai-demo.mp4")
    print(f"💾 保存视频到: {output_path}")
    
    final_clip.write_videofile(
        output_path,
        fps=FPS,
        codec='libx264',
        audio=False,
        threads=4
    )
    
    print(f"✅ 视频生成完成！")
    print(f"📁 文件位置: {output_path}")
    print(f"⏱️ 视频时长: {final_clip.duration:.1f} 秒")
    print(f"📐 分辨率: {RESOLUTION[0]}x{RESOLUTION[1]}")
    
    # 清理
    final_clip.close()
    for clip in clips:
        clip.close()

if __name__ == "__main__":
    try:
        generate_video()
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
