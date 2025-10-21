-- 4. 병원별 통계 (상세)
-- (병원명, 응답수, 평균점수)

SELECT 
    p.hospital_name AS "병원명",
    COUNT(DISTINCT p.token) AS "총참여자수",
    COUNT(DISTINCT CASE WHEN p.is_completed = true THEN p.token END) AS "완료수",
    ROUND(
        COUNT(DISTINCT CASE WHEN p.is_completed = true THEN p.token END)::numeric / 
        NULLIF(COUNT(DISTINCT p.token), 0) * 100, 
        2
    ) AS "완료율(%)",
    ROUND(AVG(CASE WHEN q.question_type = 'objective' THEN r.response_value END), 2) AS "평균점수"
FROM 
    survey_participants p
    LEFT JOIN survey_responses r ON p.token = r.participant_token
    LEFT JOIN survey_questions q ON r.question_id = q.id
WHERE 
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- p.survey_id = 1
    true
GROUP BY 
    p.hospital_name
ORDER BY 
    "완료수" DESC;
