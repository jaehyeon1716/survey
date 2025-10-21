-- 5. 병원별 문항별 상세 통계
-- (병원명, 문항번호, 문항내용, 문항유형, 응답수, 평균점수, 응답내용(주관식))

SELECT 
    p.hospital_name AS "병원명",
    q.question_number AS "문항번호",
    q.question_text AS "문항내용",
    CASE 
        WHEN q.question_type = 'objective' THEN '객관식'
        WHEN q.question_type = 'subjective' THEN '주관식'
        ELSE q.question_type
    END AS "문항유형",
    COUNT(r.id) AS "응답수",
    CASE 
        WHEN q.question_type = 'objective' THEN ROUND(AVG(r.response_value), 2)::text
        ELSE '-'
    END AS "평균점수",
    CASE 
        WHEN q.question_type = 'subjective' THEN 
            STRING_AGG(
                CASE 
                    WHEN r.response_text IS NOT NULL AND r.response_text != '' 
                    THEN r.response_text 
                END, 
                ' | ' 
                ORDER BY r.created_at
            )
        ELSE '-'
    END AS "응답내용"
FROM 
    survey_participants p
    CROSS JOIN survey_questions q
    LEFT JOIN survey_responses r ON p.token = r.participant_token AND q.id = r.question_id
WHERE 
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- p.survey_id = 1 AND q.survey_id = 1
    true
GROUP BY 
    p.hospital_name, q.id, q.question_number, q.question_text, q.question_type
ORDER BY 
    p.hospital_name, q.question_number;
