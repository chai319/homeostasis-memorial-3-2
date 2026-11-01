#!/bin/zsh
cd "$(dirname "$0")" || exit 1
print '３年2組恒常性メモリアル 4月〜6月編 β'
print 'ブラウザで http://127.0.0.1:8872 を開いてください。終了は Control+C。'
print 'すでに起動中の場合は、そのURLを開くだけで遊べます。'
python3 -m http.server 8872 --bind 127.0.0.1
