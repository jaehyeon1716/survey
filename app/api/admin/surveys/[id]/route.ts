import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300 // 대용량 데이터 삭제를 위해 타임아웃을 5분으로 증가

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const { title, description, questions } = await request.json()

    if (!title || !questions || questions.length === 0) {
      return NextResponse.json({ error: "제목과 문항은 필수입니다." }, { status: 400 })
    }

    const { error: surveyError } = await supabase
      .from("surveys")
      .update({
        title,
        description: description || "",
      })
      .eq("id", Number.parseInt(surveyId))

    if (surveyError) throw surveyError

    const { error: deleteError } = await supabase
      .from("survey_questions")
      .delete()
      .eq("survey_id", Number.parseInt(surveyId))

    if (deleteError) throw deleteError

    const questionsData = questions.map(
      (question: { text: string; type: string; responseScaleType?: string }, index: number) => ({
        survey_id: Number.parseInt(surveyId),
        question_number: index + 1,
        question_text: question.text,
        question_type: question.type || "objective",
        response_scale_type: question.responseScaleType || "agreement",
      }),
    )

    const { error: questionsError } = await supabase.from("survey_questions").insert(questionsData)

    if (questionsError) throw questionsError

    return NextResponse.json({
      message: "설문지가 성공적으로 수정되었습니다.",
    })
  } catch (error) {
    console.error("설문지 수정 오류:", error)
    return NextResponse.json({ error: "설문지 수정 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = Number.parseInt(params.id)

  try {
    console.log("[v0] 설문지 삭제 시작:", surveyId)

    // 1. 참여자 토큰 목록 조회 (배치 처리를 위해)
    const { data: participants, error: participantsError } = await supabase
      .from("survey_participants")
      .select("token")
      .eq("survey_id", surveyId)

    if (participantsError) throw participantsError

    const totalParticipants = participants?.length || 0
    console.log("[v0] 삭제할 참여자 수:", totalParticipants)

    // 2. 참여자가 많은 경우 배치로 응답 데이터 삭제
    if (participants && participants.length > 0) {
      const batchSize = 1000
      const tokens = participants.map((p) => p.token)

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize)
        console.log(`[v0] 응답 삭제 진행: ${i + 1}-${Math.min(i + batchSize, tokens.length)}/${tokens.length}`)

        // 응답 데이터 삭제
        const { error: responsesError } = await supabase
          .from("survey_responses")
          .delete()
          .in("participant_token", batchTokens)

        if (responsesError) {
          console.error("[v0] 응답 삭제 오류:", responsesError)
          throw responsesError
        }

        // 응답 요약 삭제
        const { error: summariesError } = await supabase
          .from("survey_response_summaries")
          .delete()
          .in("participant_token", batchTokens)

        if (summariesError) {
          console.error("[v0] 응답 요약 삭제 오류:", summariesError)
          throw summariesError
        }
      }

      // 3. 참여자 데이터 배치 삭제
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize)
        console.log(`[v0] 참여자 삭제 진행: ${i + 1}-${Math.min(i + batchSize, tokens.length)}/${tokens.length}`)

        const { error: participantDeleteError } = await supabase
          .from("survey_participants")
          .delete()
          .in("token", batchTokens)

        if (participantDeleteError) {
          console.error("[v0] 참여자 삭제 오류:", participantDeleteError)
          throw participantDeleteError
        }
      }
    }

    // 4. 설문 문항 삭제
    const { error: questionsError } = await supabase.from("survey_questions").delete().eq("survey_id", surveyId)

    if (questionsError) {
      console.error("[v0] 문항 삭제 오류:", questionsError)
      throw questionsError
    }

    // 5. 설문지 삭제
    const { error: surveyError } = await supabase.from("surveys").delete().eq("id", surveyId)

    if (surveyError) {
      console.error("[v0] 설문지 삭제 오류:", surveyError)
      throw surveyError
    }

    console.log("[v0] 설문지 및 관련 데이터 삭제 완료:", surveyId)

    return NextResponse.json({
      message: "설문지가 성공적으로 삭제되었습니다.",
      deletedParticipants: totalParticipants,
    })
  } catch (error) {
    console.error("[v0] 설문지 삭제 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "설문지 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
