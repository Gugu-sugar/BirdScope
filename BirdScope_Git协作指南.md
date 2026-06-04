# BirdScope Git 协作指南

仓库地址：`https://github.com/Gugu-sugar/BirdScope.git`

---

## 一、Git 命令速查表

### 日常操作

| 你想做什么 | 命令 |
|---|---|
| 克隆仓库到本地 | `git clone https://github.com/Gugu-sugar/BirdScope.git` |
| 查看当前状态 | `git status` |
| 查看提交历史 | `git log --oneline` |
| 查看所有分支 | `git branch -a` |
| 拉取远程最新代码 | `git pull origin main` |

### 分支操作

| 你想做什么 | 命令 |
|---|---|
| 创建并切换到新分支 | `git checkout -b feature/你的功能名` |
| 切换到已有分支 | `git checkout 分支名` |
| 删除本地分支（合并后清理用） | `git branch -d 分支名` |

### 提交与推送

| 你想做什么 | 命令 |
|---|---|
| 暂存所有改动 | `git add .` |
| 暂存单个文件 | `git add 文件路径` |
| 提交 | `git commit -m "描述信息"` |
| 推送分支到远程 | `git push origin 你的分支名` |

### 回退与撤销

| 场景 | 命令 | 说明 |
|---|---|---|
| 改了文件，还没 add | `git checkout -- 文件名` | 丢弃修改 |
| 已 add，还没 commit | `git reset HEAD 文件名` | 取消暂存，改动保留 |
| 已 commit，还没 push | `git reset --soft HEAD~1` | 撤回 commit，改动保留 |
| 已 commit，改动也不要了 | `git reset --hard HEAD~1` | 全部回退，慎用 |
| 已 push 到远程 | `git revert 提交哈希` | 生成新 commit 抵消，不破坏历史 |

### 同步与合并

| 你想做什么 | 命令 |
|---|---|
| 把远程 main 的更新合并到自己的分支 | 在你的分支上执行 `git fetch origin` 然后 `git merge origin/main` |
| 解决冲突后继续 | 手动编辑冲突文件 → `git add .` → `git commit` |

### Commit 消息规范

格式：`类型: 简要描述`

| 类型 | 用途 | 示例 |
|---|---|---|
| feat | 新功能 | `feat: 添加鸟种搜索功能` |
| fix | 修 bug | `fix: 修复地图标注偏移` |
| docs | 文档 | `docs: 更新 README` |
| style | 格式调整（不影响逻辑） | `style: 统一缩进` |
| refactor | 重构 | `refactor: 拆分地图组件` |

---

## 二、新手上路练习（每位组员都跑一遍）

> 目标：走通「克隆 → 建分支 → 修改 → 提交 → 推送 → 发 PR → 合并」的完整流程。

### 第 0 步：前置准备

确保你已经：

1. 安装了 Git（终端输入 `git --version` 能看到版本号）
2. 有 GitHub 账号，且已被邀请为仓库协作者
3. 配置了 Git 用户信息：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

### 第 1 步：克隆仓库

```bash
git clone https://github.com/Gugu-sugar/BirdScope.git
cd BirdScope
```

### 第 2 步：创建你的练习分支

```bash
git checkout -b test/你的名字
# 例如：git checkout -b test/zhangsan
```

### 第 3 步：做一个小修改

打开 `README.md`，在末尾加一行，写上你的名字和日期，例如：

```
- 张三，2026-05-30，测试提交
```

### 第 4 步：暂存并提交

```bash
git add README.md
git commit -m "test: 张三完成协作流程测试"
```

### 第 5 步：推送到远程

```bash
git push origin test/你的名字
# 例如：git push origin test/zhangsan
```

### 第 6 步：在 GitHub 上发起 Pull Request

1. 打开浏览器访问 https://github.com/Gugu-sugar/BirdScope
2. 页面顶部会出现黄色横幅提示你刚推送了新分支，点击 **Compare & pull request**
3. 如果没有横幅，点击 **Pull requests** 标签页 → **New pull request**
4. Base 选 `main`，Compare 选你的分支 `test/你的名字`
5. 填写标题和简要说明，点击 **Create pull request**

### 第 7 步：合并 PR

1. 等项目负责人 review（练习阶段可以自己合并）
2. 确认无冲突后，点击 **Merge pull request** → **Confirm merge**
3. 合并成功后可以点 **Delete branch** 清理远程分支

### 第 8 步：本地同步

```bash
git checkout main
git pull origin main
git branch -d test/你的名字
```

至此你已经完成了一次完整的协作流程。

---

## 三、注意事项

1. **永远不要直接往 main 分支 push。** 所有改动通过 PR 合入。
2. **每次开始新工作前，先 pull 最新的 main，再从 main 创建新分支。**
3. **commit 要小而频繁。** 别攒一大堆改动再提交。
4. **遇到冲突别慌。** 打开冲突文件，手动选择保留哪部分，删掉 `<<<` `===` `>>>` 标记，然后 add + commit。
5. **不确定的操作先问。** Git 几乎所有操作都可以撤销，但提前问一句总比事后修复轻松。
