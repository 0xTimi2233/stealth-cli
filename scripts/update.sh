#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${HOME}/.local/bin"
mkdir -p "${INSTALL_DIR}"

echo "正在获取最新发布产物..."
if command -v gh >/dev/null 2>&1; then
  gh release download --pattern "stealth-cli.js" --dir "${INSTALL_DIR}" --clobber
else
  REPO_URL=$(git config --get remote.origin.url || true)
  if [ -z "${REPO_URL}" ]; then
    echo "错误: 未检测到 git 仓库 remote 配置，无法定位发布地址" >&2
    exit 1
  fi
  REPO_SLUG=$(echo "${REPO_URL}" | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/\1/' | sed 's/\.git$//')
  DOWNLOAD_URL="https://github.com/${REPO_SLUG}/releases/latest/download/stealth-cli.js"
  curl -fsSL "${DOWNLOAD_URL}" -o "${INSTALL_DIR}/stealth-cli.js"
fi

mv -f "${INSTALL_DIR}/stealth-cli.js" "${INSTALL_DIR}/stealth-cli"
chmod +x "${INSTALL_DIR}/stealth-cli"
ln -sf "${INSTALL_DIR}/stealth-cli" "${INSTALL_DIR}/stealth-launcher"

echo "正在刷新调度垫片..."
"${INSTALL_DIR}/stealth-cli" shim --install --dir "${INSTALL_DIR}"

echo "本地安装态已成功更新"
