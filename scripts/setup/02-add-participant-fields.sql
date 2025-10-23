-- 참여자 테이블에 새로운 필드 추가
-- 기존: 병원명, 대상자이름, 휴대폰번호
-- 추가: 관할, 기관기호, 기관명, 종별, 성명, 나이, 성별, 휴대전화, 입원외래, 자격유형

ALTER TABLE survey_participants
ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),  -- 관할
ADD COLUMN IF NOT EXISTS institution_code VARCHAR(50),  -- 기관기호
ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255),  -- 기관명
ADD COLUMN IF NOT EXISTS category VARCHAR(100),  -- 종별
ADD COLUMN IF NOT EXISTS name VARCHAR(255),  -- 성명
ADD COLUMN IF NOT EXISTS age INTEGER,  -- 나이
ADD COLUMN IF NOT EXISTS gender VARCHAR(10),  -- 성별
ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(20),  -- 휴대전화
ADD COLUMN IF NOT EXISTS inpatient_outpatient VARCHAR(50),  -- 입원외래
ADD COLUMN IF NOT EXISTS qualification_type VARCHAR(100);  -- 자격유형

-- 기존 컬럼은 유지 (하위 호환성)
-- hospital_name, participant_name, phone_number는 그대로 유지

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_survey_participants_institution_name ON survey_participants(institution_name);
CREATE INDEX IF NOT EXISTS idx_survey_participants_mobile_phone ON survey_participants(mobile_phone);

COMMENT ON COLUMN survey_participants.jurisdiction IS '관할';
COMMENT ON COLUMN survey_participants.institution_code IS '기관기호';
COMMENT ON COLUMN survey_participants.institution_name IS '기관명';
COMMENT ON COLUMN survey_participants.category IS '종별';
COMMENT ON COLUMN survey_participants.name IS '성명';
COMMENT ON COLUMN survey_participants.age IS '나이';
COMMENT ON COLUMN survey_participants.gender IS '성별';
COMMENT ON COLUMN survey_participants.mobile_phone IS '휴대전화';
COMMENT ON COLUMN survey_participants.inpatient_outpatient IS '입원외래';
COMMENT ON COLUMN survey_participants.qualification_type IS '자격유형';
