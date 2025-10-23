-- 설문 관리 시스템 데이터베이스 스키마
-- 관리자가 여러 설문지를 생성하고 관리할 수 있는 시스템

-- 1. 설문지 테이블 (설문지 기본 정보)
CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 설문 문항 테이블 (각 설문지의 문항들)
CREATE TABLE IF NOT EXISTS survey_questions (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(survey_id, question_number)
);

-- 3. 설문 참여자 테이블 (특정 설문에 대한 참여자들)
CREATE TABLE IF NOT EXISTS survey_participants (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  hospital_name VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. 설문 응답 테이블 (설문 응답 결과)
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  participant_token VARCHAR(255) NOT NULL REFERENCES survey_participants(token) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  response_value INTEGER NOT NULL CHECK (response_value >= 1 AND response_value <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_token, question_id)
);

-- 5. 설문 응답 요약 테이블 (총점 및 요약 정보)
CREATE TABLE IF NOT EXISTS survey_response_summaries (
  id SERIAL PRIMARY KEY,
  participant_token VARCHAR(255) UNIQUE NOT NULL REFERENCES survey_participants(token) ON DELETE CASCADE,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL,
  max_possible_score INTEGER NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_id ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_participants_survey_id ON survey_participants(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_participants_token ON survey_participants(token);
CREATE INDEX IF NOT EXISTS idx_survey_responses_participant_token ON survey_responses(participant_token);
CREATE INDEX IF NOT EXISTS idx_survey_responses_question_id ON survey_responses(question_id);

-- 참여자 완료 상태 업데이트 함수
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
    
    -- 응답 요약 생성 또는 업데이트
    INSERT INTO survey_response_summaries (
      participant_token, 
      survey_id, 
      total_score, 
      max_possible_score
    )
    SELECT 
      NEW.participant_token,
      participant_survey_id,
      SUM(sr.response_value),
      total_questions * 5
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

-- 설문 완료 상태 업데이트 트리거
CREATE TRIGGER trigger_update_completion_status
  AFTER INSERT OR UPDATE ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_completion_status();

-- 중복 응답 방지를 위한 함수
CREATE OR REPLACE FUNCTION prevent_duplicate_response()
RETURNS TRIGGER AS $$
BEGIN
  -- 이미 완료된 참여자인지 확인
  IF EXISTS (
    SELECT 1 FROM survey_participants 
    WHERE token = NEW.participant_token AND is_completed = TRUE
  ) THEN
    RAISE EXCEPTION '이미 설문을 완료한 참여자입니다.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 중복 응답 방지 트리거
CREATE TRIGGER trigger_prevent_duplicate_response
  BEFORE INSERT ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_response();
