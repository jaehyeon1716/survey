-- 주관식 질문 지원을 위한 스키마 업데이트

-- 1. survey_questions 테이블에 question_type 컬럼 추가
ALTER TABLE survey_questions 
ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'objective' CHECK (question_type IN ('objective', 'subjective'));

-- 2. survey_responses 테이블에 response_text 컬럼 추가 (주관식 응답용)
-- text_response를 response_text로 변경
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS response_text TEXT;

-- 3. response_value를 nullable로 변경 (주관식은 점수가 없음)
ALTER TABLE survey_responses 
ALTER COLUMN response_value DROP NOT NULL;

-- 4. 기존 제약조건 업데이트 - response_value는 객관식일 때만 필수
ALTER TABLE survey_responses 
DROP CONSTRAINT IF EXISTS survey_responses_response_value_check;

-- text_response를 response_text로 변경
ALTER TABLE survey_responses 
ADD CONSTRAINT survey_responses_response_value_check 
CHECK (
  (response_value IS NULL AND response_text IS NOT NULL) OR 
  (response_value IS NOT NULL AND response_value >= 1 AND response_value <= 5)
);

-- 5. 기존 데이터는 모두 객관식으로 설정
UPDATE survey_questions 
SET question_type = 'objective' 
WHERE question_type IS NULL;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_survey_questions_type ON survey_questions(question_type);

-- 7. 완료 상태 업데이트 함수 수정 (주관식 포함)
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
    
    -- 응답 요약 생성 또는 업데이트 (객관식 점수만 합산)
    INSERT INTO survey_response_summaries (
      participant_token, 
      survey_id, 
      total_score, 
      max_possible_score
    )
    SELECT 
      NEW.participant_token,
      participant_survey_id,
      COALESCE(SUM(sr.response_value), 0),
      (SELECT COUNT(*) FROM survey_questions WHERE survey_id = participant_survey_id AND question_type = 'objective') * 5
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
