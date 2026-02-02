
API_KEY="<YOUR_API_KEY>"
DB_ID="2fb73635f415803080c4c1b906e6b78f"
STUDENT_ID="2f973635-f415-80cd-87a6-e508635b3576"

add_enrollment() {
  local NAME=$1
  local DAY=$2
  local START=$3
  local END=$4
  local SUBJECT=$5

  curl -X POST "https://api.notion.com/v1/pages" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    --data "{
      \"parent\": { \"database_id\": \"$DB_ID\" },
      \"properties\": {
        \"이름\": { \"title\": [ { \"text\": { \"content\": \"$NAME\" } } ] },
        \"학생\": { \"relation\": [ { \"id\": \"$STUDENT_ID\" } ] },
        \"요일\": { \"select\": { \"name\": \"$DAY\" } },
        \"시작시간\": { \"rich_text\": [ { \"text\": { \"content\": \"$START\" } } ] },
        \"종료시간\": { \"rich_text\": [ { \"text\": { \"content\": \"$END\" } } ] },
        \"과목\": { \"rich_text\": [ { \"text\": { \"content\": \"$SUBJECT\" } } ] }
      }
    }"
}

echo "Adding schedule for 정지효..."
add_enrollment "정지효-월-과학" "월" "16:00" "17:30" "과학"
add_enrollment "정지효-화-수학" "화" "16:00" "18:00" "수학"
add_enrollment "정지효-수-국어" "수" "16:00" "17:30" "국어"
add_enrollment "정지효-수-과학" "수" "17:30" "19:00" "과학"
add_enrollment "정지효-목-수학" "목" "16:00" "18:30" "수학"
add_enrollment "정지효-금-국어" "금" "16:00" "17:30" "국어"
