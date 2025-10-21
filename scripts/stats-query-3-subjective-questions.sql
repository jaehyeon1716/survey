-- 3. 주관식 문항별 통계
-- (문항번호, 문항내용, 응답수)

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
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- AND q.survey_id = 1
GROUP BY 
    q.id, q.question_number, q.question_text
ORDER BY 
    q.question_number;
