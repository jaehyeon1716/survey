-- 문항별로 응답 스케일 타입을 설정할 수 있도록 survey_questions 테이블에 컬럼 추가
-- 기본값: 'agreement' (매우 그렇다 ~ 전혀 그렇지 않다)
-- 선택값: 'satisfaction' (매우 만족한다 ~ 매우 만족하지 않는다)

-- surveys 테이블에서 response_scale_type 컬럼 제거 (있다면)
ALTER TABLE surveys 
DROP COLUMN IF EXISTS response_scale_type;

-- survey_questions 테이블에 response_scale_type 컬럼 추가
ALTER TABLE survey_questions 
ADD COLUMN IF NOT EXISTS response_scale_type VARCHAR(20) DEFAULT 'agreement';

-- 기존 데이터에 기본값 설정
UPDATE survey_questions 
SET response_scale_type = 'agreement' 
WHERE response_scale_type IS NULL;
