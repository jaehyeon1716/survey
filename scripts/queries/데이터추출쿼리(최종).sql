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
        -- 완료된 응답자만 포함하도록 필터 추가
        AND p.is_completed = true
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

-- ============================================
-- 13. 병원별 인구통계학적 특성별 종합만족도 비교
-- (순위, 병원명, 전체종합만족도점수, 입원, 외래, 남자, 여자, 50대미만, 50대, 60대, 70대, 80대, 90대이상)

-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요

-- Query 4와 동일한 계산 방식을 사용하도록 수정
-- ============================================

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
