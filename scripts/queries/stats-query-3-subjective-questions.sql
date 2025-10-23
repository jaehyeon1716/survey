-- 3. 주관식 문항별 통계
-- (문항번호, 문항내용, 응답수)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요

SELECT 
    q.question_number AS "문항번호",
    q.question_text AS "문항내용",
    COUNT(r.id) AS "응답수"
FROM 
    survey_questions q
    LEFT JOIN survey_responses r ON q.id = r.question_id
WHERE 
    q.question_type = 'subjective'
    AND r.response_text IS NOT NULL
    AND r.response_text != ''
    -- Added survey_id filter to prevent data mixing
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
GROUP BY 
    q.id, q.question_number, q.question_text
ORDER BY 
    q.question_number;
