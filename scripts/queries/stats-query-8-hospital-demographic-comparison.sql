-- 8. 병원별 인구통계학적 특성별 종합만족도 비교
-- (순위, 병원명, 전체종합만족도점수, 입원, 외래, 남자, 여자, 50대미만, 50대, 60대, 70대, 80대, 90대이상)

-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요

-- Query 4와 동일한 계산 방식을 사용하도록 수정
WITH question_scores AS (
    SELECT 
        p.hospital_name,
        p.token,
        p.inpatient_outpatient,
        p.gender,
        p.age,
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
        inpatient_outpatient,
        gender,
        age,
        -- 종합만족도 계산: Query 4와 동일한 방식
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
    GROUP BY hospital_name, token, inpatient_outpatient, gender, age
),
hospital_demographics AS (
    SELECT 
        hospital_name,
        -- 전체 종합만족도 (Query 4와 동일하게 계산)
        ROUND(AVG(comprehensive_satisfaction), 2) AS overall_score,
        -- 입원/외래별 종합만족도
        ROUND(AVG(CASE WHEN inpatient_outpatient = '입원' THEN comprehensive_satisfaction END), 2) AS inpatient_score,
        ROUND(AVG(CASE WHEN inpatient_outpatient = '외래' THEN comprehensive_satisfaction END), 2) AS outpatient_score,
        -- 성별 종합만족도
        ROUND(AVG(CASE WHEN gender = '남자' THEN comprehensive_satisfaction END), 2) AS male_score,
        ROUND(AVG(CASE WHEN gender = '여자' THEN comprehensive_satisfaction END), 2) AS female_score,
        -- 연령별 종합만족도
        ROUND(AVG(CASE WHEN age < 50 THEN comprehensive_satisfaction END), 2) AS under_50_score,
        ROUND(AVG(CASE WHEN age >= 50 AND age < 60 THEN comprehensive_satisfaction END), 2) AS age_50s_score,
        ROUND(AVG(CASE WHEN age >= 60 AND age < 70 THEN comprehensive_satisfaction END), 2) AS age_60s_score,
        ROUND(AVG(CASE WHEN age >= 70 AND age < 80 THEN comprehensive_satisfaction END), 2) AS age_70s_score,
        ROUND(AVG(CASE WHEN age >= 80 AND age < 90 THEN comprehensive_satisfaction END), 2) AS age_80s_score,
        ROUND(AVG(CASE WHEN age >= 90 THEN comprehensive_satisfaction END), 2) AS age_90plus_score
    FROM participant_satisfaction
    GROUP BY hospital_name
)
SELECT 
    RANK() OVER (ORDER BY overall_score DESC) AS "순위",
    hospital_name AS "병원명",
    overall_score AS "전체종합만족도점수",
    inpatient_score AS "입원",
    outpatient_score AS "외래",
    male_score AS "남자",
    female_score AS "여자",
    under_50_score AS "50대미만",
    age_50s_score AS "50대",
    age_60s_score AS "60대",
    age_70s_score AS "70대",
    age_80s_score AS "80대",
    age_90plus_score AS "90대이상"
FROM hospital_demographics
ORDER BY "순위";
