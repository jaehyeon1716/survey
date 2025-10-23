-- 2. 병원별 통계
-- (병원명, 응답수, 평균점수, 100점환산점수, 종합만족도)

WITH question_scores AS (
    SELECT 
        p.hospital_name,
        p.token,
        q.question_number,
        r.response_value,
        -- Convert to 100-point scale
        (r.response_value - 1) / 4.0 * 100 AS score_100
    FROM 
        survey_participants p
        INNER JOIN survey_responses r ON p.token = r.participant_token
        INNER JOIN survey_questions q ON r.question_id = q.id
    WHERE 
        q.question_type = 'objective'
        -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
        -- AND p.survey_id = 1
),
participant_satisfaction AS (
    SELECT 
        hospital_name,
        token,
        -- Calculate overall satisfaction score
        -- Question 9 (50%) + Average of Q1-6 (30%) + Average of Q7-8 (20%)
        (
            MAX(CASE WHEN question_number = 9 THEN score_100 END) * 0.5 +
            (
                (COALESCE(MAX(CASE WHEN question_number = 1 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 2 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 3 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 4 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 5 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 6 THEN score_100 END), 0)) / 6.0
            ) * 0.3 +
            (
                (COALESCE(MAX(CASE WHEN question_number = 7 THEN score_100 END), 0) +
                 COALESCE(MAX(CASE WHEN question_number = 8 THEN score_100 END), 0)) / 2.0
            ) * 0.2
        ) AS overall_satisfaction
    FROM question_scores
    GROUP BY hospital_name, token
)
SELECT 
    hospital_name AS "병원명",
    COUNT(DISTINCT token) AS "응답수",
    ROUND(AVG(overall_satisfaction), 2) AS "종합만족도"
FROM participant_satisfaction
GROUP BY hospital_name
ORDER BY "응답수" DESC;
