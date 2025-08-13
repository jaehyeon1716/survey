-- 토큰 기반 병원 만족도 조사 시스템

-- 1. 설문 참여자 테이블 (토큰과 참여자 정보)
CREATE TABLE IF NOT EXISTS survey_participants (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  hospital_name VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. 설문 응답 테이블 (토큰으로 연결)
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) NOT NULL REFERENCES survey_participants(token) ON DELETE CASCADE,
  
  -- 9개 설문 문항 (1-5점 척도)
  question_1 INTEGER CHECK (question_1 >= 1 AND question_1 <= 5),
  question_2 INTEGER CHECK (question_2 >= 1 AND question_2 <= 5),
  question_3 INTEGER CHECK (question_3 >= 1 AND question_3 <= 5),
  question_4 INTEGER CHECK (question_4 >= 1 AND question_4 <= 5),
  question_5 INTEGER CHECK (question_5 >= 1 AND question_5 <= 5),
  question_6 INTEGER CHECK (question_6 >= 1 AND question_6 <= 5),
  question_7 INTEGER CHECK (question_7 >= 1 AND question_7 <= 5),
  question_8 INTEGER CHECK (question_8 >= 1 AND question_8 <= 5),
  question_9 INTEGER CHECK (question_9 >= 1 AND question_9 <= 5),
  
  -- 총점 계산
  total_score INTEGER,
  
  -- 추가 정보
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 총점 자동 계산을 위한 트리거 함수
CREATE OR REPLACE FUNCTION calculate_survey_total_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_score = COALESCE(NEW.question_1, 0) + 
                   COALESCE(NEW.question_2, 0) + 
                   COALESCE(NEW.question_3, 0) + 
                   COALESCE(NEW.question_4, 0) + 
                   COALESCE(NEW.question_5, 0) + 
                   COALESCE(NEW.question_6, 0) + 
                   COALESCE(NEW.question_7, 0) + 
                   COALESCE(NEW.question_8, 0) + 
                   COALESCE(NEW.question_9, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 설문 응답 테이블에 트리거 생성
CREATE TRIGGER trigger_calculate_survey_total_score
  BEFORE INSERT OR UPDATE ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_survey_total_score();

-- 참여자 완료 상태 업데이트 함수
CREATE OR REPLACE FUNCTION update_participant_completion()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE survey_participants 
  SET is_completed = TRUE, completed_at = NOW()
  WHERE token = NEW.token;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 설문 완료 시 참여자 상태 업데이트 트리거
CREATE TRIGGER trigger_update_participant_completion
  AFTER INSERT ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_completion();

-- 토큰 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_survey_participants_token ON survey_participants(token);
CREATE INDEX IF NOT EXISTS idx_survey_responses_token ON survey_responses(token);
