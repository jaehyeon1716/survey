-- 설문지 기본 정보 테이블
CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 설문지 테이블 RLS 활성화
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- 설문지는 모든 사용자가 읽을 수 있도록 (공개 설문)
CREATE POLICY "Allow public read access to surveys" ON surveys FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to surveys" ON surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to surveys" ON surveys FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to surveys" ON surveys FOR DELETE USING (true);

-- 설문 문항 테이블 (질문과 답변 옵션 포함)
CREATE TABLE IF NOT EXISTS survey_questions (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  answer_options JSONB NOT NULL, -- 답변 옵션들을 JSON 배열로 저장
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 설문 문항 테이블 RLS 활성화
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to survey_questions" ON survey_questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to survey_questions" ON survey_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to survey_questions" ON survey_questions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to survey_questions" ON survey_questions FOR DELETE USING (true);

-- 설문 참여자 테이블
CREATE TABLE IF NOT EXISTS survey_participants (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  hospital_name VARCHAR(255),
  participant_name VARCHAR(100),
  phone_number VARCHAR(20),
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 설문 참여자 테이블 RLS 활성화
ALTER TABLE survey_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to survey_participants" ON survey_participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to survey_participants" ON survey_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to survey_participants" ON survey_participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to survey_participants" ON survey_participants FOR DELETE USING (true);

-- 설문 응답 테이블
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES survey_participants(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL, -- 선택한 답변 텍스트
  answer_value INTEGER, -- 답변의 점수 값 (있는 경우)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_id, question_id) -- 중복 응답 방지
);

-- 설문 응답 테이블 RLS 활성화
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to survey_responses" ON survey_responses FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to survey_responses" ON survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to survey_responses" ON survey_responses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to survey_responses" ON survey_responses FOR DELETE USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_id ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_participants_token ON survey_participants(token);
CREATE INDEX IF NOT EXISTS idx_survey_participants_survey_id ON survey_participants(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_participant_id ON survey_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_question_id ON survey_responses(question_id);
