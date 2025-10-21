-- 25만명 참여자에 대한 설문 응답 데이터 생성 스크립트
-- 객관식 9개 (필수), 주관식 1개 (50% 확률)

-- 주의: 이 스크립트는 시간이 오래 걸릴 수 있습니다 (5-10분)
-- Supabase SQL Editor에서 실행하세요

DO $$
DECLARE
  survey_id_to_use INTEGER;
  objective_question_ids INTEGER[];
  subjective_question_ids INTEGER[];
  participant_record RECORD;
  -- Renamed variables to avoid ambiguity with column names
  q_id INTEGER;
  random_score INTEGER;
  random_texts TEXT[] := ARRAY[
    '매우 만족스러운 경험이었습니다.',
    '전반적으로 좋았으나 개선이 필요한 부분이 있습니다.',
    '서비스 품질이 우수했습니다.',
    '직원분들이 친절하고 전문적이었습니다.',
    '시설이 깨끗하고 잘 관리되어 있었습니다.',
    '대기 시간이 적절했습니다.',
    '설명이 명확하고 이해하기 쉬웠습니다.',
    '다음에도 이용하고 싶습니다.',
    '주변 사람들에게 추천하고 싶습니다.',
    '전문성과 신뢰도가 높았습니다.',
    '편안하고 안심할 수 있는 환경이었습니다.',
    '예약 및 접수 과정이 편리했습니다.',
    '충분한 시간을 할애해 주셨습니다.',
    '개인정보 보호가 잘 되어 있었습니다.',
    '전반적으로 매우 만족합니다.'
  ];
  batch_size INTEGER := 1000;
  total_processed INTEGER := 0;
  start_time TIMESTAMP;
BEGIN
  start_time := clock_timestamp();
  
  -- 1. 설문지 ID 가져오기 (가장 최근 설문지 사용)
  SELECT id INTO survey_id_to_use 
  FROM surveys 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF survey_id_to_use IS NULL THEN
    RAISE EXCEPTION '설문지가 존재하지 않습니다.';
  END IF;
  
  RAISE NOTICE '설문지 ID: %', survey_id_to_use;
  
  -- 2. 객관식 문항 ID 배열 가져오기
  SELECT ARRAY_AGG(id ORDER BY question_number) INTO objective_question_ids
  FROM survey_questions
  WHERE survey_id = survey_id_to_use AND question_type = 'objective';
  
  -- 3. 주관식 문항 ID 배열 가져오기
  SELECT ARRAY_AGG(id ORDER BY question_number) INTO subjective_question_ids
  FROM survey_questions
  WHERE survey_id = survey_id_to_use AND question_type = 'subjective';
  
  RAISE NOTICE '객관식 문항 수: %, 주관식 문항 수: %', 
    COALESCE(array_length(objective_question_ids, 1), 0),
    COALESCE(array_length(subjective_question_ids, 1), 0);
  
  -- 4. 각 참여자에 대해 응답 생성
  FOR participant_record IN 
    SELECT token 
    FROM survey_participants 
    WHERE survey_id = survey_id_to_use 
      AND is_completed = FALSE
    ORDER BY id
  LOOP
    -- 객관식 응답 생성 (모든 문항 필수)
    IF objective_question_ids IS NOT NULL THEN
      -- Changed loop variable from question_id to q_id
      FOREACH q_id IN ARRAY objective_question_ids
      LOOP
        random_score := floor(random() * 5 + 1)::INTEGER; -- 1-5 랜덤 점수
        
        INSERT INTO survey_responses (participant_token, question_id, response_value)
        VALUES (participant_record.token, q_id, random_score)
        ON CONFLICT (participant_token, question_id) DO NOTHING;
      END LOOP;
    END IF;
    
    -- 주관식 응답 생성 (50% 확률)
    IF subjective_question_ids IS NOT NULL THEN
      -- Changed loop variable from question_id to q_id
      FOREACH q_id IN ARRAY subjective_question_ids
      LOOP
        -- 50% 확률로 주관식 응답 생성
        IF random() < 0.5 THEN
          INSERT INTO survey_responses (participant_token, question_id, response_text)
          VALUES (
            participant_record.token, 
            q_id, 
            random_texts[floor(random() * array_length(random_texts, 1) + 1)::INTEGER]
          )
          ON CONFLICT (participant_token, question_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
    
    total_processed := total_processed + 1;
    
    -- 진행 상황 출력 (1000명마다)
    IF total_processed % batch_size = 0 THEN
      RAISE NOTICE '처리 완료: %명 (경과 시간: %)', 
        total_processed, 
        clock_timestamp() - start_time;
    END IF;
  END LOOP;
  
  RAISE NOTICE '===== 완료 =====';
  RAISE NOTICE '총 처리된 참여자: %명', total_processed;
  RAISE NOTICE '총 소요 시간: %', clock_timestamp() - start_time;
  
  -- 통계 출력
  RAISE NOTICE '생성된 응답 수: %', (
    SELECT COUNT(*) FROM survey_responses sr
    JOIN survey_participants sp ON sr.participant_token = sp.token
    WHERE sp.survey_id = survey_id_to_use
  );
  
  RAISE NOTICE '완료된 참여자 수: %', (
    SELECT COUNT(*) FROM survey_participants
    WHERE survey_id = survey_id_to_use AND is_completed = TRUE
  );
  
END $$;
