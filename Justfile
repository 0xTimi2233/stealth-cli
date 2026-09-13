# 默认列出可用配方
default:
    @just --list

# 代码规范与静态类型检查
check:
    bun run check

# 代码自动格式化
fmt:
    bun run fmt

# 本地执行测试套件
test *args:
    bun test {{args}}

# 独立构建产物
build:
    bun run build

# 同步更新版本号 (示例: just bump 0.1.9)
bump version:
    bun scripts/bump.ts {{version}}

# 从最新 Release 下载产物并刷新本地安装态
update:
    @bash scripts/update.sh
