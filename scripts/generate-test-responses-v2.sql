DO $$
DECLARE
    v_survey_id INTEGER;
    v_batch_size INTEGER := 1000; -- 한 번에 처리할 참여자 수
    v_offset INTEGER := 0;
    v_total_participants INTEGER;
    v_processed INTEGER := 0;
    v_objective_count INTEGER;
    v_subjective_count INTEGER;
    v_current_batch_size INTEGER;
BEGIN
    -- 설문지 ID 가져오기 (가장 최근 설문지)
    SELECT id INTO v_survey_id 
    FROM surveys 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_survey_id IS NULL THEN
        RAISE EXCEPTION '설문지를 찾을 수 없습니다.';
    END IF;
    
    -- 문항 수 확인
    SELECT COUNT(*) INTO v_objective_count
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'objective';
    
    SELECT COUNT(*) INTO v_subjective_count
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'subjective';
    
    -- 전체 참여자 수 확인
    SELECT COUNT(*) INTO v_total_participants
    FROM survey_participants
    WHERE survey_id = v_survey_id;
    
    RAISE NOTICE '=== 설문 응답 생성 시작 ===';
    RAISE NOTICE '설문지 ID: %', v_survey_id;
    RAISE NOTICE '객관식 문항: %개', v_objective_count;
    RAISE NOTICE '주관식 문항: %개', v_subjective_count;
    RAISE NOTICE '전체 참여자: %명', v_total_participants;
    RAISE NOTICE '배치 크기: %명', v_batch_size;
    RAISE NOTICE '';
    
    -- 배치 단위로 처리
    WHILE v_offset < v_total_participants LOOP
        v_current_batch_size := LEAST(v_batch_size, v_total_participants - v_offset);
        
        -- 1. 객관식 응답 생성 (모든 참여자 × 모든 객관식 문항)
        WITH batch_participants AS (
            SELECT token
            FROM survey_participants
            WHERE survey_id = v_survey_id
            ORDER BY token
            LIMIT v_batch_size OFFSET v_offset
        ),
        objective_questions AS (
            SELECT id as question_id
            FROM survey_questions
            WHERE survey_id = v_survey_id AND question_type = 'objective'
        )
        INSERT INTO survey_responses (participant_token, question_id, response_value, response_text)
        SELECT 
            p.token,
            q.question_id,
            FLOOR(random() * 5 + 1)::INTEGER, -- 1-5 랜덤 점수
            NULL
        FROM batch_participants p
        CROSS JOIN objective_questions q
        ON CONFLICT (participant_token, question_id) DO NOTHING;
        
        -- 2. 주관식 응답 생성 (50% 참여자만 응답)
        WITH batch_participants AS (
            SELECT token
            FROM survey_participants
            WHERE survey_id = v_survey_id
            ORDER BY token
            LIMIT v_batch_size OFFSET v_offset
        ),
        subjective_questions AS (
            SELECT id as question_id
            FROM survey_questions
            WHERE survey_id = v_survey_id AND question_type = 'subjective'
        ),
        -- 50% 참여자 선택
        selected_participants AS (
            SELECT token
            FROM batch_participants
            WHERE random() < 0.5
        )
        INSERT INTO survey_responses (participant_token, question_id, response_value, response_text)
        SELECT 
            p.token,
            q.question_id,
            NULL,
            (ARRAY[
                '서비스가 전반적으로 만족스러웠습니다.',
                '직원분들이 매우 친절하셨습니다.',
                '시설이 깨끗하고 쾌적했습니다.',
                '대기 시간이 적절했습니다.',
                '전문적인 상담을 받을 수 있었습니다.',
                '다음에도 이용하고 싶습니다.',
                '주변 사람들에게 추천하고 싶습니다.',
                '개선이 필요한 부분이 있습니다.',
                '전반적으로 좋은 경험이었습니다.',
                '기대 이상의 서비스였습니다.'
            ])[FLOOR(random() * 10 + 1)::INTEGER]
        FROM selected_participants p
        CROSS JOIN subjective_questions q
        ON CONFLICT (participant_token, question_id) DO NOTHING;
        
        v_processed := v_processed + v_current_batch_size;
        v_offset := v_offset + v_batch_size;
        
        RAISE NOTICE '진행: % / % 명 (%.1f%%)', 
            v_processed, 
            v_total_participants,
            (v_processed::FLOAT / v_total_participants * 100);
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== 응답 생성 완료 ===';
    
    -- 상세 통계 출력
    DECLARE
        v_total_responses INTEGER;
        v_objective_responses INTEGER;
        v_subjective_responses INTEGER;
        v_completed_participants INTEGER;
        v_participants_with_objective INTEGER;
        v_participants_with_subjective INTEGER;
    BEGIN
        -- 총 응답 레코드 수
        SELECT COUNT(*) INTO v_total_responses
        FROM survey_responses sr
        JOIN survey_participants sp ON sr.participant_token = sp.token
        WHERE sp.survey_id = v_survey_id;
        
        -- 객관식 응답 수
        SELECT COUNT(*) INTO v_objective_responses
        FROM survey_responses sr
        JOIN survey_participants sp ON sr.participant_token = sp.token
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sp.survey_id = v_survey_id AND sq.question_type = 'objective';
        
        -- 주관식 응답 수
        SELECT COUNT(*) INTO v_subjective_responses
        FROM survey_responses sr
        JOIN survey_participants sp ON sr.participant_token = sp.token
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sp.survey_id = v_survey_id AND sq.question_type = 'subjective';
        
        -- 완료한 참여자 수 (is_completed = true)
        SELECT COUNT(*) INTO v_completed_participants
        FROM survey_participants
        WHERE survey_id = v_survey_id AND is_completed = true;
        
        -- 객관식 응답한 참여자 수 (고유)
        SELECT COUNT(DISTINCT sr.participant_token) INTO v_participants_with_objective
        FROM survey_responses sr
        JOIN survey_participants sp ON sr.participant_token = sp.token
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sp.survey_id = v_survey_id AND sq.question_type = 'objective';
        
        -- 주관식 응답한 참여자 수 (고유)
        SELECT COUNT(DISTINCT sr.participant_token) INTO v_participants_with_subjective
        FROM survey_responses sr
        JOIN survey_participants sp ON sr.participant_token = sp.token
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sp.survey_id = v_survey_id AND sq.question_type = 'subjective';
        
        RAISE NOTICE '총 응답 레코드: %개', v_total_responses;
        RAISE NOTICE '객관식 응답: %개 (참여자당 %개 문항)', v_objective_responses, v_objective_count;
        RAISE NOTICE '주관식 응답: %개 (참여자당 %개 문항)', v_subjective_responses, v_subjective_count;
        RAISE NOTICE '';
        RAISE NOTICE '객관식 응답한 참여자: %명 (%.1f%%)', 
            v_participants_with_objective,
            (v_participants_with_objective::FLOAT / v_total_participants * 100);
        RAISE NOTICE '주관식 응답한 참여자: %명 (%.1f%%)', 
            v_participants_with_subjective,
            (v_participants_with_subjective::FLOAT / v_total_participants * 100);
        RAISE NOTICE '완료 상태 참여자: %명 (%.1f%%)', 
            v_completed_participants,
            (v_completed_participants::FLOAT / v_total_participants * 100);
        RAISE NOTICE '';
        RAISE NOTICE '예상 객관식 응답: % × % = %개', 
            v_total_participants, v_objective_count, (v_total_participants * v_objective_count);
        RAISE NOTICE '예상 주관식 응답: % × % × 50%% = 약 %개', 
            v_total_participants, v_subjective_count, (v_total_participants * v_subjective_count / 2);
    END;
    
END $$;
