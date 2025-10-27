-- 4. 병원별 통계 (상세)
-- (병원명, 총참여자수, 완료수, 완료율, 평균점수, 100점환산점수, 편익성~공익성, 전반적만족도, 요소만족도, 사회적만족도, 종합만족도)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요

WITH question_scores AS (
    SELECT 
        p.hospital_name,
        p.token,
        q.question_number,
        r.response_value,
        (r.response_value - 1) / 4.0 * 100 AS score_100
    FROM 
        survey_participants p
        INNER JOIN survey_responses r ON p.token = r.participant_token
        INNER JOIN survey_questions q ON r.question_id = q.id
    WHERE 
        q.question_type = 'objective'
        AND p.is_completed = true
        AND p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
        AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
),
participant_satisfaction AS (
    SELECT 
        hospital_name,
        token,
        AVG(response_value) AS avg_score,
        AVG(score_100) AS avg_score_100,
        MAX(CASE WHEN question_number = 1 THEN score_100 END) AS q1_convenience,
        MAX(CASE WHEN question_number = 2 THEN score_100 END) AS q2_responsiveness,
        MAX(CASE WHEN question_number = 3 THEN score_100 END) AS q3_professionalism,
        MAX(CASE WHEN question_number = 4 THEN score_100 END) AS q4_empathy,
        MAX(CASE WHEN question_number = 5 THEN score_100 END) AS q5_ease_of_use,
        MAX(CASE WHEN question_number = 6 THEN score_100 END) AS q6_aesthetics,
        MAX(CASE WHEN question_number = 7 THEN score_100 END) AS q7_reliability,
        MAX(CASE WHEN question_number = 8 THEN score_100 END) AS q8_public_interest,
        MAX(CASE WHEN question_number = 9 THEN score_100 END) AS overall_satisfaction_q9,
        -- 요소만족도: 1~6번 항목의 평균
        (
            (COALESCE(MAX(CASE WHEN question_number = 1 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 2 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 3 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 4 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 5 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 6 THEN score_100 END), 0)) / 6.0
        ) AS element_satisfaction,
        -- 사회적만족도: 7~8번 항목의 평균
        (
            (COALESCE(MAX(CASE WHEN question_number = 7 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 8 THEN score_100 END), 0)) / 2.0
        ) AS social_satisfaction,
        -- 종합만족도: 9번 50% + 1~6번 평균 30% + 7~8번 평균 20%
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
),
-- 병원별 총 참여자 수와 완료 수를 별도로 계산
hospital_stats AS (
    SELECT 
        hospital_name,
        COUNT(DISTINCT token) AS total_participants,
        COUNT(DISTINCT CASE WHEN is_completed = true THEN token END) AS completed_count
    FROM survey_participants
    WHERE survey_id = 'YOUR_SURVEY_ID_HERE'
    GROUP BY hospital_name
)
SELECT 
    hs.hospital_name AS "병원명",
    hs.total_participants AS "총참여자수",
    hs.completed_count AS "완료수",
    ROUND(
        hs.completed_count::numeric / 
        NULLIF(hs.total_participants, 0) * 100, 
        2
    ) AS "완료율(%)",
    ROUND(AVG(ps.avg_score), 2) AS "평균점수(1~9항목평균)",
    ROUND(AVG(ps.avg_score_100), 2) AS "100점환산점수(평균점수의 100점환산값)",
    ROUND(AVG(ps.q1_convenience), 2) AS "편익성(1번항목)",
    ROUND(AVG(ps.q2_responsiveness), 2) AS "대응성(2번항목)",
    ROUND(AVG(ps.q3_professionalism), 2) AS "전문성(3번항목)",
    ROUND(AVG(ps.q4_empathy), 2) AS "공감성(4번항목)",
    ROUND(AVG(ps.q5_ease_of_use), 2) AS "편리성(5번항목)",
    ROUND(AVG(ps.q6_aesthetics), 2) AS "심미성(6번항목)",
    ROUND(AVG(ps.q7_reliability), 2) AS "신뢰성(7번항목)",
    ROUND(AVG(ps.q8_public_interest), 2) AS "공익성(8번항목)",
    ROUND(AVG(ps.overall_satisfaction_q9), 2) AS "전반적만족도(9번항목)",
    ROUND(AVG(ps.element_satisfaction), 2) AS "요소만족도(1~6번항목의 평균값)",
    ROUND(AVG(ps.social_satisfaction), 2) AS "사회적만족도(7,8번항목의 평균값)",
    ROUND(AVG(ps.comprehensive_satisfaction), 2) AS "종합만족도(전반적50%+요소30%+사회적20%)"
FROM 
    hospital_stats hs
    LEFT JOIN participant_satisfaction ps ON hs.hospital_name = ps.hospital_name
GROUP BY 
    hs.hospital_name, hs.total_participants, hs.completed_count
ORDER BY 
    "완료수" DESC;
