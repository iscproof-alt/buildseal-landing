#!/bin/bash
MSG=${1:-"update"}
git add -A
git commit -m "$MSG"
git push
npx vercel --prod > /tmp/vercel_out.txt 2>&1
cat /tmp/vercel_out.txt | tail -5
URL=$(grep "Production:" /tmp/vercel_out.txt | head -1 | awk '{print $2}' | tr -d '\n')
echo "Aliasing: $URL"
npx vercel alias set "$URL" buildseal.io 2>&1
echo "Done: https://buildseal.io"
