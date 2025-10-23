# 데이터베이스 스크립트 가이드

이 폴더는 설문조사 시스템의 데이터베이스 스크립트를 포함하고 있습니다.

## 📁 폴더 구조

### `setup/` - 데이터베이스 초기 설정 및 마이그레이션
새로운 데이터베이스를 설정하거나 기존 데이터베이스를 업데이트할 때 **순서대로** 실행해야 합니다.

1. **01-create-initial-tables.sql**
   - 초기 테이블 생성 (surveys, survey_questions, survey_participants, survey_responses)
   - 기본 제약조건 및 인덱스 설정
   - **새 데이터베이스 설정 시 가장 먼저 실행**

2. **02-add-participant-fields.sql**
   - survey_participants 테이블에 새로운 컬럼 추가
   - 추가 컬럼: 관할, 기관기호, 기관명, 종별, 성명, 나이, 성별, 휴대전화, 입원외래, 자격유형

3. **03-add-question-types.sql**
   - survey_questions 테이블에 question_type 컬럼 추가
   - 객관식/주관식 구분 기능

4. **04-add-response-scale-type.sql**
   - survey_questions 테이블에 response_scale_type 컬럼 추가
   - 5점 척도 등 응답 유형 구분

5. **05-fix-subjective-constraint.sql**
   - 주관식 문항의 response_value 제약조건 수정
   - NULL 허용 처리

### `queries/` - 데이터 추출 쿼리
통계 및 분석을 위한 데이터 조회 쿼리입니다. 각 쿼리 실행 전 `YOUR_SURVEY_ID_HERE`를 실제 설문 ID로 변경해야 합니다.

- **stats-query-1-objective-questions.sql**: 객관식 문항별 통계
- **stats-query-2-hospital-stats.sql**: 병원별 종합 통계
- **stats-query-3-subjective-questions.sql**: 주관식 문항 통계
- **stats-query-4-hospital-stats-detailed.sql**: 병원별 상세 통계 (개별 문항 포함)
- **stats-query-5-hospital-question-details.sql**: 병원별 문항별 상세 통계
- **stats-query-6-subjective-responses.sql**: 주관식 응답 내용
- **stats-query-7-demographic-satisfaction.sql**: 인구통계학적 특성별 만족도 분석

### `test-data/` - 테스트 데이터 생성
개발 및 테스트 목적으로 샘플 데이터를 생성하는 스크립트입니다.

- **add-incremental-responses.sql**: 기존 데이터에 추가 응답 생성

## 🚀 새 데이터베이스 설정 방법

1. Supabase SQL Editor를 엽니다
2. `setup/` 폴더의 스크립트를 **01번부터 05번까지 순서대로** 실행합니다
3. 각 스크립트 실행 후 오류가 없는지 확인합니다

## 📊 통계 데이터 조회 방법

1. `queries/` 폴더에서 원하는 쿼리 파일을 엽니다
2. 파일 상단의 `YOUR_SURVEY_ID_HERE`를 실제 설문 ID로 변경합니다
3. Supabase SQL Editor에서 쿼리를 실행합니다

## ⚠️ 주의사항

- **setup/** 스크립트는 순서대로 실행해야 합니다
- 이미 실행한 마이그레이션 스크립트를 다시 실행하면 오류가 발생할 수 있습니다
- **test-data/** 스크립트는 프로덕션 환경에서 실행하지 마세요
- **queries/** 스크립트는 데이터를 조회만 하며 수정하지 않습니다
