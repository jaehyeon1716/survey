-- 인구통계학적 특성별 만족도 분석
-- 성별, 나이대별, 관할별, 종별, 입원/외래별, 자격유형별 평균점수, 100점환산점수, 개별문항점수, 종합만족도

-- 사용법: 아래 모든 쿼리의 'YOUR_SURVEY_ID_HERE'를 실제 설문 ID로 변경하세요
-- 예: WHERE sp.survey_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

-- ============================================
-- 1. 성별 만족도
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
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
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
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
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
-- 3. 관할별 만족도
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
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY jurisdiction
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";

-- ============================================
-- 4. 종별 만족도
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
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY category
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";

-- ============================================
-- 5. 입원/외래별 만족도
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
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
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
    AVG(sr.response_value) as avg_score,
    AVG(CASE WHEN sq.question_number = 1 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_convenience,
    AVG(CASE WHEN sq.question_number = 2 THEN (sr.response_value - 1) / 4.0 * 100 END) as q2_responsiveness,
    AVG(CASE WHEN sq.question_number = 3 THEN (sr.response_value - 1) / 4.0 * 100 END) as q3_professionalism,
    AVG(CASE WHEN sq.question_number = 4 THEN (sr.response_value - 1) / 4.0 * 100 END) as q4_empathy,
    AVG(CASE WHEN sq.question_number = 5 THEN (sr.response_value - 1) / 4.0 * 100 END) as q5_ease_of_use,
    AVG(CASE WHEN sq.question_number = 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q6_aesthetics,
    AVG(CASE WHEN sq.question_number = 7 THEN (sr.response_value - 1) / 4.0 * 100 END) as q7_reliability,
    AVG(CASE WHEN sq.question_number = 8 THEN (sr.response_value - 1) / 4.0 * 100 END) as q8_public_interest,
    AVG(CASE WHEN sq.question_number = 9 THEN (sr.response_value - 1) / 4.0 * 100 END) as q9_score_100,
    AVG(CASE WHEN sq.question_number BETWEEN 1 AND 6 THEN (sr.response_value - 1) / 4.0 * 100 END) as q1_6_avg_100,
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
    q9_score_100 * 0.5 + q1_6_avg_100 * 0.3 + q7_8_avg_100 * 0.2
  )::numeric, 2) as "종합만족도(전반적50%+요소30%+사회적20%)"
FROM participant_scores
GROUP BY qualification_type
ORDER BY "종합만족도(전반적50%+요소30%+사회적20%)";
