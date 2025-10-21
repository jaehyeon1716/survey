-- 2. 병원별 통계
-- (병원명, 응답수, 평균점수)

SELECT 
    p.hospital_name AS "병원명",
    COUNT(DISTINCT r.participant_token) AS "응답수",
    ROUND(AVG(r.response_value), 2) AS "평균점수"
FROM 
    survey_participants p
    INNER JOIN survey_responses r ON p.token = r.participant_token
    INNER JOIN survey_questions q ON r.question_id = q.id
WHERE 
    q.question_type = 'objective'
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- AND p.survey_id = 1
GROUP BY 
    p.hospital_name
ORDER BY 
    "응답수" DESC;
