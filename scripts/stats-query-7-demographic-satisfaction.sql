-- 인구통계학적 특성별 만족도 분석
-- 성별, 나이대별, 관할별, 종별, 입원/외래별, 자격유형별 평균점수, 100점환산점수, 종합만족도

-- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
-- WHERE sq.survey_id = 'your-survey-id-here'

-- ============================================
-- 1. 성별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.gender,
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, sp.gender
)
SELECT 
  '성별' as 구분,
  COALESCE(gender, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
FROM participant_scores
GROUP BY gender
ORDER BY 카테고리;

-- ============================================
-- 2. 나이대별 만족도
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
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, age_group
)
SELECT 
  '나이대별' as 구분,
  age_group as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
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
-- 3. 관할별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.jurisdiction,
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, sp.jurisdiction
)
SELECT 
  '관할별' as 구분,
  COALESCE(jurisdiction, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
FROM participant_scores
GROUP BY jurisdiction
ORDER BY 종합만족도 DESC;

-- ============================================
-- 4. 종별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.category,
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, sp.category
)
SELECT 
  '종별' as 구분,
  COALESCE(category, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
FROM participant_scores
GROUP BY category
ORDER BY 종합만족도 DESC;

-- ============================================
-- 5. 입원/외래별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.inpatient_outpatient,
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, sp.inpatient_outpatient
)
SELECT 
  '입원/외래별' as 구분,
  COALESCE(inpatient_outpatient, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
FROM participant_scores
GROUP BY inpatient_outpatient
ORDER BY 카테고리;

-- ============================================
-- 6. 자격유형별 만족도
-- ============================================
WITH participant_scores AS (
  SELECT 
    sp.token,
    sp.qualification_type,
    -- 평균점수 (1-5점 척도)
    AVG(sr.response_value) as avg_score,
    -- 9번 문항 점수
    AVG(CASE WHEN sq.question_number = 9 THEN sr.response_value END) as q9_score,
    -- 9번 문항 100점 환산
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    -- 1-6번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN sr.response_value END) as q1_6_avg,
    -- 1-6번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
    -- 7-8번 문항 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN sr.response_value END) as q7_8_avg,
    -- 7-8번 문항 100점 환산 평균
    AVG(CASE WHEN sq.question_number BETWEEN 7 AND 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_8_avg_100
  FROM survey_participants sp
  JOIN survey_responses sr ON sp.token = sr.participant_token
  JOIN survey_questions sq ON sr.question_id = sq.id
  WHERE sq.question_type = 'objective'
    AND sp.is_completed = true
    -- AND sq.survey_id = 'your-survey-id-here'  -- 필요시 주석 해제
  GROUP BY sp.token, sp.qualification_type
)
SELECT 
  '자격유형별' as 구분,
  COALESCE(qualification_type, '미입력') as 카테고리,
  COUNT(*) as 응답수,
  ROUND(AVG(avg_score)::numeric, 2) as 평균점수,
  ROUND(AVG((avg_score - 1) / 4.0 * 100)::numeric, 2) as "100점환산점수",
  -- Added three new satisfaction columns
  ROUND(AVG(q9_score_100)::numeric, 2) as 전반적만족도,
  ROUND(AVG(q1_6_avg_100)::numeric, 2) as 요소만족도,
  ROUND(AVG(q7_8_avg_100)::numeric, 2) as 사회적만족도,
  ROUND(AVG(
    (q9_score * 0.5 + q1_6_avg * 0.3 + q7_8_avg * 0.2 - 1) / 4.0 * 100
  )::numeric, 2) as 종합만족도
FROM participant_scores
GROUP BY qualification_type
ORDER BY 종합만족도 DESC;
