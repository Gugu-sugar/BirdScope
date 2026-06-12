# BirdScope FastAPI 镜像
# 构建上下文是仓库根目录（见 docker-compose.yml 的 build.context: ..）
FROM python:3.11-slim

WORKDIR /app

# 先装依赖，利用 Docker 层缓存（用清华 PyPI 镜像源加速，国内更快更稳）
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 再拷贝后端代码
COPY backend/ .

EXPOSE 8000

# 数据库连接等配置由 docker-compose 通过环境变量注入
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
