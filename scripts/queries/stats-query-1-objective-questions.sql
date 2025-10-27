-- 1. 전체병원의 객관식 문항별 통계
-- (문항번호, 문항 내용, 응답수, 평균 점수, 100점 환산 점수)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- 예: WHERE q.survey_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

SELECT 
    q.question_number AS "문항번호",
    q.question_text AS "문항내용",
    COUNT(r.id) AS "응답수",
    ROUND(AVG(r.response_value), 2) AS "평균점수(1~9항목평균)",
    ROUND(AVG((r.response_value - 1) / 4.0 * 100), 2) AS "100점환산점수(평균점수의 100점환산값)"
FROM 
    survey_questions q
    LEFT JOIN survey_responses r ON q.id = r.question_id
    -- 완료된 응답자만 포함하도록 participant 테이블 조인 추가
    LEFT JOIN survey_participants p ON r.participant_token = p.token
WHERE 
    q.question_type = 'objective'
    -- 완료된 응답만 집계하도록 필터 추가
    AND (p.is_completed = true OR r.id IS NULL)
    -- Added survey_id filter to prevent data mixing between different surveys
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
GROUP BY 
    q.id, q.question_number, q.question_text
ORDER BY 
    q.question_number;
