# 🚀 WebGIS项目部署完全指南（零基础版）

> 这份指南专为完全不懂Docker的新手准备，手把手教你从购买服务器到项目上线的全过程。

---

## 📑 目录

- [第一步：购买服务器和域名](#第一步购买服务器和域名)
- [第二步：连接到服务器](#第二步连接到服务器)
- [第三步：服务器基础配置](#第三步服务器基础配置)
- [第四步：安装Docker](#第四步安装docker)
- [第五步：上传项目代码](#第五步上传项目代码)
- [第六步：启动项目](#第六步启动项目)
- [第七步：配置域名](#第七步配置域名)
- [第八步：配置HTTPS（可选但推荐）](#第八步配置https可选但推荐)
- [常用命令速查](#常用命令速查)
- [常见问题解决](#常见问题解决)

---

## 第一步：购买服务器和域名

### 1.1 购买服务器（云服务器）

推荐的云服务商（选其中一个即可）：

#### 🔹 阿里云（推荐新手）
1. 访问：https://www.aliyun.com
2. 注册账号并实名认证
3. 进入「云服务器ECS」产品页
4. 选择配置：
   - **地域**：选择离你近的（如华东、华北）
   - **操作系统**：Ubuntu 22.04 64位（重要！）
   - **实例规格**：最少 2核4G（推荐 2核8G）
   - **带宽**：至少 5M
   - **购买时长**：1个月起（新手可先买1个月测试）
5. 创建成功后，记下：
   - ✅ **服务器公网IP**（如：47.98.123.45）
   - ✅ **root密码**（自己设置的）

**💰 预计费用**：约 50-100元/月

#### 🔹 腾讯云
类似流程，选择「轻量应用服务器」，系统选择 Ubuntu 22.04

#### 🔹 华为云
类似流程，选择「弹性云服务器」

### 1.2 购买域名（可选，但强烈推荐）

#### 为什么需要域名？
- ❌ 不用域名：只能通过 IP 访问，如 `http://47.98.123.45`
- ✅ 用域名：可以用易记的网址，如 `http://webgis.yourdomain.com`

#### 购买步骤：
1. 在云服务商（阿里云/腾讯云）找到「域名注册」
2. 搜索你想要的域名（如：`mywebgis.com`）
3. 选择一个可用且价格合适的后缀：
   - `.com` - 最常见，约50元/年
   - `.cn` - 中国域名，约29元/年
   - `.top` / `.xyz` - 便宜，约10-20元/年
4. 购买后，进行**实名认证**（必须，否则无法使用）
5. 等待审核（1-3天）

**💰 预计费用**：10-60元/年

---

## 第二步：连接到服务器

### 2.1 Windows用户

#### 方法一：使用 Xshell（推荐，有图形界面）

1. **下载 Xshell**
   - 访问：https://www.netsarang.com/zh/xshell/
   - 下载免费版或试用版

2. **连接服务器**
   ```
   步骤：
   1. 打开 Xshell
   2. 点击「新建会话」
   3. 填写信息：
      - 名称：WebGIS服务器（随便填）
      - 主机：你的服务器IP（如 47.98.123.45）
      - 端口：22
   4. 点击左侧「用户身份验证」
      - 用户名：root
      - 密码：你设置的root密码
   5. 点击「连接」
   ```

3. **成功标志**
   - 看到 `root@xxxxxx:~#` 就表示连接成功了！

#### 方法二：使用 PowerShell/CMD

```powershell
# 打开 PowerShell，输入：
ssh root@你的服务器IP

# 例如：
ssh root@47.98.123.45

# 然后输入密码（输入时不显示，这是正常的）
```

### 2.2 Mac/Linux用户

打开终端（Terminal），输入：
```bash
ssh root@你的服务器IP
# 输入密码
```

---

## 第三步：服务器基础配置

### 3.1 更新系统

连接到服务器后，输入以下命令（一行一行复制粘贴执行）：

```bash
# 更新软件包列表
sudo apt-get update

# 升级已安装的软件包
sudo apt-get upgrade -y
```

**⏱️ 耗时**：约 2-5 分钟

### 3.2 安装必要工具

```bash
# 安装常用工具
sudo apt-get install -y curl wget git vim
```

### 3.3 配置防火墙

```bash
# 安装防火墙工具
sudo apt-get install -y ufw

# 开放必要端口
sudo ufw allow 22      # SSH端口（重要！不开放会断开连接）
sudo ufw allow 80      # HTTP端口
sudo ufw allow 443     # HTTPS端口

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

**⚠️ 重要**：一定要先开放22端口，否则会被锁在外面！

---

## 第四步：安装Docker

### 4.1 什么是Docker？（科普）

Docker 就像一个"集装箱"，把你的应用和所有依赖打包在一起：
- ✅ 不用担心环境问题（"在我电脑上能跑"的问题）
- ✅ 一键启动/停止
- ✅ 容易备份和迁移

### 4.2 安装Docker

**方式一：一键安装脚本（推荐）**

```bash
# 下载并执行官方安装脚本
curl -fsSL https://get.docker.com | bash -s docker

# 启动Docker
sudo systemctl start docker

# 设置开机自启
sudo systemctl enable docker

# 验证安装
docker --version
```

看到版本号（如 `Docker version 24.0.x`）就成功了！

**方式二：手动安装（备用）**

```bash
# 1. 添加Docker官方GPG密钥
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 2. 添加Docker仓库
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. 安装Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. 验证
docker --version
```

### 4.3 安装 Docker Compose

```bash
# Docker Compose 用于管理多个容器（前端+后端）
# 新版Docker已内置，验证一下：
docker compose version

# 如果没有，则手动安装：
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 4.4 配置Docker权限（可选）

```bash
# 让当前用户可以不用sudo执行docker命令
sudo usermod -aG docker $USER

# 重新登录生效（退出并重新SSH连接）
exit
# 然后重新 ssh root@你的IP
```

---

## 第五步：上传项目代码

### 5.1 方式一：使用 Git（推荐）

**如果你的代码已经上传到 GitHub/Gitee：**

```bash
# 1. 进入工作目录
cd /root

# 2. 克隆项目
git clone https://github.com/你的用户名/webgis_project.git

# 或者用 Gitee（国内速度快）
git clone https://gitee.com/你的用户名/webgis_project.git

# 3. 进入项目目录
cd webgis_project

# 4. 查看文件
ls
```

**如果还没上传到Git：**

先在本地电脑（Windows）上传代码到 GitHub：
1. 在 GitHub 创建一个新仓库
2. 在项目目录打开 Git Bash
3. 执行：
   ```bash
   git init
   git add .
   git commit -m "初始提交"
   git remote add origin https://github.com/你的用户名/webgis_project.git
   git push -u origin main
   ```

### 5.2 方式二：使用 SCP 上传（从Windows直接传）

**在本地 Windows 电脑的 PowerShell 中执行：**

```powershell
# 切换到项目目录
cd E:\webgis\webgis_project

# 上传整个项目到服务器
scp -r . root@你的服务器IP:/root/webgis_project

# 例如：
scp -r . root@47.98.123.45:/root/webgis_project
```

**⏱️ 耗时**：根据网速，可能需要 5-20 分钟

### 5.3 方式三：使用 FileZilla（图形化工具）

1. 下载 FileZilla：https://filezilla-project.org/
2. 打开 FileZilla
3. 连接信息：
   - 主机：`sftp://你的服务器IP`
   - 用户名：`root`
   - 密码：你的root密码
   - 端口：`22`
4. 点击「快速连接」
5. 左侧选择本地项目文件夹，右侧选择 `/root/`
6. 直接拖拽上传

---

## 第六步：启动项目

### 6.1 检查项目文件

```bash
# 进入项目目录
cd /root/webgis_project

# 查看文件（应该能看到 docker-compose.yml, Dockerfile 等）
ls

# 应该看到：
# Dockerfile
# docker-compose.yml
# nginx.conf
# package.json
# server/
# src/
# public/
# ...
```

### 6.2 确保数据目录存在

```bash
# 创建数据目录（如果不存在）
mkdir -p public/data

# 设置权限
chmod -R 755 public/data
```

### 6.3 启动Docker服务

```bash
# 🚀 启动命令（核心步骤）
docker compose up -d --build
```

**参数解释：**
- `up`：启动服务
- `-d`：后台运行（detached）
- `--build`：构建镜像

**⏱️ 第一次启动会比较慢（10-20分钟），因为要：**
1. 下载基础镜像（Node.js、Nginx等）
2. 安装依赖
3. 构建前端代码

### 6.4 查看启动状态

```bash
# 查看容器状态
docker compose ps

# 应该看到两个容器都是 Up 状态：
# NAME                 STATUS
# webgis-backend       Up (healthy)
# webgis-frontend      Up
```

### 6.5 查看日志（排查问题用）

```bash
# 查看所有日志
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 只看前端日志
docker compose logs -f frontend

# 按 Ctrl+C 退出日志查看
```

**✅ 成功标志：**
后端日志显示：
```
====================================
  WebGIS 后端服务启动成功
====================================
  服务地址: http://localhost:8080
```

### 6.6 测试服务

```bash
# 测试后端
curl http://localhost:8080/health

# 应该返回：
# {"code":200,"message":"WebGIS后端服务运行正常",...}

# 测试前端
curl http://localhost

# 应该返回 HTML 内容
```

---

## 第七步：配置域名

### 7.1 添加域名解析

**以阿里云为例：**

1. 登录阿里云控制台
2. 进入「域名控制台」
3. 找到你的域名，点击「解析」
4. 点击「添加记录」：
   ```
   记录类型：A
   主机记录：@ 或 www 或 webgis（子域名）
   记录值：你的服务器IP（如 47.98.123.45）
   TTL：10分钟
   ```
5. 保存

**记录类型说明：**
- `@`：代表根域名（如 `mywebgis.com`）
- `www`：代表 `www.mywebgis.com`
- `webgis`：代表 `webgis.mywebgis.com`

### 7.2 等待DNS生效

**⏱️ 通常需要 10分钟 - 2小时**

检查是否生效：
```bash
# 在本地电脑 PowerShell 执行
ping 你的域名

# 看返回的IP是否是你的服务器IP
```

### 7.3 修改 Nginx 配置

```bash
# 编辑 nginx.conf
cd /root/webgis_project
vim nginx.conf

# 或者用 nano（更友好）
nano nginx.conf
```

修改第4行：
```nginx
server_name localhost;  # 改为你的域名
```

改成：
```nginx
server_name webgis.mywebgis.com;  # 你的实际域名
```

**保存方法：**
- vim：按 `Esc`，输入 `:wq`，回车
- nano：按 `Ctrl+O`，回车，`Ctrl+X`

### 7.4 重启服务

```bash
# 重启前端容器（应用新的 Nginx 配置）
docker compose restart frontend

# 或者重新构建
docker compose up -d --build frontend
```

### 7.5 测试访问

在浏览器访问：`http://你的域名`

应该能看到 WebGIS 系统界面！

---

## 第八步：配置HTTPS（可选但推荐）

### 8.1 为什么需要HTTPS？

- ✅ 数据加密，更安全
- ✅ 浏览器显示"安全"标志
- ✅ 某些功能（如地理定位）需要HTTPS
- ✅ SEO更好

### 8.2 安装 Certbot（免费SSL证书工具）

```bash
# 安装 Certbot
sudo apt-get install -y certbot

# 停止前端容器（释放80端口）
cd /root/webgis_project
docker compose stop frontend
```

### 8.3 获取SSL证书

```bash
# 获取证书（替换为你的域名和邮箱）
sudo certbot certonly --standalone -d 你的域名 -m 你的邮箱 --agree-tos

# 例如：
sudo certbot certonly --standalone -d webgis.mywebgis.com -m youremail@example.com --agree-tos
```

**成功后会显示证书路径：**
```
/etc/letsencrypt/live/你的域名/fullchain.pem
/etc/letsencrypt/live/你的域名/privkey.pem
```

### 8.4 修改 Nginx 配置支持 HTTPS

```bash
nano /root/webgis_project/nginx.conf
```

在配置文件末尾添加（在第一个server块后面）：

```nginx
# HTTPS 服务器配置
server {
    listen 443 ssl;
    server_name 你的域名;  # 改为实际域名

    # SSL 证书路径
    ssl_certificate /etc/letsencrypt/live/你的域名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 其他配置与 HTTP 相同
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /data/ {
        proxy_pass http://backend:8080/data/;
        proxy_set_header Host $host;
        expires 1d;
    }

    client_max_body_size 500M;
    client_body_buffer_size 128k;
}

# HTTP 自动跳转到 HTTPS
server {
    listen 80;
    server_name 你的域名;  # 改为实际域名
    return 301 https://$server_name$request_uri;
}
```

### 8.5 修改 docker-compose.yml

```bash
nano docker-compose.yml
```

在 frontend 服务的 ports 部分添加443端口，并挂载证书：

```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: webgis-frontend
  ports:
    - "80:80"
    - "443:443"  # 添加这行
  volumes:
    # 挂载SSL证书（添加这两行）
    - /etc/letsencrypt:/etc/letsencrypt:ro
  depends_on:
    backend:
      condition: service_healthy
  restart: unless-stopped
  networks:
    - webgis-network
```

### 8.6 重启服务

```bash
# 重新构建并启动
docker compose up -d --build

# 查看状态
docker compose ps
```

### 8.7 测试 HTTPS

浏览器访问：`https://你的域名`

应该能看到地址栏有🔒锁的图标！

### 8.8 设置证书自动续期

Let's Encrypt 证书有效期只有 90 天，需要定期续期：

```bash
# 测试续期
sudo certbot renew --dry-run

# 设置定时任务自动续期
sudo crontab -e

# 选择编辑器（建议选 nano，输入 1 或 2）
# 在文件末尾添加：
0 0 1 * * certbot renew --quiet && docker compose -f /root/webgis_project/docker-compose.yml restart frontend
```

这会在每月1号凌晨自动续期证书并重启前端服务。

---

## 常用命令速查

### Docker Compose 命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 重新构建并启动
docker compose up -d --build

# 停止单个服务
docker compose stop backend

# 启动单个服务
docker compose start backend
```

### Docker 命令

```bash
# 查看所有容器
docker ps -a

# 查看镜像
docker images

# 删除停止的容器
docker container prune

# 删除未使用的镜像
docker image prune -a

# 查看容器日志
docker logs webgis-backend -f

# 进入容器内部
docker exec -it webgis-backend sh

# 查看资源使用
docker stats
```

### 系统命令

```bash
# 查看磁盘空间
df -h

# 查看内存使用
free -h

# 查看端口占用
sudo netstat -tulpn | grep :80

# 查看进程
top

# 编辑文件
nano 文件名
vim 文件名
```

---

## 常见问题解决

### ❌ 问题1：构建镜像失败

**错误信息：**
```
ERROR: failed to solve: ...
```

**解决方法：**
```bash
# 1. 清理 Docker 缓存
docker system prune -a

# 2. 重新构建
docker compose build --no-cache

# 3. 再次启动
docker compose up -d
```

### ❌ 问题2：端口被占用

**错误信息：**
```
Bind for 0.0.0.0:80 failed: port is already allocated
```

**解决方法：**
```bash
# 查看占用端口的进程
sudo netstat -tulpn | grep :80

# 停止占用端口的进程（PID是上一步查到的进程号）
sudo kill -9 PID

# 或者修改 docker-compose.yml 中的端口映射
# 把 "80:80" 改成 "8888:80"
# 然后访问 http://IP:8888
```

### ❌ 问题3：无法访问网站

**检查步骤：**

```bash
# 1. 检查容器是否运行
docker compose ps

# 2. 检查防火墙
sudo ufw status

# 3. 检查云服务器安全组
# 登录云服务商控制台，检查安全组规则是否开放80/443端口

# 4. 测试本地访问
curl http://localhost

# 5. 查看日志
docker compose logs -f frontend
```

### ❌ 问题4：后端健康检查失败

**错误信息：**
```
backend is unhealthy
```

**解决方法：**
```bash
# 查看后端日志
docker compose logs backend

# 进入后端容器检查
docker exec -it webgis-backend sh

# 在容器内测试
wget http://localhost:8080/health

# 如果失败，检查代码是否有错误
```

### ❌ 问题5：数据丢失

**预防方法：**

```bash
# 定期备份数据目录
cd /root/webgis_project
tar -czf backup-$(date +%Y%m%d).tar.gz public/data/

# 下载到本地
# 在本地 PowerShell 执行：
scp root@服务器IP:/root/webgis_project/backup-*.tar.gz ./
```

### ❌ 问题6：域名无法访问

**检查步骤：**

```bash
# 1. 检查DNS是否生效
ping 你的域名

# 2. 检查 Nginx 配置中的 server_name
cat nginx.conf | grep server_name

# 3. 重启前端服务
docker compose restart frontend
```

### ❌ 问题7：HTTPS 证书错误

**解决方法：**

```bash
# 1. 检查证书路径
sudo ls /etc/letsencrypt/live/你的域名/

# 2. 检查 docker-compose.yml 中是否挂载了证书目录

# 3. 重新获取证书
sudo certbot delete --cert-name 你的域名
sudo certbot certonly --standalone -d 你的域名
```

### ❌ 问题8：上传文件失败

**检查步骤：**

```bash
# 1. 检查目录权限
ls -la public/data/

# 2. 修改权限
chmod -R 777 public/data/

# 3. 检查 nginx 配置中的 client_max_body_size

# 4. 重启服务
docker compose restart
```

---

## 🎉 完成部署！

恭喜！你已经成功部署了 WebGIS 项目。

**访问方式：**
- HTTP：`http://你的域名` 或 `http://服务器IP`
- HTTPS：`https://你的域名`（如果配置了SSL）

**后续维护：**
1. 定期备份数据
2. 监控服务器资源使用
3. 及时更新代码
4. 查看日志排查问题

**需要帮助？**
- 查看项目文档：`docs/` 目录
- 查看日志：`docker compose logs -f`
- 检查状态：`docker compose ps`

---

## 📚 进阶学习

### Docker 学习资源
- [Docker 官方文档](https://docs.docker.com/)
- [Docker 从入门到实践](https://yeasy.gitbook.io/docker_practice/)

### Nginx 学习资源
- [Nginx 官方文档](https://nginx.org/en/docs/)
- [Nginx 配置详解](https://www.nginx.com/resources/wiki/)

### Linux 学习资源
- [Linux 命令大全](https://www.linuxcool.com/)
- [鸟哥的 Linux 私房菜](http://linux.vbird.org/)

---

**祝您部署顺利！🚀**

