-- ============================================
-- 1. 전체병원의 객관식 문항별 통계
-- (문항번호, 문항 내용, 응답수, 평균 점수, 100점 환산 점수)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- 예: WHERE q.survey_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- ============================================

SELECT 
    q.question_number AS "문항번호",
    q.question_text AS "문항내용",
    COUNT(r.id) AS "응답수",
    ROUND(AVG(r.response_value), 2) AS "평균점수(1~9항목평균)",
    ROUND(AVG((r.response_value - 1) / 4.0 * 100), 2) AS "100점환산점수(평균점수의 100점환산값)"
FROM 
    survey_questions q
    LEFT JOIN survey_responses r ON q.id = r.question_id
WHERE 
    q.question_type = 'objective'
    -- Added survey_id filter to prevent data mixing between different surveys
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
GROUP BY 
    q.id, q.question_number, q.question_text
ORDER BY 
    q.question_number;

-- ============================================
-- 2. 병원별 통계
-- (병원명, 응답수, 평균점수, 100점환산점수, 종합만족도)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- ============================================

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
        -- Added survey_id filter to prevent data mixing
        AND p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
        AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
),
participant_satisfaction AS (
    SELECT 
        hospital_name,
        token,
        AVG(response_value) AS avg_score,
        AVG(score_100) AS avg_score_100,
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
    hospital_name AS "병원명",
    COUNT(DISTINCT token) AS "응답수",
    ROUND(AVG(avg_score), 2) AS "평균점수(1~9항목평균)",
    ROUND(AVG(avg_score_100), 2) AS "100점환산점수(평균점수의 100점환산값)",
    ROUND(AVG(comprehensive_satisfaction), 2) AS "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_satisfaction
GROUP BY hospital_name
ORDER BY "응답수" DESC;

-- ============================================
-- 3. 주관식 문항별 통계
-- (문항번호, 문항내용, 응답수)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- ============================================

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

-- ============================================
-- 4. 병원별 통계 (상세)
-- (병원명, 총참여자수, 완료수, 완료율, 평균점수, 100점환산점수, 편익성~공익성, 전반적만족도, 요소만족도, 사회적만족도, 종합만족도)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- ============================================

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
        -- Added survey_id filter to prevent data mixing
        AND p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
        AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
),
participant_satisfaction AS (
    SELECT 
        hospital_name,
        token,
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
        (
            (COALESCE(MAX(CASE WHEN question_number = 1 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 2 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 3 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 4 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 5 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 6 THEN score_100 END), 0)) / 6.0
        ) AS element_satisfaction,
        (
            (COALESCE(MAX(CASE WHEN question_number = 7 THEN score_100 END), 0) +
             COALESCE(MAX(CASE WHEN question_number = 8 THEN score_100 END), 0)) / 2.0
        ) AS social_satisfaction,
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
    ROUND(AVG(CASE WHEN q.question_type = 'objective' THEN r.response_value END), 2) AS "평균점수(1~9항목평균)",
    ROUND(COALESCE(AVG(ps.avg_score_100), 0), 2) AS "100점환산점수(평균점수의 100점환산값)",
    ROUND(COALESCE(AVG(ps.q1_convenience), 0), 2) AS "편익성(1번항목)",
    ROUND(COALESCE(AVG(ps.q2_responsiveness), 0), 2) AS "대응성(2번항목)",
    ROUND(COALESCE(AVG(ps.q3_professionalism), 0), 2) AS "전문성(3번항목)",
    ROUND(COALESCE(AVG(ps.q4_empathy), 0), 2) AS "공감성(4번항목)",
    ROUND(COALESCE(AVG(ps.q5_ease_of_use), 0), 2) AS "편리성(5번항목)",
    ROUND(COALESCE(AVG(ps.q6_aesthetics), 0), 2) AS "심미성(6번항목)",
    ROUND(COALESCE(AVG(ps.q7_reliability), 0), 2) AS "신뢰성(7번항목)",
    ROUND(COALESCE(AVG(ps.q8_public_interest), 0), 2) AS "공익성(8번항목)",
    ROUND(COALESCE(AVG(ps.overall_satisfaction_q9), 0), 2) AS "전반적만족도(9번항목)",
    ROUND(COALESCE(AVG(ps.element_satisfaction), 0), 2) AS "요소만족도(1~6번항목의 평균값)",
    ROUND(COALESCE(AVG(ps.social_satisfaction), 0), 2) AS "사회적만족도(7,8번항목의 평균값)",
    ROUND(COALESCE(AVG(ps.comprehensive_satisfaction), 0), 2) AS "종합만족도(전반적50%+요소30%+사회적20%)"
FROM 
    survey_participants p
    LEFT JOIN survey_responses r ON p.token = r.participant_token
    LEFT JOIN survey_questions q ON r.question_id = q.id
    LEFT JOIN participant_satisfaction ps ON p.hospital_name = ps.hospital_name AND p.token = ps.token
WHERE 
    -- Added survey_id filter to prevent data mixing
    p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
GROUP BY 
    p.hospital_name
ORDER BY 
    "완료수" DESC;

-- ============================================
-- 5. 병원별 문항별 상세 통계
-- (병원명, 문항번호, 문항내용, 문항유형, 응답수, 평균점수, 100점환산점수, 응답내용(주관식))

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- ============================================

SELECT 
    p.hospital_name AS "병원명",
    q.question_number AS "문항번호",
    q.question_text AS "문항내용",
    CASE 
        WHEN q.question_type = 'objective' THEN '객관식'
        WHEN q.question_type = 'subjective' THEN '주관식'
        ELSE q.question_type
    END AS "문항유형",
    COUNT(r.id) AS "응답수",
    CASE 
        WHEN q.question_type = 'objective' THEN ROUND(AVG(r.response_value), 2)::text
        ELSE '-'
    END AS "평균점수",
    CASE 
        WHEN q.question_type = 'objective' THEN ROUND(AVG((r.response_value - 1) / 4.0 * 100), 2)::text
        ELSE '-'
    END AS "100점환산점수",
    CASE 
        WHEN q.question_type = 'subjective' THEN 
            STRING_AGG(
                CASE 
                    WHEN r.response_text IS NOT NULL AND r.response_text != '' 
                    THEN r.response_text 
                END, 
                ' | ' 
                ORDER BY r.created_at
            )
        ELSE '-'
    END AS "응답내용"
FROM 
    survey_participants p
    CROSS JOIN survey_questions q
    LEFT JOIN survey_responses r ON p.token = r.participant_token AND q.id = r.question_id
WHERE 
    -- Added survey_id filter to prevent data mixing
    p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
GROUP BY 
    p.hospital_name, q.id, q.question_number, q.question_text, q.question_type
ORDER BY 
    p.hospital_name, q.question_number;

-- ============================================
-- 6. 주관식 응답내용
-- (문항번호, 병원명, 응답내용)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요
-- ============================================

SELECT 
    q.question_number AS "문항번호",
    p.hospital_name AS "병원명",
    r.response_text AS "응답내용",
    r.created_at AS "응답일시"
FROM 
    survey_responses r
    INNER JOIN survey_questions q ON r.question_id = q.id
    INNER JOIN survey_participants p ON r.participant_token = p.token
WHERE 
    q.question_type = 'subjective'
    AND r.response_text IS NOT NULL
    AND r.response_text != ''
    -- Added survey_id filter to prevent data mixing
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
ORDER BY 
    q.question_number, p.hospital_name, r.created_at;

-- 인구통계학적 특성별 만족도 분석
-- 성별, 나이대별, 관할별, 종별, 입원/외래별, 자격유형별 평균점수, 100점환산점수, 개별문항점수, 종합만족도

-- 사용법: 아래 모든 쿼리의 'YOUR_SURVEY_ID_HERE'를 실제 설문 ID로 변경하세요
-- 예: WHERE sp.survey_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- ============================================
-- 7. 성별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.gender,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, sp.gender
)
SELECT 
  '성별' as 구분,
  COALESCE(gender, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY gender
ORDER BY 카테고리;

-- ============================================
-- 8. 나이대별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    CASE 
      WHEN sp.age BETWEEN 10 AND 19 THEN '10대'
      WHEN sp.age BETWEEN 20 AND 29 THEN '20대'
      WHEN sp.age BETWEEN 30 AND 39 THEN '30대'
      WHEN sp.age BETWEEN 40 AND 49 THEN '40대'
      WHEN sp.age BETWEEN 50 AND 59 THEN '50대'
      WHEN sp.age BETWEEN 60 AND 69 THEN '60대'
      WHEN sp.age BETWEEN 70 AND 79 THEN '70대'
      WHEN sp.age BETWEEN 80 AND 89 THEN '80대'
      WHEN sp.age >= 90 THEN '90대 이상'
      ELSE '미입력'
    END as age_group,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, age_group
)
SELECT 
  '나이대별' as 구분,
  age_group as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY age_group
ORDER BY 
  CASE age_group
    WHEN '10대' THEN 1
    WHEN '20대' THEN 2
    WHEN '30대' THEN 3
    WHEN '40대' THEN 4
    WHEN '50대' THEN 5
    WHEN '60대' THEN 6
    WHEN '70대' THEN 7
    WHEN '80대' THEN 8
    WHEN '90대 이상' THEN 9
    ELSE 10
  END;

-- ============================================
-- 9. 관할별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.jurisdiction,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, sp.jurisdiction
)
SELECT 
  '관할별' as 구분,
  COALESCE(jurisdiction, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY jurisdiction
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";

-- ============================================
-- 10. 종별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.category,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, sp.category
)
SELECT 
  '종별' as 구분,
  COALESCE(category, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY category
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";

-- ============================================
-- 11. 입원/외래별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.inpatient_outpatient,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, sp.inpatient_outpatient
)
SELECT 
  '입원/외래별' as 구분,
  COALESCE(inpatient_outpatient, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY inpatient_outpatient
ORDER BY 카테고리;

-- ============================================
-- 12. 자격유형별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.qualification_type,
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    AND sp.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND sq.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
  GROUP BY sp.token, sp.qualification_type
)
SELECT 
  '자격유형별' as 구분,
  COALESCE(qualification_type, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as "평균점수(1~9항목평균)",
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수(평균점수의 100점환산값)",
  ROUND(AVG(q1_convenience)::numeric, 2) as "편익성(1번항목)",
  ROUND(AVG(q2_responsiveness)::numeric, 2) as "대응성(2번항목)",
  ROUND(AVG(q3_professionalism)::numeric, 2) as "전문성(3번항목)",
  ROUND(AVG(q4_empathy)::numeric, 2) as "공감성(4번항목)",
  ROUND(AVG(q5_ease_of_use)::numeric, 2) as "편리성(5번항목)",
  ROUND(AVG(q6_aesthetics)::numeric, 2) as "심미성(6번항목)",
  ROUND(AVG(q7_reliability)::numeric, 2) as "신뢰성(7번항목)",
  ROUND(AVG(q8_public_interest)::numeric, 2) as "공익성(8번항목)",
  ROUND(AVG(q9_score_100)::numeric, 2) as "전반적만족도(9번항목)",
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as "요소만족도(1~6번항목의 평균값)",
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as "사회적만족도(7,8번항목의 평균값)",
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY qualification_type
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";
