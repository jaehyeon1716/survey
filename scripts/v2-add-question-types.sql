-- 주관식 질문 지원을 위한 스키마 업데이트

-- 1. survey_questions 테이블에 question_type 컬럼 추가
ALTER TABLE survey_questions 
ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) DEFAULT 'multiple_choice' 
CHECK (question_type IN ('multiple_choice', 'subjective'));

-- 2. survey_responses 테이블에 response_text 컬럼 추가 (주관식 답변용)
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS response_text TEXT;

-- 3. response_value를 nullable로 변경 (주관식은 점수가 없음)
ALTER TABLE survey_responses 
ALTER COLUMN response_value DROP NOT NULL;

-- 4. 체크 제약조건 업데이트 (주관식은 response_value가 null일 수 있음)
ALTER TABLE survey_responses 
DROP CONSTRAINT IF EXISTS survey_responses_response_value_check;

ALTER TABLE survey_responses 
ADD CONSTRAINT survey_responses_response_value_check 
CHECK (
  (question_type = 'multiple_choice' AND response_value >= 1 AND response_value <= 5) OR
  (question_type = 'subjective' AND response_text IS NOT NULL)
);

-- 5. question_type 컬럼 추가 (응답 테이블에서 질문 타입 추적)
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS question_type VARCHAR(20);

-- 6. 기존 데이터 업데이트 (모든 기존 질문을 객관식으로 설정)
UPDATE survey_questions 
SET question_type = 'multiple_choice' 
WHERE question_type IS NULL;

UPDATE survey_responses 
SET question_type = 'multiple_choice' 
WHERE question_type IS NULL;
