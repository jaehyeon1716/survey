-- 설문 완료 상태 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_survey_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- 참여자가 모든 질문에 답변했는지 확인
  UPDATE survey_participants 
  SET 
    is_completed = (
      SELECT COUNT(*) = (
        SELECT COUNT(*) 
        FROM survey_questions 
        WHERE survey_id = survey_participants.survey_id
      )
      FROM survey_responses sr
      JOIN survey_questions sq ON sr.question_id = sq.id
      WHERE sr.participant_id = NEW.participant_id
        AND sq.survey_id = survey_participants.survey_id
    ),
    completed_at = CASE 
      WHEN (
        SELECT COUNT(*) = (
          SELECT COUNT(*) 
          FROM survey_questions 
          WHERE survey_id = survey_participants.survey_id
        )
        FROM survey_responses sr
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sr.participant_id = NEW.participant_id
          AND sq.survey_id = survey_participants.survey_id
      ) THEN NOW()
      ELSE completed_at
    END
  WHERE id = NEW.participant_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_survey_completion ON survey_responses;
CREATE TRIGGER trigger_update_survey_completion
  AFTER INSERT OR UPDATE ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_completion();

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- surveys 테이블에 updated_at 트리거 적용
DROP TRIGGER IF EXISTS trigger_update_surveys_updated_at ON surveys;
CREATE TRIGGER trigger_update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
