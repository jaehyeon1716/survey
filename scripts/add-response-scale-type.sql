-- 설문지에 응답 스케일 타입 추가
-- 기본값: 'agreement' (매우 그렇다 ~ 전혀 그렇지 않다)
-- 선택값: 'satisfaction' (매우 만족한다 ~ 매우 만족하지 않는다)

ALTER TABLE surveys 
ADD COLUMN IF NOT EXISTS response_scale_type VARCHAR(20) DEFAULT 'agreement';

-- 기존 데이터에 기본값 설정
UPDATE surveys 
SET response_scale_type = 'agreement' 
WHERE response_scale_type IS NULL;
