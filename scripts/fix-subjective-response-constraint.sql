-- 주관식 질문을 위한 response_value NULL 허용 수정

-- 1. 기존 CHECK 제약 조건 삭제
ALTER TABLE survey_responses 
DROP CONSTRAINT IF EXISTS survey_responses_response_value_check;

-- 2. response_value 컬럼을 NULL 허용으로 변경
ALTER TABLE survey_responses 
ALTER COLUMN response_value DROP NOT NULL;

-- 3. 새로운 CHECK 제약 조건 추가 (NULL 또는 1~5 사이의 값만 허용)
ALTER TABLE survey_responses 
ADD CONSTRAINT survey_responses_response_value_check 
CHECK (response_value IS NULL OR (response_value >= 1 AND response_value <= 5));

-- 4. 참여자 완료 상태 업데이트 함수 수정 (NULL 값 처리)
CREATE OR REPLACE FUNCTION update_participant_completion_status()
RETURNS TRIGGER AS $$
DECLARE
  total_questions INTEGER;
  answered_questions INTEGER;
  participant_survey_id INTEGER;
BEGIN
  -- 참여자의 설문 ID 가져오기
  SELECT survey_id INTO participant_survey_id 
  FROM survey_participants 
  WHERE token = NEW.participant_token;
  
  -- 해당 설문의 총 문항 수
  SELECT COUNT(*) INTO total_questions 
  FROM survey_questions 
  WHERE survey_id = participant_survey_id;
  
  -- 참여자가 답변한 문항 수
  SELECT COUNT(*) INTO answered_questions 
  FROM survey_responses 
  WHERE participant_token = NEW.participant_token;
  
  -- 모든 문항에 답변했으면 완료 상태로 업데이트
  IF answered_questions = total_questions THEN
    UPDATE survey_participants 
    SET is_completed = TRUE, completed_at = NOW()
    WHERE token = NEW.participant_token;
    
    -- 응답 요약 생성 또는 업데이트 (NULL 값 제외하고 합산)
    INSERT INTO survey_response_summaries (
      participant_token, 
      survey_id, 
      total_score, 
      max_possible_score
    )
    SELECT 
      NEW.participant_token,
      participant_survey_id,
      COALESCE(SUM(sr.response_value), 0), -- NULL 값 제외하고 합산
      (SELECT COUNT(*) FROM survey_questions sq 
       WHERE sq.survey_id = participant_survey_id 
       AND sq.question_type = 'objective') * 5 -- 객관식 문항만 카운트
    FROM survey_responses sr
    WHERE sr.participant_token = NEW.participant_token
    ON CONFLICT (participant_token) 
    DO UPDATE SET 
      total_score = EXCLUDED.total_score,
      max_possible_score = EXCLUDED.max_possible_score;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
