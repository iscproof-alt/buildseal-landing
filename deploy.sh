#!/bin/bash
MSG=${1:-"update"}
git add -A
git commit -m "$MSG"
git push
OUTPUT=$(npx vercel --prod 2>&1)
URL=$(echo "$OUTPUT" | grep "Production:" | awk '{print $2}')
echo "Deployed: $URL"
npx vercel alias set "$URL" buildseal.io
echo "Done: https://buildseal.io"
