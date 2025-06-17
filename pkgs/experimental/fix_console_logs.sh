#!/bin/bash

# console.logを一括でdebugLoggerに置換するスクリプト

echo "Fixing console.log statements in src/..."

# 残りのファイルでconsole.logを検索
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "console\.log" "$file"; then
        echo "Fixing console.log in: $file"

        # debugLoggerインポートがない場合は追加
        if ! grep -q "debugLogger" "$file"; then
            # 最初のimport文の後にdebugLoggerインポートを追加
            sed -i '' '/^import.*from/a\
import { debugLogger } from '\''@/utils/debug-logger'\''
' "$file"
        fi

        # console.logをdebugLogger.debugに置換
        sed -i '' 's/console\.log(/debugLogger.debug(/g' "$file"
    fi
done

echo "Console.log fix completed!"
