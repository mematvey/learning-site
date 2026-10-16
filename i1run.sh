#!/bin/bash
# usage: i1run.sh script.cjs
cd /c/Users/memel/repos/learning-site/.worktrees/i1
export VITE_CONFIG_NATIVE_IGNORE_WARNING=true
npx vite preview --host 127.0.0.1 --port 4173 > ../../i1prev.log 2>&1 &
sleep 4
node "$1" 2>&1 | head -${2:-40}
taskkill //F //IM node.exe >/dev/null 2>&1
