import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    let hasMore = true
    let deletedParticipants = 0

    while (hasMore) {
      // Fetch a batch of participants (1000 at a time)
      const { data: participants, error: fetchError } = await supabase
        .from("survey_participants")
        .select("token")
        .eq("survey_id", surveyId)
        .limit(1000)

      if (fetchError) {
        console.error("[v0] 참여자 조회 오류:", fetchError)
        throw fetchError
      }

      if (!participants || participants.length === 0) {
        hasMore = false
        break
      }

      const tokens = participants.map((p) => p.token)
      console.log("[v0] 배치 처리 중:", tokens.length, "명")

      // Delete responses for this batch
      const { error: responsesError } = await supabase.from("survey_responses").delete().in("participant_token", tokens)

      if (responsesError) {
        console.error("[v0] 응답 삭제 오류:", responsesError)
        throw responsesError
      }

      // Delete participants for this batch
      const { error: participantsError } = await supabase.from("survey_participants").delete().in("token", tokens)

      if (participantsError) {
        console.error("[v0] 참여자 삭제 오류:", participantsError)
        throw participantsError
      }

      deletedParticipants += tokens.length
      console.log("[v0] 누적 삭제:", deletedParticipants, "명")
    }

    console.log("[v0] 총", deletedParticipants, "명의 참여자 및 응답 삭제 완료")

    // Delete all questions for this survey
    const { error: questionsError } = await supabase.from("survey_questions").delete().eq("survey_id", surveyId)

    if (questionsError) {
      console.error("[v0] 문항 삭제 오류:", questionsError)
      throw questionsError
    }

    // Delete the survey itself
    const { error: surveyError } = await supabase.from("surveys").delete().eq("id", surveyId)

    if (surveyError) {
      console.error("[v0] 설문지 삭제 오류:", surveyError)
      throw surveyError
    }

    console.log("[v0] 설문지 삭제 완료:", surveyId)

    return NextResponse.json({
      message: "설문지가 성공적으로 삭제되었습니다.",
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
