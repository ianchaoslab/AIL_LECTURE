#!/bin/bash
# 메모장 서버를 켜고 브라우저를 여는 시작 파일입니다.
# 포트를 바꾸고 싶으면 아래 PORT 숫자만 고치세요. (5000번은 맥 시스템이 쓰고, 6000번은 브라우저가 막으니 피하세요)
PORT=4000
APP_DIR="/Users/ian/Dev/AIL_LECTURE"

cd "$APP_DIR" || { echo "폴더를 찾을 수 없어요: $APP_DIR"; read -n 1 -s -r -p "아무 키나 누르면 닫혀요"; exit 1; }

# 이미 서버가 켜져 있으면 브라우저만 엽니다
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "이미 서버가 켜져 있어요. 브라우저를 엽니다."
  open "http://localhost:$PORT"
  exit 0
fi

echo "메모장 서버를 켭니다: http://localhost:$PORT"
echo "끄려면 이 창에서 Control + C 를 누르거나 창을 닫으세요."
(sleep 1; open "http://localhost:$PORT") &
python3 -m http.server $PORT
