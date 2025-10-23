-- 4. 병원별 통계 (상세)
-- (병원명, 총참여자수, 완료수, 완료율, 평균점수, 100점환산점수, 전반적만족도, 요소만족도, 사회적만족도, 종합만족도)

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
        AND p.is_completed = true
        -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
        -- AND p.survey_id = 1
),
participant_satisfaction AS (
    SELECT 
        hospital_name,
        token,
        AVG(score_100) AS avg_score_100,
        -- Added 전반적만족도 (Q9 100-point value)
        MAX(CASE WHEN question_number = 9 THEN score_100 END) AS overall_satisfaction_q9,
        -- Added 요소만족도 (Q1-6 average 100-point value)
        (
            (COALESCE(MAX(CASE WHEN question_number = 1 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 2 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 3 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 4 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 5 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 6 THEN score_100 END), 0)) / 6.0
        ) AS element_satisfaction,
        -- Added 사회적만족도 (Q7-8 average 100-point value)
        (
            (COALESCE(MAX(CASE WHEN question_number = 7 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 8 THEN score_100 END), 0)) / 2.0
        ) AS social_satisfaction,
        -- Calculate overall satisfaction score (weighted)
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
        ) AS comprehensive_satisfaction
    FROM question_scores
    GROUP BY hospital_name, token
)
SELECT 
    p.hospital_name AS "병원명",
    COUNT(DISTINCT p.token) AS "총참여자수",
    COUNT(DISTINCT CASE WHEN p.is_completed = true THEN p.token END) AS "완료수",
    ROUND(
        COUNT(DISTINCT CASE WHEN p.is_completed = true THEN p.token END)::numeric / 
        NULLIF(COUNT(DISTINCT p.token), 0) * 100, 
        2
    ) AS "완료율(%)",
    ROUND(AVG(CASE WHEN q.question_type = 'objective' THEN r.response_value END), 2) AS "평균점수",
    ROUND(COALESCE(AVG(ps.avg_score_100), 0), 2) AS "100점환산점수",
    -- Added three new satisfaction columns in specified order
    ROUND(COALESCE(AVG(ps.overall_satisfaction_q9), 0), 2) AS "전반적만족도",
    ROUND(COALESCE(AVG(ps.element_satisfaction), 0), 2) AS "요소만족도",
    ROUND(COALESCE(AVG(ps.social_satisfaction), 0), 2) AS "사회적만족도",
    ROUND(COALESCE(AVG(ps.comprehensive_satisfaction), 0), 2) AS "종합만족도"
FROM 
    survey_participants p
    LEFT JOIN survey_responses r ON p.token = r.participant_token
    LEFT JOIN survey_questions q ON r.question_id = q.id
    LEFT JOIN participant_satisfaction ps ON p.hospital_name = ps.hospital_name AND p.token = ps.token
WHERE 
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- p.survey_id = 1
    true
GROUP BY 
    p.hospital_name
ORDER BY 
    "완료수" DESC;
