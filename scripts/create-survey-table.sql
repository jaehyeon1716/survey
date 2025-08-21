-- 병원 만족도 조사 테이블 생성
CREATE TABLE IF NOT EXISTS hospital_surveys (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
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
  user_agent TEXT
);

-- 총점 자동 계산을 위한 트리거 함수
CREATE OR REPLACE FUNCTION calculate_total_score()
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

-- 트리거 생성
CREATE TRIGGER trigger_calculate_total_score
  BEFORE INSERT OR UPDATE ON hospital_surveys
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_score();
